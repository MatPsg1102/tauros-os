// Use case: criar definição de tarefa (Área do Encarregado). Mesma espinha
// dos slices anteriores — autorização efetiva (ADR-018, capability OFICIAL
// config.write da RLS congelada), validação da equipe via port, decisão de
// domínio, fila, persistência local e auditoria (config.changed — tipo do
// catálogo congelado). SEM conhecer infraestrutura.
//
// Ordem de efeitos e recuperação (atomicidade sem transação distribuída):
//   1. enqueue (intenção durável — carrega o registro completo no payload);
//   2. save local (estado consultável);
//   3. audit (config.changed).
// Falha entre 1 e 2 é recuperável: o boot reconstrói pelo payload da fila.

import { decideCreateTemplate } from '@tauros/domain';
import {
  CAPABILITY_CONFIG_WRITE,
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type EffectiveAuthorization,
  type IdGeneratorPort,
  type TaskFrequency,
  type TaskRecurrence,
  type TaskTemplateRecord,
  type TaskTemplateRepositoryPort,
  type TeamDirectoryPort,
  type TemplateAuditPort,
  type TemplateEnqueuePort,
} from '@tauros/contracts';

import { operationalDateFor } from '../operator-session/open-operator-session.js';

export interface CreateTaskTemplateInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  /** Fuso IANA da LOJA (dado oficial da loja — nunca o fuso do dispositivo). */
  readonly storeTimeZone: string;
  readonly title: string;
  /** Posição responsável; null = "definir no dia" (sem responsável). */
  readonly targetPositionId: string | null;
  readonly requiresPhoto: boolean;
  /** Exige conferência do encarregado após a execução (default: não). */
  readonly requiresReview?: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  /** Data civil YYYY-MM-DD do início da vigência. */
  readonly effectiveFrom: string;
  /** Minutos após o início do dia operacional do INÍCIO planejado. */
  readonly plannedStartMinutes: number;
  /** Minutos após o início do dia operacional do FIM máximo (vencimento). */
  readonly dueOffsetMinutes: number;
  readonly recurrence: TaskRecurrence;
  readonly createdOffline: boolean;
}

export type CreateTaskTemplateFailureCode =
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'UNKNOWN_POSITION'
  | 'TITLE_REQUIRED'
  | 'ASSIGNMENT_REQUIRED'
  | 'INVALID_DUE_TIME'
  | 'INVALID_TIME_RANGE'
  | 'INVALID_DATE'
  | 'INVALID_RECURRENCE'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

/** task_frequency congelada derivada da recorrência (fidelidade de schema). */
function frequencyFor(recurrence: TaskRecurrence): TaskFrequency {
  return recurrence.kind === 'ONCE' ? 'ONCE' : 'CUSTOM';
}

export type CreateTaskTemplateResult =
  | { readonly kind: 'created'; readonly template: TaskTemplateRecord }
  | { readonly kind: 'already-created'; readonly template: TaskTemplateRecord }
  | {
      readonly kind: 'failed';
      readonly code: CreateTaskTemplateFailureCode;
      readonly detail: string;
    };

/** Slug estável do título — parte da identidade determinística da operação. */
function titleSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Identidade determinística da criação (nunca timestamp/aleatório): a MESMA
 * definição, pela MESMA pessoa, no MESMO dia e posição, é UMA criação —
 * duplo clique, retry e resposta perdida convergem para a mesma chave.
 */
export function templateIdempotencyKeyFor(
  storeId: string,
  operationalDate: string,
  creatorEmployeeId: string,
  title: string,
  targetPositionId: string | null,
): string {
  const position = targetPositionId ?? 'unassigned';
  return `task-template-create:${storeId}:${operationalDate}:${creatorEmployeeId}:${position}:${titleSlug(title)}`;
}

