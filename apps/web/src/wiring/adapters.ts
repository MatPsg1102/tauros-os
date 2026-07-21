// Adapters do vertical slice (7.1 §6) — implementam os ports de
// @tauros/contracts sobre a infraestrutura congelada. ÚNICO lugar (junto do
// container) autorizado a importar @tauros/infrastructure/config-engine
// (regra mecânica web-ui-no-infrastructure).

import type {
  EffectiveAuthorization,
  OperatorSessionRecord,
  SessionAuditPort,
  SessionEnqueuePort,
  SessionPolicyPort,
  SessionSyncStatus,
} from '@tauros/contracts';
import { ENTITY_OPERATOR_SESSION } from '@tauros/contracts';
import type { ConfigResolver } from '@tauros/config-engine';
import {
  captureSnapshot,
  type AuditBufferPort,
  type AuditEventFactory,
  type LocalQueueRepository,
  type LocalSchema,
  type LocalStorePort,
} from '@tauros/infrastructure';

// ===== Persistência local do estado do app (DB próprio — não altera o
// schema congelado 'tauros-offline'; mesma porta LocalStorePort). =====

export const APP_STATE_SCHEMA: LocalSchema = {
  databaseName: 'tauros-app-state',
  version: 1,
  migrations: [
    {
      toVersion: 1,
      description: 'Sessões operacionais locais (vertical slice 7.1)',
      stores: [{ name: 'operator_sessions', indexes: { by_store: 'storeId' } }],
    },
  ],
};

const SESSIONS = 'operator_sessions';

export class LocalOperatorSessionRepository {
  constructor(private readonly store: LocalStorePort) {}

  async findActive(
    storeId: string,
    actorEmployeeId: string,
  ): Promise<OperatorSessionRecord | null> {
    const rows = await this.store.transaction([SESSIONS], 'read', (tx) =>
      tx.getByIndex(SESSIONS, 'by_store', storeId),
    );
    const active = (rows as OperatorSessionRecord[]).find(
      (row) => row.actorEmployeeId === actorEmployeeId && row.status === 'ACTIVE',
    );
    return active ?? null;
  }

  async save(record: OperatorSessionRecord): Promise<void> {
    await this.store.transaction([SESSIONS], 'write', (tx) => tx.put(SESSIONS, record.id, record));
  }

  async updateSyncStatus(id: string, status: SessionSyncStatus): Promise<void> {
    await this.store.transaction([SESSIONS], 'write', async (tx) => {
      const current = (await tx.get(SESSIONS, id)) as OperatorSessionRecord | undefined;
      if (current === undefined) return;
      await tx.put(SESSIONS, id, { ...current, syncStatus: status });
    });
  }

  async byId(id: string): Promise<OperatorSessionRecord | null> {
    const row = await this.store.transaction([SESSIONS], 'read', (tx) => tx.get(SESSIONS, id));
    return (row as OperatorSessionRecord | undefined) ?? null;
  }
}

// ===== Política efetiva via Configuration Engine (ADR-019) =====

export class ConfigSessionPolicyAdapter implements SessionPolicyPort {
  constructor(private readonly resolver: ConfigResolver) {}

  async sessionOpeningPolicy(storeId: string) {
    return {
      sessionAbsoluteMaxMs: await this.resolver.resolve('session.absoluteMaxMs', storeId),
      pinOfflineValidityMs: await this.resolver.resolve('auth.pin.offlineValidityMs', storeId),
      configVersionRef: null, // versões de config chegam com o backend real
    };
  }
}

// ===== Auditoria direta (eventos de segurança §13 do modelo congelado) =====

export class SessionAuditAdapter implements SessionAuditPort {
  constructor(
    private readonly factory: AuditEventFactory,
    private readonly buffer: AuditBufferPort,
  ) {}

  async record(input: Parameters<SessionAuditPort['record']>[0]): Promise<void> {
    const event = this.factory.fromDirect({
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      storeId: input.storeId,
      actorId: input.actorProfileId,
      actorType: 'human',
      sessionId: input.sessionId,
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      entityType: ENTITY_OPERATOR_SESSION,
      entityId: input.sessionId,
      operation: 'open',
      source: input.source,
      result: input.result,
      errorCode: input.errorCode ?? null,
    });
    await this.buffer.append(event);
  }
}

// ===== Intenção durável na fila oficial (RA-QUEUE-01) =====

export class SessionQueueAdapter implements SessionEnqueuePort {
  constructor(
    private readonly queue: LocalQueueRepository,
    private readonly authorization: () => EffectiveAuthorization,
    private readonly deviceId: string,
    private readonly clock: () => Date,
  ) {}

  async enqueueOpenSession(
    input: Parameters<SessionEnqueuePort['enqueueOpenSession']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    const ttlMs = Math.max(1, auth.validUntil.getTime() - this.clock().getTime());
    const snapshot = captureSnapshot(
      {
        operatorProfileId: auth.operatorProfileId,
        operatorEmployeeId: auth.operatorEmployeeId,
        storeId: auth.storeId,
        sessionId: auth.sessionId,
        permissions: auth.permissions,
        ...(auth.permissionModelVersion !== undefined
          ? { permissionModelVersion: auth.permissionModelVersion }
          : {}),
        ...(auth.configVersionRef !== undefined ? { configVersionRef: auth.configVersionRef } : {}),
        authOrigin: auth.origin === 'online' ? 'online' : 'offline-pin',
      },
      ttlMs,
      this.clock,
    );
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'insert',
      entityType: ENTITY_OPERATOR_SESSION,
      entityId: input.record.id,
      payload: { record: input.record },
      idempotencyKey: input.record.idempotencyKey,
      authorization: snapshot,
      trace: {
        storeId: input.record.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 1,
      },
    });
  }
}
