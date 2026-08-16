// Domínio: atribuição SITUACIONAL de uma ocorrência do dia (daily_task) a uma
// posição. PURA. Regra central: atribuir a ocorrência de HOJE não altera a
// definição (task_template) — a próxima ocorrência nasce de novo pela regra da
// definição. Idempotente: reatribuir à MESMA posição converge.

export interface AssignDailyTaskCommand {
  readonly dailyTaskId: string;
  readonly positionId: string;
}

export type AssignDailyTaskRejectionCode =
  'POSITION_REQUIRED' | 'NOT_ASSIGNABLE' | 'TASK_IN_EXECUTION';

export type AssignDailyTaskDecision =
  | { readonly kind: 'assign'; readonly positionId: string }
  | { readonly kind: 'already-assigned'; readonly positionId: string }
  | {
      readonly kind: 'rejected';
      readonly code: AssignDailyTaskRejectionCode;
      readonly detail: string;
    };

/** Estado atual relevante da ocorrência (a aplicação carrega e passa aqui). */
export interface AssignableDailyTask {
  readonly currentAssignedPositionId: string | null;
  /** DONE/SKIPPED já têm desfecho — não faz sentido (re)distribuir. */
  readonly isResolved: boolean;
  /**
   * Execução VIVA (IN_PROGRESS) ou trabalho já entregue à conferência
   * (AWAITING_REVIEW): reatribuir aqui destruiria/confundiria a execução
   * de quem já colocou a mão na tarefa. Opcional por compatibilidade
   * (default: false — comportamento anterior preservado nos chamadores
   * que ainda não informam).
   */
  readonly isInExecution?: boolean;
}

export function decideAssignDailyTask(
  command: AssignDailyTaskCommand,
  task: AssignableDailyTask,
): AssignDailyTaskDecision {
  const positionId = command.positionId.trim();
  if (positionId === '') {
    return {
      kind: 'rejected',
      code: 'POSITION_REQUIRED',
      detail: 'escolha uma posição responsável',
    };
  }
  if (task.isResolved) {
    return {
      kind: 'rejected',
      code: 'NOT_ASSIGNABLE',
      detail: 'a tarefa já tem desfecho e não pode ser redistribuída',
    };
  }
  // reatribuir à MESMA posição converge mesmo em execução (idempotência)
  if (task.currentAssignedPositionId === positionId) {
    return { kind: 'already-assigned', positionId };
  }
  if (task.isInExecution === true) {
    return {
      kind: 'rejected',
      code: 'TASK_IN_EXECUTION',
      detail: 'a tarefa está em execução ou aguardando conferência — não redistribua trabalho vivo',
    };
  }
  return { kind: 'assign', positionId };
}
