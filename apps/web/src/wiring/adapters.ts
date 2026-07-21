// Adapters do vertical slice (7.1 §6) — implementam os ports de
// @tauros/contracts sobre a infraestrutura congelada. ÚNICO lugar (junto do
// container) autorizado a importar @tauros/infrastructure/config-engine
// (regra mecânica web-ui-no-infrastructure).

import type {
  DailyTaskRecord,
  DailyTaskRepositoryPort,
  EffectiveAuthorization,
  OperatorSessionRecord,
  SessionAuditPort,
  SessionEnqueuePort,
  SessionPolicyPort,
  SessionSyncStatus,
  TaskExecutionEnqueuePort,
  TaskExecutionRecord,
  TaskSyncStatus,
} from '@tauros/contracts';
import { ENTITY_OPERATOR_SESSION, ENTITY_TASK_EXECUTION } from '@tauros/contracts';
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
  version: 2,
  migrations: [
    {
      toVersion: 1,
      description: 'Sessões operacionais locais (vertical slice 7.1)',
      stores: [{ name: 'operator_sessions', indexes: { by_store: 'storeId' } }],
    },
    {
      // ADITIVA: só cria stores novos — as sessões da 7.1 são preservadas.
      toVersion: 2,
      description: 'Quadro de tarefas do dia e execuções (7.2)',
      stores: [
        { name: 'daily_tasks', indexes: { by_store_date: 'storeDateKey' } },
        { name: 'task_executions', indexes: { by_store_key: 'storeKey' } },
      ],
    },
  ],
};

const SESSIONS = 'operator_sessions';
const DAILY_TASKS = 'daily_tasks';
const TASK_EXECUTIONS = 'task_executions';

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

// ===== Tarefas do dia (7.2) — materialização local + execuções append-only.
// Chaves de índice são DERIVADAS na borda de persistência (mapper), nunca
// no contrato de domínio. =====

interface DailyTaskRow extends DailyTaskRecord {
  readonly storeDateKey: string;
}

interface TaskExecutionRow extends TaskExecutionRecord {
  readonly storeKey: string;
}

function toTaskRow(record: DailyTaskRecord): DailyTaskRow {
  return { ...record, storeDateKey: `${record.storeId}:${record.workDate}` };
}

function toExecutionRow(record: TaskExecutionRecord): TaskExecutionRow {
  return { ...record, storeKey: `${record.storeId}:${record.idempotencyKey}` };
}

export class LocalDailyTaskRepository implements DailyTaskRepositoryPort {
  constructor(private readonly store: LocalStorePort) {}

  async byWorkDate(storeId: string, workDate: string): Promise<readonly DailyTaskRecord[]> {
    const rows = await this.store.transaction([DAILY_TASKS], 'read', (tx) =>
      tx.getByIndex(DAILY_TASKS, 'by_store_date', `${storeId}:${workDate}`),
    );
    return rows as DailyTaskRecord[];
  }

  async byId(id: string): Promise<DailyTaskRecord | null> {
    const row = await this.store.transaction([DAILY_TASKS], 'read', (tx) =>
      tx.get(DAILY_TASKS, id),
    );
    return (row as DailyTaskRecord | undefined) ?? null;
  }

  async saveAll(records: readonly DailyTaskRecord[]): Promise<void> {
    await this.store.transaction([DAILY_TASKS], 'write', async (tx) => {
      for (const record of records) await tx.put(DAILY_TASKS, record.id, toTaskRow(record));
    });
  }

  async save(record: DailyTaskRecord): Promise<void> {
    await this.store.transaction([DAILY_TASKS], 'write', (tx) =>
      tx.put(DAILY_TASKS, record.id, toTaskRow(record)),
    );
  }

  async executionByIdempotencyKey(
    storeId: string,
    idempotencyKey: string,
  ): Promise<TaskExecutionRecord | null> {
    const rows = await this.store.transaction([TASK_EXECUTIONS], 'read', (tx) =>
      tx.getByIndex(TASK_EXECUTIONS, 'by_store_key', `${storeId}:${idempotencyKey}`),
    );
    return (rows as TaskExecutionRecord[])[0] ?? null;
  }

