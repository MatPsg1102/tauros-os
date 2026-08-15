// Domínio: INICIAR a execução de uma ocorrência (Operação Compartilhada).
// Registra o horário REAL de início e o ATOR (autoria não vive na UI).
// Elegibilidade: a posição vigente do ator precisa ser o responsável efetivo
// da ocorrência — NÃO existe regra de substituição (lacuna registrada; a
// redistribuição oficial é a atribuição situacional do encarregado). PURO.

import type { DailyTaskStatus } from './task-outcome.js';

export interface StartDailyTaskCommand {
  readonly dailyTaskId: string;
  readonly storeId: string;
  readonly actorEmployeeId: string;
  /** Posição VIGENTE do ator hoje; null = sem posição. */
  readonly actorPositionId: string | null;
  /** Horário do cliente (clock port da aplicação). */
  readonly startedAt: Date;
}

export interface StartableTaskView {
  readonly id: string;
  readonly storeId: string;
  readonly status: DailyTaskStatus;
  readonly effectivePositionId: string | null;
  readonly startedByEmployeeId: string | null;
}

export type StartDailyTaskRejectionCode =
  | 'TASK_NOT_FOUND'
  | 'TASK_UNASSIGNED'
  | 'TASK_NOT_STARTABLE'
  | 'ALREADY_STARTED_BY_OTHER'
  | 'NOT_ELIGIBLE'
  | 'STORE_MISMATCH'
  | 'INVALID_COMMAND';

export interface StartedTaskPatch {
  readonly status: Extract<DailyTaskStatus, 'IN_PROGRESS'>;
  readonly startedAt: Date;
  readonly startedByEmployeeId: string;
}

export type StartDailyTaskDecision =
  | { readonly kind: 'start'; readonly patch: StartedTaskPatch }
  /** Já iniciada pelo PRÓPRIO ator — duplo toque converge. */
  | { readonly kind: 'already-started' }
  | {
      readonly kind: 'rejected';
      readonly code: StartDailyTaskRejectionCode;
      readonly detail: string;
    };

/** Estados a partir dos quais a execução pode começar/recomeçar. */
const STARTABLE: readonly DailyTaskStatus[] = ['PENDING', 'OVERDUE', 'NEEDS_CORRECTION'];

export function decideStartDailyTask(
  command: StartDailyTaskCommand,
  task: StartableTaskView | null,
): StartDailyTaskDecision {
  if (command.dailyTaskId.trim() === '' || command.actorEmployeeId.trim() === '') {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'identificadores obrigatórios' };
  }
  if (Number.isNaN(command.startedAt.getTime())) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'startedAt inválido' };
  }
  if (task === null || task.id !== command.dailyTaskId) {
    return { kind: 'rejected', code: 'TASK_NOT_FOUND', detail: 'tarefa não encontrada no dia' };
  }
  if (task.storeId !== command.storeId) {
    return { kind: 'rejected', code: 'STORE_MISMATCH', detail: 'tarefa pertence a outra loja' };
  }
  if (task.status === 'IN_PROGRESS') {
    if (task.startedByEmployeeId === command.actorEmployeeId) {
      return { kind: 'already-started' };
    }
    return {
      kind: 'rejected',
      code: 'ALREADY_STARTED_BY_OTHER',
      detail: 'outra pessoa já está executando esta tarefa',
    };
  }
  if (!STARTABLE.includes(task.status)) {
    return {
      kind: 'rejected',
      code: 'TASK_NOT_STARTABLE',
      detail: 'esta tarefa não pode ser iniciada agora',
    };
  }
  if (task.effectivePositionId === null) {
    return {
      kind: 'rejected',
      code: 'TASK_UNASSIGNED',
      detail: 'assuma a tarefa (ou peça atribuição) antes de iniciar',
    };
  }
  if (command.actorPositionId !== task.effectivePositionId) {
    return {
      kind: 'rejected',
      code: 'NOT_ELIGIBLE',
      detail: 'esta tarefa é da responsabilidade de outra posição',
    };
  }

  return {
    kind: 'start',
    patch: {
      status: 'IN_PROGRESS',
      startedAt: command.startedAt,
      startedByEmployeeId: command.actorEmployeeId,
    },
  };
}
