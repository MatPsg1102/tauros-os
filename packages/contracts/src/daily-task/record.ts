// Tarefas do dia (7.2) — espelham a cadeia congelada
// task_templates → daily_tasks → task_executions. Nenhum conceito novo:
// os estados são exatamente daily_task_status e execution_result.

import type { LocalSyncStatus } from '../sync/status.js';

export const ENTITY_DAILY_TASK = 'daily_tasks' as const;
export const ENTITY_TASK_EXECUTION = 'task_executions' as const;

/** daily_task_status (schema congelado) — sem estado intermediário. */
export type DailyTaskStatus = 'PENDING' | 'DONE' | 'OVERDUE' | 'SKIPPED';

/** execution_result (schema congelado). */
export type ExecutionResult = 'PASS' | 'FAIL' | 'NA';

/** execution_source (schema congelado). */
export type ExecutionSource = 'HUMAN' | 'SYSTEM' | 'INTEGRATION';

/** task_frequency (schema congelado). */
export type TaskFrequency = 'ONCE' | 'DAILY' | 'PER_SHIFT' | 'HOURLY' | 'CUSTOM';

export type TaskSyncStatus = LocalSyncStatus;

/** Definição vigente copiada na materialização do dia (task_templates). */
export interface TaskTemplateSnapshot {
  readonly templateId: string;
  readonly title: string;
  readonly frequency: TaskFrequency;
  /** requires_photo: evidência obrigatória para concluir. */
  readonly requiresPhoto: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  readonly targetPositionId: string | null;
  /** Minutos após a abertura do dia operacional em que a tarefa vence. */
  readonly dueOffsetMinutes: number;
}

/** Materialização local do dia (daily_tasks) + snapshot da definição. */
export interface DailyTaskRecord {
  readonly id: string;
  readonly storeId: string;
  readonly templateId: string;
  /** work_date civil YYYY-MM-DD no fuso da LOJA. */
  readonly workDate: string;
  readonly dueAt: string;
  readonly status: DailyTaskStatus;
  readonly expectedMinSnapshot: number | null;
  readonly expectedMaxSnapshot: number | null;
  readonly configVersionRef: string | null;
  readonly template: TaskTemplateSnapshot;
  /** Execução que levou a tarefa ao estado atual (append-only). */
  readonly lastExecutionId: string | null;
  readonly syncStatus: TaskSyncStatus | null;
}

/**
 * Registro append-only do que foi feito (task_executions). id = UUID do
 * cliente (RA-QUEUE-01). NUNCA é editado: correção entra como nova execução.
 */
export interface TaskExecutionRecord {
  readonly id: string;
  readonly storeId: string;
  readonly dailyTaskId: string;
  readonly operatorSessionId: string;
  readonly executionSource: ExecutionSource;
  readonly performedByProfileId: string;
  readonly performedByEmployeeId: string;
  readonly deviceId: string;
  readonly result: ExecutionResult;
  readonly numericValue: number | null;
  readonly notes: string | null;
  readonly eventTime: string;
  readonly clientTimestamp: string;
  /**
   * Projeção LOCAL de "evidência registrada" (a linha em attachments e o
   * binário chegam com o upload real — pendência registrada na 7.2).
   */
  readonly hasEvidence: boolean;
  readonly idempotencyKey: string;
  readonly schemaVersion: number;
  readonly syncStatus: TaskSyncStatus;
  /** Status alcançado pela tarefa com esta execução (DONE ou SKIPPED). */
  readonly resultingStatus: Extract<DailyTaskStatus, 'DONE' | 'SKIPPED'>;
}

/** Payload enfileirado da execução (contrato de sincronização do slice). */
export interface TaskExecutionQueuePayload {
  readonly execution: TaskExecutionRecord;
}
