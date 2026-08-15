// Domínio: CONFERÊNCIA gerencial de uma execução (Operação Compartilhada).
// Concluir ≠ aprovar: a execução enviada fica AGUARDANDO CONFERÊNCIA até o
// encarregado aprovar (DONE — único terminal) ou devolver (NEEDS_CORRECTION,
// com motivo curto obrigatório). A devolução NUNCA apaga execução, evidência
// ou histórico — o reenvio nasce como NOVA execução (cadeia supersedes).
// Reviewer ≠ executor: ninguém aprova o próprio trabalho. A CAPABILITY
// (task.review) é revalidada pela aplicação — aqui vive só a invariante de
// papéis. PURO.

import type { DailyTaskStatus } from './task-outcome.js';

export type TaskReviewOutcome = 'APPROVED' | 'RETURNED';

export interface ReviewExecutionCommand {
  readonly executionId: string;
  readonly storeId: string;
  readonly outcome: TaskReviewOutcome;
  /** Motivo curto — OBRIGATÓRIO na devolução; ignorado na aprovação. */
  readonly note: string | null;
  readonly reviewerProfileId: string;
  readonly reviewerEmployeeId: string;
  /** Horário do cliente (clock port da aplicação). */
  readonly reviewedAt: Date;
}

export interface ReviewableExecutionView {
  readonly id: string;
  readonly storeId: string;
  readonly dailyTaskId: string;
  readonly performedByEmployeeId: string;
  readonly existingReviewOutcome: TaskReviewOutcome | null;
}

export interface ReviewableTaskView {
  readonly id: string;
  readonly status: DailyTaskStatus;
}

export type ReviewExecutionRejectionCode =
  | 'EXECUTION_NOT_FOUND'
  | 'TASK_NOT_IN_REVIEW'
  | 'REVIEWER_IS_EXECUTOR'
  | 'REASON_REQUIRED'
  | 'ALREADY_REVIEWED_DIFFERENTLY'
  | 'STORE_MISMATCH'
  | 'INVALID_COMMAND';

export interface RecordedReview {
  readonly outcome: TaskReviewOutcome;
  readonly reviewedByProfileId: string;
  readonly reviewedByEmployeeId: string;
  readonly reviewedAt: Date;
  readonly note: string | null;
  /** Estado da OCORRÊNCIA após a conferência. */
  readonly resultingTaskStatus: Extract<DailyTaskStatus, 'DONE' | 'NEEDS_CORRECTION'>;
}

export type ReviewExecutionDecision =
  | { readonly kind: 'review'; readonly review: RecordedReview }
  /** Mesma conferência reapresentada (mesmo desfecho) — converge. */
  | { readonly kind: 'already-reviewed'; readonly outcome: TaskReviewOutcome }
  | {
      readonly kind: 'rejected';
      readonly code: ReviewExecutionRejectionCode;
      readonly detail: string;
    };

const MAX_NOTE_LENGTH = 280;

export function decideReviewExecution(
  command: ReviewExecutionCommand,
  execution: ReviewableExecutionView | null,
  task: ReviewableTaskView | null,
): ReviewExecutionDecision {
  if (
    command.executionId.trim() === '' ||
    command.reviewerProfileId.trim() === '' ||
    command.reviewerEmployeeId.trim() === ''
  ) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'identificadores obrigatórios' };
  }
  if (Number.isNaN(command.reviewedAt.getTime())) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'reviewedAt inválido' };
  }
  if (execution === null || execution.id !== command.executionId) {
    return { kind: 'rejected', code: 'EXECUTION_NOT_FOUND', detail: 'execução não encontrada' };
  }
  if (execution.storeId !== command.storeId) {
    return { kind: 'rejected', code: 'STORE_MISMATCH', detail: 'execução de outra loja' };
  }

  // reapresentação idempotente ANTES das demais regras: aprovar/devolver de
  // novo com o MESMO desfecho converge; desfecho DIFERENTE sobre execução já
  // conferida é rejeitado (o histórico não é reescrito).
  if (execution.existingReviewOutcome !== null) {
    if (execution.existingReviewOutcome === command.outcome) {
      return { kind: 'already-reviewed', outcome: command.outcome };
    }
    return {
      kind: 'rejected',
      code: 'ALREADY_REVIEWED_DIFFERENTLY',
      detail: 'esta execução já foi conferida com outro desfecho',
    };
  }

  if (task === null || task.id !== execution.dailyTaskId) {
    return { kind: 'rejected', code: 'EXECUTION_NOT_FOUND', detail: 'ocorrência divergente' };
  }
  if (task.status !== 'AWAITING_REVIEW') {
    return {
      kind: 'rejected',
      code: 'TASK_NOT_IN_REVIEW',
      detail: 'esta tarefa não está aguardando conferência',
    };
  }
  // ninguém aprova o próprio trabalho — mesmo conhecendo o próprio PIN
  if (execution.performedByEmployeeId === command.reviewerEmployeeId) {
    return {
      kind: 'rejected',
      code: 'REVIEWER_IS_EXECUTOR',
      detail: 'quem executou não pode conferir a própria tarefa',
    };
  }

  const note = command.note?.trim() ?? '';
  if (command.outcome === 'RETURNED' && note === '') {
    return {
      kind: 'rejected',
      code: 'REASON_REQUIRED',
      detail: 'informe o motivo da devolução',
    };
  }

  return {
    kind: 'review',
    review: {
      outcome: command.outcome,
      reviewedByProfileId: command.reviewerProfileId,
      reviewedByEmployeeId: command.reviewerEmployeeId,
      reviewedAt: command.reviewedAt,
      note: command.outcome === 'RETURNED' ? note.slice(0, MAX_NOTE_LENGTH) : null,
      resultingTaskStatus: command.outcome === 'APPROVED' ? 'DONE' : 'NEEDS_CORRECTION',
    },
  };
}