  /** APPEND-ONLY: uma execução persistida nunca é sobrescrita. */
  async saveExecution(execution: TaskExecutionRecord): Promise<void> {
    await this.store.transaction([TASK_EXECUTIONS], 'write', async (tx) => {
      const current = await tx.get(TASK_EXECUTIONS, execution.id);
      if (current !== undefined) return;
      await tx.put(TASK_EXECUTIONS, execution.id, toExecutionRow(execution));
    });
  }

  /** Único campo mutável: o reflexo do desfecho da fila. */
  async updateExecutionSyncStatus(id: string, status: TaskSyncStatus): Promise<void> {
    await this.store.transaction([TASK_EXECUTIONS], 'write', async (tx) => {
      const current = (await tx.get(TASK_EXECUTIONS, id)) as TaskExecutionRow | undefined;
      if (current === undefined) return;
      await tx.put(TASK_EXECUTIONS, id, { ...current, syncStatus: status });
    });
  }

  async allExecutions(): Promise<readonly TaskExecutionRecord[]> {
    const rows = await this.store.transaction([TASK_EXECUTIONS], 'read', (tx) =>
      tx.getAll(TASK_EXECUTIONS),
    );
    return rows as TaskExecutionRecord[];
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

  async sessionClosingPolicy(storeId: string) {
    return {
      sessionAbsoluteMaxMs: await this.resolver.resolve('session.absoluteMaxMs', storeId),
      reauthOnAbsolute: await this.resolver.resolve('session.reauthOnAbsolute', storeId),
      configVersionRef: null,
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
      operation: input.operation ?? 'open',
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

  /** Snapshot de autorização vinculado ao item (RA-QUEUE-01). */
  private snapshotNow(auth: EffectiveAuthorization) {
    const ttlMs = Math.max(1, auth.validUntil.getTime() - this.clock().getTime());
    return captureSnapshot(
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
  }

  /** Itens ainda pendentes desta entidade — base das dependências do DAG. */
  private async pendingItemIdsFor(entityType: string, entityId: string): Promise<string[]> {
    const all = await this.queue.all();
    return all
      .filter((item) => item.entityType === entityType && item.entityId === entityId)
      .map((item) => item.id);
  }

  async enqueueCloseSession(
    input: Parameters<SessionEnqueuePort['enqueueCloseSession']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    // o fechamento só pode chegar ao servidor DEPOIS da abertura (ordem do DAG)
    const dependsOn = await this.pendingItemIdsFor(ENTITY_OPERATOR_SESSION, input.sessionId);
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'update',
      entityType: ENTITY_OPERATOR_SESSION,
      entityId: input.sessionId,
      payload: input.payload,
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
      idempotencyKey: input.idempotencyKey,
      authorization: this.snapshotNow(auth),
      trace: {
        storeId: input.payload.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 1,
      },
    });
  }

  async enqueueOpenSession(
    input: Parameters<SessionEnqueuePort['enqueueOpenSession']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'insert',
      entityType: ENTITY_OPERATOR_SESSION,
      entityId: input.record.id,
      payload: { record: input.record },
      idempotencyKey: input.record.idempotencyKey,
      authorization: this.snapshotNow(auth),
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

// ===== Execuções de tarefa na fila oficial (7.2) =====

export class TaskExecutionQueueAdapter implements TaskExecutionEnqueuePort {
  constructor(
    private readonly queue: LocalQueueRepository,
    private readonly authorization: () => EffectiveAuthorization,
    private readonly deviceId: string,
    private readonly clock: () => Date,
  ) {}

  async enqueueTaskExecution(
    input: Parameters<TaskExecutionEnqueuePort['enqueueTaskExecution']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    const execution = input.execution;
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
    // a execução depende da ABERTURA do turno que lhe dá autoria (ADR-014)
    const all = await this.queue.all();
    const dependsOn = all
      .filter(
        (item) =>
          item.entityType === ENTITY_OPERATOR_SESSION &&
          item.entityId === execution.operatorSessionId,
      )
      .map((item) => item.id);
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'insert',
      entityType: ENTITY_TASK_EXECUTION,
      entityId: execution.id,
      payload: { execution },
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
      idempotencyKey: execution.idempotencyKey,
      authorization: snapshot,
      trace: {
        storeId: execution.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: execution.schemaVersion,
        priority: 2,
      },
    });
  }
}
