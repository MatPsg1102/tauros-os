// Domínio: ASSUMIR uma ocorrência sem responsável (Operação Compartilhada).
// Auto-serviço do operador — diferente da atribuição GERENCIAL do
// encaregado: aqui o gate é ELEGIBILIDADE (posição vigente do ator, escalado
// hoje pela fonte oficial de presença), nunca capability de gestão. Assumir
// grava só na OCORRÊNCIA (assignedPositionId) — o template não muda e a
// próxima ocorrência recorrente nasce novamente sem responsável. PURO.

import type { DailyTaskStatus } from './task-outcome.js';

export interface ClaimDailyTaskCommand {
  readonly dailyTaskId: string;
  readonly storeId: string;
  readonly actorEmployeeId: string;
  /** Posição VIGENTE do ator hoje (vínculo oficial); null = sem posição. */
  readonly actorPositionId: string | null;
  /** Veredito da presença planejada oficial: o ator está escalado hoje? */
  readonly actorIsScheduled: boolean;
}

export interface ClaimableTaskView {
  readonly id: string;
  readonly storeId: string;
  readonly status: DailyTaskStatus;
  /** Responsável efetivo atual (situacional ?? template). */
  readonly effectivePositionId: string | null;
}

export type ClaimDailyTaskRejectionCode =
  | 'TASK_NOT_FOUND'
  | 'TASK_NOT_CLAIMABLE'
  | 'ALREADY_ASSIGNED'
  | 'ACTOR_WITHOUT_POSITION'
  | 'ACTOR_NOT_SCHEDULED'
  | 'STORE_MISMATCH'
  | 'INVALID_COMMAND';

export type ClaimDailyTaskDecision =
  | { readonly kind: 'claim'; readonly assignedPositionId: string }
  /** Já assumida pela POSIÇÃO do próprio ator — reapresentação converge. */
  | { readonly kind: 'already-claimed'; readonly assignedPositionId: string }
  | {
      readonly kind: 'rejected';
      readonly code: ClaimDailyTaskRejectionCode;
      readonly detail: string;
    };

/** Estados em que uma ocorrência sem responsável pode ser assumida. */
const CLAIMABLE: readonly DailyTaskStatus[] = ['PENDING', 'OVERDUE'];

export function decideClaimDailyTask(
  command: ClaimDailyTaskCommand,
  task: ClaimableTaskView | null,
): ClaimDailyTaskDecision {
  if (command.dailyTaskId.trim() === '' || command.actorEmployeeId.trim() === '') {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'identificadores obrigatórios' };
  }
  if (task === null || task.id !== command.dailyTaskId) {
    return { kind: 'rejected', code: 'TASK_NOT_FOUND', detail: 'tarefa não encontrada no dia' };
  }
  if (task.storeId !== command.storeId) {
    return { kind: 'rejected', code: 'STORE_MISMATCH', detail: 'tarefa pertence a outra loja' };
  }
  if (command.actorPositionId === null || command.actorPositionId.trim() === '') {
    return {
      kind: 'rejected',
      code: 'ACTOR_WITHOUT_POSITION',
      detail: 'você não possui posição vigente para assumir tarefas',
    };
  }
  if (task.effectivePositionId !== null) {
    // já tem responsável: se for a POSIÇÃO do próprio ator, converge
    if (task.effectivePositionId === command.actorPositionId) {
      return { kind: 'already-claimed', assignedPositionId: task.effectivePositionId };
    }
    return {
      kind: 'rejected',
      code: 'ALREADY_ASSIGNED',
      detail: 'esta tarefa já tem responsável definido',
    };
  }
  if (!CLAIMABLE.includes(task.status)) {
    return {
      kind: 'rejected',
      code: 'TASK_NOT_CLAIMABLE',
      detail: 'esta tarefa não está aberta para ser assumida',
    };
  }
  if (!command.actorIsScheduled) {
    return {
      kind: 'rejected',
      code: 'ACTOR_NOT_SCHEDULED',
      detail: 'você não está escalado hoje para assumir tarefas',
    };
  }

  return { kind: 'claim', assignedPositionId: command.actorPositionId };
}
