// Use case: criar posição operacional (Gestão de Equipe). Posição é DADO
// CONFIGURÁVEL (ADR-019, comentário do schema congelado) — a capability
// oficial é config.write, a MESMA que governa task_templates; nenhuma string
// concorrente foi criada. Auditoria config.changed sobre
// operational_positions. Duplicata pela chave natural (storeId+key, unique
// congelado) CONVERGE para a posição existente — nunca duplica em silêncio.

import { decideCreatePosition } from '@tauros/domain';
import {
  CAPABILITY_CONFIG_WRITE,
  ENTITY_OPERATIONAL_POSITION,
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type EffectiveAuthorization,
  type IdGeneratorPort,
  type OperationalPositionRecord,
  type WorkforceAuditPort,
  type WorkforceEnqueuePort,
  type WorkforceRepositoryPort,
} from '@tauros/contracts';

import { nameSlug } from '../shared/slug.js';

export interface CreateOperationalPositionInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  readonly name: string;
  readonly createdOffline: boolean;
}

export type CreateOperationalPositionFailureCode =
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'NAME_REQUIRED'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type CreateOperationalPositionResult =
  | { readonly kind: 'created'; readonly position: OperationalPositionRecord }
  /** Mesma chave natural na loja — devolve a existente (não é erro). */
  | { readonly kind: 'already-created'; readonly position: OperationalPositionRecord }
  | {
      readonly kind: 'failed';
      readonly code: CreateOperationalPositionFailureCode;
      readonly detail: string;
    };

/** Chave natural estável da posição — a MESMA do schema congelado (unique). */
export function positionKeyFor(name: string): string {
  return nameSlug(name, 40);
}

export class CreateOperationalPositionUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly workforce: WorkforceRepositoryPort,
    private readonly queue: WorkforceEnqueuePort,
    private readonly audit: WorkforceAuditPort,
  ) {}

  async execute(input: CreateOperationalPositionInput): Promise<CreateOperationalPositionResult> {
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
        entityType: ENTITY_OPERATIONAL_POSITION,
        entityId: null,
        deviceId: input.deviceId,
        correlationId: auth.sessionId,
        source,
        result: 'rejected',
        errorCode: CAPABILITY_CONFIG_WRITE,
      });
      return { kind: 'failed', code: 'PERMISSION_DENIED', detail: 'capability ausente' };
    }

    const key = positionKeyFor(input.name);
    const idempotencyKey = `position-create:${auth.storeId}:${key}`;

    // chave natural ANTES de decidir: nome repetido e duplo clique convergem
    const existing = key === '' ? null : await this.workforce.positionByKey(auth.storeId, key);
    const decision = decideCreatePosition(
      {
        positionId: this.ids.uuid(),
        storeId: auth.storeId,
        name: input.name,
        key,
        clientCreatedAt: now,
        idempotencyKey,
      },
      existing?.id ?? null,
    );

    if (decision.kind === 'already-created') {
      if (existing === null) {
        return { kind: 'failed', code: 'PERSISTENCE_FAILED', detail: 'posição ausente no replay' };
      }
      return { kind: 'already-created', position: existing };
    }
    if (decision.kind === 'rejected') {
      if (decision.code === 'NAME_REQUIRED') {
        return { kind: 'failed', code: 'NAME_REQUIRED', detail: decision.detail };
      }
      return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
    }

    const record: OperationalPositionRecord = {
      id: decision.position.id,
      storeId: decision.position.storeId,
      key: decision.position.key,
      name: decision.position.name,
      clientCreatedAt: decision.position.clientCreatedAt.toISOString(),
      idempotencyKey: decision.position.idempotencyKey,
      syncStatus: 'queued',
      auditCorrelationId: decision.position.id,
    };

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local; 3) auditoria
    try {
      await this.queue.enqueueCreatePosition({ queueItemId: this.ids.uuid(), position: record });
    } catch (error) {
      await this.audit.record({
        eventType: 'config.changed',
        occurredAt: now,
        storeId: auth.storeId,
        actorProfileId: auth.operatorProfileId,
        entityType: ENTITY_OPERATIONAL_POSITION,
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
      await this.workforce.savePosition(record);
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
      entityType: ENTITY_OPERATIONAL_POSITION,
      entityId: record.id,
      deviceId: input.deviceId,
      correlationId: record.auditCorrelationId,
      source,
      result: 'success',
    });

    return { kind: 'created', position: record };
  }
}
