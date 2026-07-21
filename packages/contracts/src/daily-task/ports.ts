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
