// Domínio: desfecho de uma tarefa do dia (7.2 + Operação Compartilhada).
// Cadeia task_templates → daily_tasks → task_executions; execução APPEND-ONLY.
// Evolução ADITIVA registrada: o ciclo compartilhado introduz os estados
// IN_PROGRESS / AWAITING_REVIEW / NEEDS_CORRECTION — as transições da 7.2
// (PENDING/OVERDUE → DONE|SKIPPED) permanecem válidas; DONE segue sendo o
// ÚNICO terminal de aprovação (concluir ≠ aprovar).
// PURO: sem relógio real, sem aleatoriedade, sem infraestrutura.

/** execution_result do schema congelado. */
export type ExecutionResult = 'PASS' | 'FAIL' | 'NA';

/** daily_task_status (evolução aditiva da Operação Compartilhada). */
export type DailyTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'NEEDS_CORRECTION'
  | 'DONE'
  | 'OVERDUE'
  | 'SKIPPED';

/** Desfechos que o operador pode registrar (append-only). */
export type TaskOutcomeKind = 'complete' | 'skip';

/** Visão mínima da tarefa materializada sobre a qual se decide. */
export interface DailyTaskView {
  readonly id: string;
  readonly storeId: string;
  readonly workDate: string;
  readonly status: DailyTaskStatus;
  /** requires_photo do template: evidência obrigatória para concluir. */
  readonly requiresPhoto: boolean;
  /**
   * requires_review do template: a execução finalizada vai para CONFERÊNCIA
   * (AWAITING_REVIEW) em vez de DONE. Opcional por compatibilidade.
   */
  readonly requiresReview?: boolean;
  /** Quem está executando (IN_PROGRESS) — opcional por compatibilidade. */
  readonly startedByEmployeeId?: string | null;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
}

export interface TaskOutcomeCommand {
  /** UUID definitivo da execução, gerado no cliente (RA-QUEUE-01). */
  readonly executionId: string;
  readonly storeId: string;
  readonly dailyTaskId: string;
  readonly operatorSessionId: string;
  readonly performedByProfileId: string | null;
  readonly performedByEmployeeId: string;
  readonly deviceId: string;
  /** Horário do cliente (clock port da aplicação). */
  readonly eventTime: Date;
  readonly workDate: string;
  readonly kind: TaskOutcomeKind;
  readonly numericValue: number | null;
  readonly notes: string | null;
  /** Evidência registrada no dispositivo (upload real é pendência 7.x). */
  readonly hasEvidence: boolean;
  /** Horário REAL de início (da ocorrência em execução); null sem start. */
  readonly startedAt?: Date | null;
  readonly idempotencyKey: string;
}

export type TaskOutcomeRejectionCode =
  | 'TASK_NOT_FOUND'
  | 'TASK_ALREADY_RESOLVED'
  | 'TASK_AWAITING_REVIEW'
  | 'TASK_IN_EXECUTION_BY_OTHER'
  | 'EVIDENCE_REQUIRED'
  | 'VALUE_REQUIRED'
  | 'STORE_MISMATCH'
  | 'WORK_DATE_MISMATCH'
  | 'SESSION_REQUIRED'
  | 'INVALID_COMMAND';

export interface RecordedExecution {
  readonly id: string;
  readonly storeId: string;
  readonly dailyTaskId: string;
  readonly operatorSessionId: string;
  readonly performedByProfileId: string | null;
  readonly performedByEmployeeId: string;
  readonly deviceId: string;
  readonly eventTime: Date;
  readonly result: ExecutionResult;
  readonly numericValue: number | null;
  readonly notes: string | null;
  readonly hasEvidence: boolean;
  readonly startedAt: Date | null;
  readonly idempotencyKey: string;
  /**
   * Estado alcançado pela tarefa: terminal (DONE|SKIPPED) ou AGUARDANDO
   * CONFERÊNCIA quando a definição exige review (concluir ≠ aprovar).
   */
  readonly resultingStatus: Extract<DailyTaskStatus, 'DONE' | 'SKIPPED' | 'AWAITING_REVIEW'>;
}

export type TaskOutcomeDecision =
  | { readonly kind: 'record'; readonly execution: RecordedExecution }
  /** Reapresentação idempotente da MESMA execução (não é erro). */
  | { readonly kind: 'already-recorded'; readonly executionId: string }
  | {
      readonly kind: 'rejected';
      readonly code: TaskOutcomeRejectionCode;
      readonly detail: string;
    };

const WORK_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Estados terminais: uma tarefa resolvida não recebe novo desfecho. */
const RESOLVED: readonly DailyTaskStatus[] = ['DONE', 'SKIPPED'];

/** Estados em que a execução do OPERADOR pode registrar desfecho. */
const ACTIONABLE: readonly DailyTaskStatus[] = [
  'PENDING',
  'OVERDUE',
  'IN_PROGRESS',
  'NEEDS_CORRECTION',
];

function missingField(command: TaskOutcomeCommand): string | null {
  // performedByProfileId é identidade de PLATAFORMA opcional (ADR-021): a
  // autoria obrigatória da execução é performedByEmployeeId.
  const required: readonly (readonly [string, string])[] = [
    ['executionId', command.executionId],
    ['storeId', command.storeId],
    ['dailyTaskId', command.dailyTaskId],
    ['performedByEmployeeId', command.performedByEmployeeId],
    ['deviceId', command.deviceId],
    ['idempotencyKey', command.idempotencyKey],
  ];
  for (const [name, value] of required) {
    if (value.trim() === '') return name;
  }
  return null;
}

/**
 * Resultado derivado da faixa esperada congelada (expected_min/expected_max):
 * fora da faixa é FAIL — não é rejeição, é um desfecho legítimo registrado.
 */
