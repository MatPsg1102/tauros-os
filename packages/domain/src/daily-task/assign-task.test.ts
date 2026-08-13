// Testes puros da atribuição situacional de ocorrência — determinísticos.

import { describe, expect, it } from 'vitest';

import { decideAssignDailyTask } from './assign-task.js';

describe('decideAssignDailyTask', () => {
  const command = { dailyTaskId: 'dt-1', positionId: 'pos-atendimento' };

  it('atribui quando a posição muda e a tarefa não tem desfecho', () => {
    const decision = decideAssignDailyTask(command, {
      currentAssignedPositionId: null,
      isResolved: false,
    });
    expect(decision).toEqual({ kind: 'assign', positionId: 'pos-atendimento' });
  });

  it('reatribuir à MESMA posição converge (idempotente)', () => {
    const decision = decideAssignDailyTask(command, {
      currentAssignedPositionId: 'pos-atendimento',
      isResolved: false,
    });
    expect(decision).toEqual({ kind: 'already-assigned', positionId: 'pos-atendimento' });
  });

  it('rejeita posição vazia', () => {
    const decision = decideAssignDailyTask(
      { dailyTaskId: 'dt-1', positionId: '  ' },
      { currentAssignedPositionId: null, isResolved: false },
    );
    expect(decision).toMatchObject({ kind: 'rejected', code: 'POSITION_REQUIRED' });
  });

  it('não redistribui tarefa já concluída/adiada', () => {
    const decision = decideAssignDailyTask(command, {
      currentAssignedPositionId: null,
      isResolved: true,
    });
    expect(decision).toMatchObject({ kind: 'rejected', code: 'NOT_ASSIGNABLE' });
  });
});
