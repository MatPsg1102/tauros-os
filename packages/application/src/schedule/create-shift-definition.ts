// Use case: criar JORNADA (ShiftDefinition). Jornada é DADO CONFIGURÁVEL da
// loja (ADR-019, "SEEDS de configuração" no schema congelado) — capability
// oficial config.write, a MESMA de posições e task_templates; nenhuma string
// concorrente. Duplicata pela chave natural (loja + janela) CONVERGE.
// Ordem de efeitos: fila → local → auditoria (config.changed).

import { decideCreateShiftDefinition } from '@tauros/domain';
import {
  CAPABILITY_CONFIG_WRITE,
  ENTITY_SHIFT_DEFINITION,
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type EffectiveAuthorization,
  type IdGeneratorPort,
  type ScheduleEnqueuePort,
  type ScheduleRepositoryPort,
  type ShiftDefinitionRecord,
  type WorkforceAuditPort,
} from '@tauros/contracts';

export interface CreateShiftDefinitionInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  /** Nome exibido; vazio ⇒ derivado da janela. */
  readonly name: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly createdOffline: boolean;
}

export type CreateShiftDefinitionFailureCode =
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'INVALID_TIME'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type CreateShiftDefinitionResult =
  | { readonly kind: 'created'; readonly definition: ShiftDefinitionRecord }
  /** Mesma janela na loja — devolve a existente (não é erro). */
  | { readonly kind: 'already-created'; readonly definition: ShiftDefinitionRecord }
  | {
      readonly kind: 'failed';
      readonly code: CreateShiftDefinitionFailureCode;
      readonly detail: string;
    };

export class CreateShiftDefinitionUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly schedule: ScheduleRepositoryPort,
    private readonly queue: ScheduleEnqueuePort,
    private readonly audit: WorkforceAuditPort,
  ) {}

  async execute(input: CreateShiftDefinitionInput): Promise<CreateShiftDefinitionResult> {
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
        actorProfileId: auth.operatorProfileId,
        entityType: ENTITY_SHIFT_DEFINITION,
        entityId: null,
        deviceId: input.deviceId,
        correlationId: auth.sessionId,
        source,
        result: 'rejected',
        errorCode: CAPABILITY_CONFIG_WRITE,
      });
      return { kind: 'failed', code: 'PERMISSION_DENIED', detail: 'capability ausente' };
    }

    // chave natural ANTES de decidir: janela repetida e duplo clique convergem
    const existing = await this.schedule.definitionByWindow(
      auth.storeId,
      input.startTime,
      input.endTime,
    );
    const idempotencyKey = `shift-definition-create:${auth.storeId}:${input.startTime}-${input.endTime}`;
    const decision = decideCreateShiftDefinition(
      {
        definitionId: this.ids.uuid(),
        storeId: auth.storeId,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        clientCreatedAt: now,
        idempotencyKey,
      },
      existing?.id ?? null,
    );

    if (decision.kind === 'already-created') {
      if (existing === null) {
        return { kind: 'failed', code: 'PERSISTENCE_FAILED', detail: 'jornada ausente no replay' };
      }
      return { kind: 'already-created', definition: existing };
    }
    if (decision.kind === 'rejected') {
      if (decision.code === 'INVALID_TIME' || decision.code === 'EMPTY_WINDOW') {
        return { kind: 'failed', code: 'INVALID_TIME', detail: decision.detail };
      }
      return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
    }

    const record: ShiftDefinitionRecord = {
      id: decision.definition.id,
      storeId: decision.definition.storeId,
      name: decision.definition.name,
      startTime: decision.definition.startTime,
      endTime: decision.definition.endTime,
      clientCreatedAt: decision.definition.clientCreatedAt.toISOString(),
      idempotencyKey: decision.definition.idempotencyKey,
      syncStatus: 'queued',
      auditCorrelationId: decision.definition.id,
    };

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local; 3) auditoria
    try {
      await this.queue.enqueueCreateShiftDefinition({
        queueItemId: this.ids.uuid(),
        definition: record,
      });
    } catch (error) {
      await this.audit.record({
        eventType: 'config.changed',
        occurredAt: now,
        storeId: auth.storeId,
        actorProfileId: auth.operatorProfileId,
        entityType: ENTITY_SHIFT_DEFINITION,
        entityId: record.id,
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
      await this.schedule.saveDefinition(record);
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
      actorProfileId: auth.operatorProfileId,
      entityType: ENTITY_SHIFT_DEFINITION,
      entityId: record.id,
      deviceId: input.deviceId,
      correlationId: record.auditCorrelationId,
      source,
      result: 'success',
    });

    return { kind: 'created', definition: record };
  }
}