function resultFor(command: TaskOutcomeCommand, task: DailyTaskView): ExecutionResult {
  if (command.kind === 'skip') return 'NA';
  const { expectedMin, expectedMax } = task;
  if (command.numericValue === null) return 'PASS';
  if (expectedMin !== null && command.numericValue < expectedMin) return 'FAIL';
  if (expectedMax !== null && command.numericValue > expectedMax) return 'FAIL';
  return 'PASS';
}

/**
 * Regras de domínio (invariáveis — não são parâmetro de configuração):
 * transição oficial a partir de PENDING/OVERDUE; estados DONE/SKIPPED são
 * terminais; evidência obrigatória quando o template exige; execução
 * duplicada (mesma chave) é reconhecida como a MESMA execução.
 */
export function decideTaskOutcome(
  command: TaskOutcomeCommand,
  task: DailyTaskView | null,
  existingExecutionId: string | null,
): TaskOutcomeDecision {
  // replay: a mesma chave de idempotência já produziu uma execução
  if (existingExecutionId !== null) {
    return { kind: 'already-recorded', executionId: existingExecutionId };
  }

  const missing = missingField(command);
  if (missing !== null) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: `campo obrigatório: ${missing}` };
  }
  if (command.operatorSessionId.trim() === '') {
    return {
      kind: 'rejected',
      code: 'SESSION_REQUIRED',
      detail: 'execução exige turno aberto (autoria — ADR-014)',
    };
  }
  if (!WORK_DATE_PATTERN.test(command.workDate)) {
    return {
      kind: 'rejected',
      code: 'INVALID_COMMAND',
      detail: 'data operacional deve ser YYYY-MM-DD no fuso da loja',
    };
  }
  if (Number.isNaN(command.eventTime.getTime())) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'eventTime inválido' };
  }
  if (task === null) {
    return { kind: 'rejected', code: 'TASK_NOT_FOUND', detail: 'tarefa não encontrada no dia' };
  }
  if (task.id !== command.dailyTaskId) {
    return { kind: 'rejected', code: 'TASK_NOT_FOUND', detail: 'tarefa informada diverge' };
  }
  if (task.storeId !== command.storeId) {
    return { kind: 'rejected', code: 'STORE_MISMATCH', detail: 'tarefa pertence a outra loja' };
  }
  if (task.workDate !== command.workDate) {
    return {
      kind: 'rejected',
      code: 'WORK_DATE_MISMATCH',
      detail: 'tarefa pertence a outra data operacional',
    };
  }
  if (RESOLVED.includes(task.status)) {
    return {
      kind: 'rejected',
      code: 'TASK_ALREADY_RESOLVED',
      detail: 'esta tarefa já foi resolvida',
    };
  }
  if (!ACTIONABLE.includes(task.status)) {
    // AWAITING_REVIEW: o trabalho está com o encarregado — o operador não
    // registra novo desfecho enquanto a conferência não devolver ou aprovar.
    return {
      kind: 'rejected',
      code: 'TASK_AWAITING_REVIEW',
      detail: 'esta tarefa aguarda conferência do encarregado',
    };
  }
  // ADIAR trabalho EM CURSO é decisão de quem o iniciou: terceiro não encerra
  // a execução alheia por skip. (CONCLUIR por colega segue permitido — a
  // autoria REAL de quem finalizou fica registrada.)
  if (
    command.kind === 'skip' &&
    task.status === 'IN_PROGRESS' &&
    task.startedByEmployeeId != null &&
    task.startedByEmployeeId !== command.performedByEmployeeId
  ) {
    return {
      kind: 'rejected',
      code: 'TASK_IN_EXECUTION_BY_OTHER',
      detail: 'outra pessoa está executando esta tarefa',
    };
  }
  if (command.kind === 'complete') {
    if (task.requiresPhoto && !command.hasEvidence) {
      return {
        kind: 'rejected',
        code: 'EVIDENCE_REQUIRED',
        detail: 'esta tarefa exige registro de foto para ser concluída',
      };
    }
    const hasRange = task.expectedMin !== null || task.expectedMax !== null;
    if (hasRange && command.numericValue === null) {
      return {
        kind: 'rejected',
        code: 'VALUE_REQUIRED',
        detail: 'esta tarefa exige a medição registrada para ser concluída',
      };
    }
  }

  return {
    kind: 'record',
    execution: {
      id: command.executionId,
      storeId: command.storeId,
      dailyTaskId: command.dailyTaskId,
      operatorSessionId: command.operatorSessionId,
      performedByProfileId: command.performedByProfileId,
      performedByEmployeeId: command.performedByEmployeeId,
      deviceId: command.deviceId,
      eventTime: command.eventTime,
      result: resultFor(command, task),
      numericValue: command.kind === 'skip' ? null : command.numericValue,
      notes: command.notes,
      hasEvidence: command.hasEvidence,
      startedAt: command.startedAt ?? null,
      idempotencyKey: command.idempotencyKey,
      // concluir ≠ aprovar: com review exigido, a execução finalizada entra
      // em conferência; adiar (skip) nunca passa por review.
      resultingStatus:
        command.kind === 'complete'
          ? task.requiresReview === true
            ? 'AWAITING_REVIEW'
            : 'DONE'
          : 'SKIPPED',
    },
  };
}

/**
 * OVERDUE é derivado do vencimento congelado (due_at), nunca digitado.
 * Trabalho ENTREGUE (aguardando conferência) não conta como atraso de
 * execução — o relógio parou na submissão.
 */
export function isOverdue(status: DailyTaskStatus, dueAt: Date, now: Date): boolean {
  if (RESOLVED.includes(status) || status === 'AWAITING_REVIEW') return false;
  return dueAt.getTime() < now.getTime();
}
