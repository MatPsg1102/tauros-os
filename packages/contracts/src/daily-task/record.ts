// Tarefas do dia (7.2) — espelham a cadeia congelada
// task_templates → daily_tasks → task_executions. Nenhum conceito novo:
// os estados são exatamente daily_task_status e execution_result.

import type { LocalSyncStatus } from '../sync/status.js';
import type { TaskRecurrence } from '../task-template/recurrence.js';

export const ENTITY_DAILY_TASK = 'daily_tasks' as const;
export const ENTITY_TASK_EXECUTION = 'task_executions' as const;

/**
 * daily_task_status (schema, evolução aditiva da Operação Compartilhada):
 * o ciclo compartilhado introduz os estados intermediários EM EXECUÇÃO →
 * AGUARDANDO CONFERÊNCIA → CORREÇÃO NECESSÁRIA. DONE segue sendo o ÚNICO
 * terminal de aprovação (concluir ≠ aprovar); transições antigas
 * (PENDING/OVERDUE → DONE|SKIPPED) permanecem válidas.
 */
export type DailyTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'NEEDS_CORRECTION'
  | 'DONE'
  | 'OVERDUE'
  | 'SKIPPED';

/** task_review_outcome (aditivo) — desfecho da conferência gerencial. */
export type TaskReviewOutcome = 'APPROVED' | 'RETURNED';

/** execution_result (schema congelado). */
export type ExecutionResult = 'PASS' | 'FAIL' | 'NA';

/** execution_source (schema congelado). */
export type ExecutionSource = 'HUMAN' | 'SYSTEM' | 'INTEGRATION';

/** task_frequency (schema congelado). */
export type TaskFrequency = 'ONCE' | 'DAILY' | 'PER_SHIFT' | 'HOURLY' | 'CUSTOM';

export type TaskSyncStatus = LocalSyncStatus;

/**
 * Definição vigente copiada na materialização do dia (task_templates). Os
 * campos de PLANEJAMENTO são opcionais por compatibilidade: uma fonte sem eles
 * (fixture legada, registro antigo) materializa como antes — todo dia, desde
 * sempre, sem início planejado. A materialização aplica esses defaults.
 */
export interface TaskTemplateSnapshot {
  readonly templateId: string;
  readonly title: string;
  readonly frequency: TaskFrequency;
  /** requires_photo: evidência obrigatória para concluir. */
  readonly requiresPhoto: boolean;
  /**
   * requires_review: execução exige conferência do encarregado antes do
   * terminal. Opcional por compatibilidade (default: false — sem review).
   */
  readonly requiresReview?: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  readonly targetPositionId: string | null;
  /** Minutos após a abertura do dia operacional do FIM máximo (vencimento). */
  readonly dueOffsetMinutes: number;
  /** Data civil YYYY-MM-DD do início da vigência (default: sempre). */
  readonly effectiveFrom?: string;
  /** Minutos do INÍCIO planejado após a abertura do dia (default: 0). */
  readonly plannedStartMinutes?: number;
  /** Regra de materialização (default: todo dia). */
  readonly recurrence?: TaskRecurrence;
}

/** Materialização local do dia (daily_tasks) + snapshot da definição. */
export interface DailyTaskRecord {
  readonly id: string;
  readonly storeId: string;
  readonly templateId: string;
  /** work_date civil YYYY-MM-DD no fuso da LOJA. */
  readonly workDate: string;
  /** Início planejado da ocorrência (ISO); null se a definição não tem início. */
  readonly plannedStartAt: string | null;
  readonly dueAt: string;
  readonly status: DailyTaskStatus;
  /**
   * Atribuição SITUACIONAL desta ocorrência (encarregado define no dia).
   * Independente de template.targetPositionId: atribuir hoje NÃO altera a
   * definição — a próxima ocorrência nasce novamente sem responsável.
   * Responsável efetivo = assignedPositionId ?? template.targetPositionId.
   */
  readonly assignedPositionId: string | null;
  readonly expectedMinSnapshot: number | null;
  readonly expectedMaxSnapshot: number | null;
  readonly configVersionRef: string | null;
  readonly template: TaskTemplateSnapshot;
  /** Execução que levou a tarefa ao estado atual (append-only). */
  readonly lastExecutionId: string | null;
  readonly syncStatus: TaskSyncStatus | null;
  /**
   * Execução em andamento (Operação Compartilhada): horário REAL de início e
   * ator. Opcionais por compatibilidade com registros anteriores à V1.
   */
  readonly startedAt?: string | null;
  readonly startedByEmployeeId?: string | null;
}

/** Payload enfileirado da atribuição situacional (sincronização do slice). */
export interface AssignDailyTaskQueuePayload {
  readonly dailyTask: DailyTaskRecord;
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
  /** Identidade de plataforma — null até provisionamento server-side (ADR-021). */
  readonly performedByProfileId: string | null;
  /** Autoria operacional OBRIGATÓRIA (ADR-021). */
  readonly performedByEmployeeId: string;
  readonly deviceId: string;
  readonly result: ExecutionResult;
  readonly numericValue: number | null;
  readonly notes: string | null;
  readonly eventTime: string;
  readonly clientTimestamp: string;
  /**
   * Projeção LOCAL de "evidência registrada". Os METADADOS reais vivem em
   * EvidenceRecord (espelho de attachments); o binário fica no blob store
   * local até o upload real (Storage — pendência mantida).
   */
  readonly hasEvidence: boolean;
  readonly idempotencyKey: string;
  readonly schemaVersion: number;
  readonly syncStatus: TaskSyncStatus;
  /**
   * Status alcançado pela tarefa com esta execução: DONE/SKIPPED (terminais)
   * ou AWAITING_REVIEW quando a definição exige conferência.
   */
  readonly resultingStatus: Extract<DailyTaskStatus, 'DONE' | 'SKIPPED' | 'AWAITING_REVIEW'>;
  /** Horário REAL de início (ISO); null em execuções sem start explícito. */
  readonly startedAt?: string | null;
  /** Evidências (metadados locais) anexadas a esta execução. */
  readonly evidenceIds?: readonly string[];
  /** Execução anterior que esta substitui (reenvio pós-devolução). */
  readonly supersedesExecutionId?: string | null;
  /**
   * CONFERÊNCIA gerencial (fato sobre a execução). null = nunca conferida.
   * Devolução NÃO apaga nada: o reenvio nasce como NOVA execução.
   */
  readonly review?: TaskExecutionReview | null;
}

export interface TaskExecutionReview {
  readonly outcome: TaskReviewOutcome;
  /** Identidade de plataforma — null até provisionamento server-side (ADR-021). */
  readonly reviewedByProfileId: string | null;
  /** Autoria operacional OBRIGATÓRIA (ADR-021). */
  readonly reviewedByEmployeeId: string;
  readonly reviewedAt: string;
  /** Motivo curto obrigatório na devolução; null na aprovação. */
  readonly note: string | null;
}

/** Payload enfileirado da conferência (update sobre a execução). */
export interface ReviewTaskExecutionQueuePayload {
  readonly execution: TaskExecutionRecord;
}

/** Payload enfileirado do início de execução (update na ocorrência). */
export interface StartDailyTaskQueuePayload {
  readonly dailyTask: DailyTaskRecord;
}

/** Payload enfileirado da execução (contrato de sincronização do slice). */
export interface TaskExecutionQueuePayload {
  readonly execution: TaskExecutionRecord;
}