export class CreateTaskTemplateUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly team: TeamDirectoryPort,
    private readonly repository: TaskTemplateRepositoryPort,
    private readonly queue: TemplateEnqueuePort,
    private readonly audit: TemplateAuditPort,
  ) {}

  async execute(input: CreateTaskTemplateInput): Promise<CreateTaskTemplateResult> {
    const now = this.clock.now();
    const auth = input.authorization;
    const source = input.createdOffline ? 'client-offline' : 'client-online';

    // ADR-018: a APLICAÇÃO revalida a capacidade (ocultação visual não é controle)
    if (auth.validUntil.getTime() <= now.getTime()) {
      return { kind: 'failed', code: 'SNAPSHOT_EXPIRED', detail: 'autorização offline expirada' };
    }
    if (
      auth.permissionModelVersion !== undefined &&
      auth.permissionModelVersion !== PERMISSION_MODEL_VERSION
    ) {
      return {
        kind: 'failed',
        code: 'SNAPSHOT_VERSION_INCOMPATIBLE',
        detail: `permission_model_version ${String(auth.permissionModelVersion)} incompatível`,
      };
    }
    if (!auth.permissions.includes(CAPABILITY_CONFIG_WRITE)) {
      await this.audit.record({
        eventType: 'access.denied',
        occurredAt: now,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        actorProfileId: auth.operatorProfileId,
        templateId: null,
        deviceId: input.deviceId,
        correlationId: auth.sessionId,
        source,
        result: 'rejected',
        errorCode: CAPABILITY_CONFIG_WRITE,
      });
      return { kind: 'failed', code: 'PERMISSION_DENIED', detail: 'capability ausente' };
    }

    // atribuição usa ID OFICIAL: se houver posição, ela precisa existir na loja
    const targetPositionId =
      input.targetPositionId !== null && input.targetPositionId.trim() !== ''
        ? input.targetPositionId
        : null;
    if (targetPositionId !== null) {
      const positions = await this.team.positions(auth.storeId);
      if (!positions.some((position) => position.id === targetPositionId)) {
        return {
          kind: 'failed',
          code: 'UNKNOWN_POSITION',
          detail: 'posição responsável não encontrada nesta loja',
        };
      }
    }

    const operationalDate = operationalDateFor(now, input.storeTimeZone);
    const idempotencyKey = templateIdempotencyKeyFor(
      auth.storeId,
      operationalDate,
      auth.operatorEmployeeId,
      input.title,
      targetPositionId,
    );

    // replay ANTES de decidir: a garantia de não duplicar não depende do resto
    const existing = await this.repository.byIdempotencyKey(auth.storeId, idempotencyKey);
    if (existing !== null) {
      return { kind: 'already-created', template: existing };
    }

    const decision = decideCreateTemplate(
      {
        templateId: this.ids.uuid(),
        storeId: auth.storeId,
        title: input.title,
        frequency: frequencyFor(input.recurrence),
        targetPositionId,
        requiresPhoto: input.requiresPhoto,
        requiresReview: input.requiresReview ?? false,
        expectedMin: input.expectedMin,
        expectedMax: input.expectedMax,
        clientCreatedAt: now,
        effectiveFrom: input.effectiveFrom,
        plannedStartMinutes: input.plannedStartMinutes,
        dueOffsetMinutes: input.dueOffsetMinutes,
        recurrence: input.recurrence,
        idempotencyKey,
      },
      null,
    );

    if (decision.kind === 'already-created') {
      return { kind: 'failed', code: 'PERSISTENCE_FAILED', detail: 'definição ausente no replay' };
    }
    if (decision.kind === 'rejected') {
      switch (decision.code) {
        case 'TITLE_REQUIRED':
          return { kind: 'failed', code: 'TITLE_REQUIRED', detail: decision.detail };
        case 'ASSIGNMENT_REQUIRED':
          return { kind: 'failed', code: 'ASSIGNMENT_REQUIRED', detail: decision.detail };
        case 'INVALID_DUE_TIME':
          return { kind: 'failed', code: 'INVALID_DUE_TIME', detail: decision.detail };
        case 'INVALID_TIME_RANGE':
          return { kind: 'failed', code: 'INVALID_TIME_RANGE', detail: decision.detail };
        case 'INVALID_DATE':
          return { kind: 'failed', code: 'INVALID_DATE', detail: decision.detail };
        case 'INVALID_RECURRENCE':
          return { kind: 'failed', code: 'INVALID_RECURRENCE', detail: decision.detail };
        default:
          return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
      }
    }

    const created = decision.template;
    const record: TaskTemplateRecord = {
      id: created.id,
      storeId: created.storeId,
      title: created.title,
      frequency: created.frequency,
      targetPositionId: created.targetPositionId,
      requiresPhoto: created.requiresPhoto,
      requiresReview: created.requiresReview,
      expectedMin: created.expectedMin,
      expectedMax: created.expectedMax,
      active: created.active,
      clientCreatedAt: created.clientCreatedAt.toISOString(),
      effectiveFrom: created.effectiveFrom,
      plannedStartMinutes: created.plannedStartMinutes,
      dueOffsetMinutes: created.dueOffsetMinutes,
      recurrence: created.recurrence,
      idempotencyKey: created.idempotencyKey,
      syncStatus: 'queued',
      auditCorrelationId: created.id,
    };

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local; 3) auditoria
    try {
      await this.queue.enqueueCreateTemplate({ queueItemId: this.ids.uuid(), template: record });
    } catch (error) {
      await this.audit.record({
        eventType: 'config.changed',
        occurredAt: now,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        actorProfileId: auth.operatorProfileId,
        templateId: record.id,
        deviceId: input.deviceId,
        correlationId: record.auditCorrelationId,
        source,
        result: 'failure',
        errorCode: 'ENQUEUE_FAILED',
      });
      return {
        kind: 'failed',
        code: 'ENQUEUE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao enfileirar',
      };
    }

    try {
      await this.repository.save(record);
    } catch (error) {
      // intenção durável já registrada — o boot reconcilia pela fila
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao persistir localmente',
      };
    }

    await this.audit.record({
      eventType: 'config.changed',
      occurredAt: now,
      storeId: auth.storeId,
      actorEmployeeId: auth.operatorEmployeeId,
      actorProfileId: auth.operatorProfileId,
      templateId: record.id,
      deviceId: input.deviceId,
      correlationId: record.auditCorrelationId,
      source,
      result: 'success',
    });

    return { kind: 'created', template: record };
  }
}
