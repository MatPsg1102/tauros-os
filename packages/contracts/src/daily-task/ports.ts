// Ports do quadro de tarefas do dia (7.2). A aplicação depende SÓ destes
// contratos; adapters (IndexedDB, fila, auditoria) chegam pelo wiring.

import type {
  DailyTaskRecord,
  TaskExecutionRecord,
  TaskSyncStatus,
  TaskTemplateSnapshot,
} from './record.js';

/** Definições vigentes da loja (task_templates ativos). */
export interface TaskTemplateSourcePort {
  activeTemplates(storeId: string): Promise<readonly TaskTemplateSnapshot[]>;
}

/**
 * Escala oficial da loja — responde à ÚNICA pergunta que a materialização
 * WHEN_SCHEDULED precisa: "a posição está escalada nesta data?". A regra de
 * turno (ex.: 12x36), trocas, faltas e substituições vivem na fonte da escala,
 * NUNCA no módulo de tarefas. ShiftOccurrence real substitui esta porta sem
 * tocar domínio/aplicação.
 */
export interface ShiftSchedulePort {
  isPositionScheduled(storeId: string, positionId: string, workDate: string): Promise<boolean>;
}

export interface DailyTaskRepositoryPort {
  byWorkDate(storeId: string, workDate: string): Promise<readonly DailyTaskRecord[]>;
  byId(id: string): Promise<DailyTaskRecord | null>;
  /** Materialização idempotente do dia (não sobrescreve o que já existe). */
  saveAll(records: readonly DailyTaskRecord[]): Promise<void>;
  save(record: DailyTaskRecord): Promise<void>;
  executionByIdempotencyKey(
    storeId: string,
    idempotencyKey: string,
  ): Promise<TaskExecutionRecord | null>;
  saveExecution(execution: TaskExecutionRecord): Promise<void>;
  updateExecutionSyncStatus(id: string, status: TaskSyncStatus): Promise<void>;
}

export interface TaskExecutionEnqueueInput {
  readonly queueItemId: string;
  readonly execution: TaskExecutionRecord;
}

export interface TaskExecutionEnqueuePort {
  enqueueTaskExecution(input: TaskExecutionEnqueueInput): Promise<void>;
}

// ===== Atribuição situacional da ocorrência (encarregado define no dia) =====

export interface DailyTaskAssignEnqueueInput {
  readonly queueItemId: string;
  readonly dailyTask: DailyTaskRecord;
}

export interface DailyTaskAssignEnqueuePort {
  enqueueAssignDailyTask(input: DailyTaskAssignEnqueueInput): Promise<void>;
}

/** Auditoria da atribuição — usa tipos OFICIAIS do catálogo congelado. */
export interface DailyTaskAuditInput {
  readonly eventType: 'access.denied';
  readonly occurredAt: Date;
  readonly storeId: string;
  readonly actorProfileId: string;
  readonly dailyTaskId: string | null;
  readonly deviceId: string;
  readonly correlationId: string;
  readonly source: 'client-online' | 'client-offline';
  readonly result: 'rejected';
  readonly errorCode?: string;
}

export interface DailyTaskAuditPort {
  record(input: DailyTaskAuditInput): Promise<void>;
}
