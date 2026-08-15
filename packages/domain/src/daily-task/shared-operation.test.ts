// Testes do ciclo compartilhado — assumir, iniciar, enviar p/ conferência,
// aprovar/devolver. Invariantes centrais: concluir ≠ aprovar; reviewer ≠
// executor; devolução preserva histórico; transições da 7.2 intactas.

import { describe, expect, it } from 'vitest';

import { decideClaimDailyTask } from './claim-task.js';
import { decideStartDailyTask } from './start-task.js';
import { decideReviewExecution } from './review-execution.js';
import { decideTaskOutcome, isOverdue, type TaskOutcomeCommand } from './task-outcome.js';

const NOW = new Date('2026-08-14T13:00:00.000Z');

describe('decideClaimDailyTask — assumir sem responsável', () => {
  const command = {
    dailyTaskId: 'task-1',
    storeId: 'store-1',
    actorEmployeeId: 'emp-1',
    actorPositionId: 'pos-1' as string | null,
    actorIsScheduled: true,
  };
  const task = {
    id: 'task-1',
    storeId: 'store-1',
    status: 'PENDING' as const,
    effectivePositionId: null as string | null,
  };

  it('atribui a ocorrência à posição vigente do ator escalado', () => {
    expect(decideClaimDailyTask(command, task)).toEqual({
      kind: 'claim',
      assignedPositionId: 'pos-1',
    });
  });

  it('duplo toque converge; posição de OUTRO ator é rejeitada', () => {
    expect(decideClaimDailyTask(command, { ...task, effectivePositionId: 'pos-1' })).toMatchObject({
      kind: 'already-claimed',
    });
    expect(decideClaimDailyTask(command, { ...task, effectivePositionId: 'pos-2' })).toMatchObject({
      kind: 'rejected',
      code: 'ALREADY_ASSIGNED',
    });
  });

  it('exige posição vigente e presença planejada (equipe ≠ presença)', () => {
    expect(decideClaimDailyTask({ ...command, actorPositionId: null }, task)).toMatchObject({
      kind: 'rejected',
      code: 'ACTOR_WITHOUT_POSITION',
    });
    expect(decideClaimDailyTask({ ...command, actorIsScheduled: false }, task)).toMatchObject({
      kind: 'rejected',
      code: 'ACTOR_NOT_SCHEDULED',
    });
  });
});

describe('decideStartDailyTask — início real', () => {
  const command = {
    dailyTaskId: 'task-1',
    storeId: 'store-1',
    actorEmployeeId: 'emp-1',
    actorPositionId: 'pos-1' as string | null,
    startedAt: NOW,
  };
  const task = {
    id: 'task-1',
    storeId: 'store-1',
    status: 'PENDING' as const,
    effectivePositionId: 'pos-1' as string | null,
    startedByEmployeeId: null as string | null,
  };

  it('registra ator e horário REAL de início (autoria fora da UI)', () => {
    const decision = decideStartDailyTask(command, task);
    expect(decision).toEqual({
      kind: 'start',
      patch: { status: 'IN_PROGRESS', startedAt: NOW, startedByEmployeeId: 'emp-1' },
    });
  });

  it('duplo início do MESMO ator converge; de outro ator é rejeitado', () => {
    const inProgress = { ...task, status: 'IN_PROGRESS' as const, startedByEmployeeId: 'emp-1' };
    expect(decideStartDailyTask(command, inProgress)).toEqual({ kind: 'already-started' });
    expect(
      decideStartDailyTask({ ...command, actorEmployeeId: 'emp-2' }, inProgress),
    ).toMatchObject({ kind: 'rejected', code: 'ALREADY_STARTED_BY_OTHER' });
  });

  it('sem responsável exige assumir antes; posição divergente não inicia', () => {
    expect(decideStartDailyTask(command, { ...task, effectivePositionId: null })).toMatchObject({
      kind: 'rejected',
      code: 'TASK_UNASSIGNED',
    });
    expect(decideStartDailyTask({ ...command, actorPositionId: 'pos-2' }, task)).toMatchObject({
      kind: 'rejected',
      code: 'NOT_ELIGIBLE',
    });
  });

  it('retomada após devolução (NEEDS_CORRECTION) é permitida', () => {
    expect(decideStartDailyTask(command, { ...task, status: 'NEEDS_CORRECTION' })).toMatchObject({
      kind: 'start',
    });
  });
});

describe('decideTaskOutcome — envio para conferência (concluir ≠ aprovar)', () => {
  const command: TaskOutcomeCommand = {
    executionId: 'exec-1',
    storeId: 'store-1',
    dailyTaskId: 'task-1',
    operatorSessionId: 'sess-1',
    performedByProfileId: 'prof-1',
    performedByEmployeeId: 'emp-1',
    deviceId: 'device-A',
    eventTime: NOW,
    workDate: '2026-08-14',
    kind: 'complete',
    numericValue: null,
    notes: null,
    hasEvidence: true,
    startedAt: new Date('2026-08-14T12:40:00.000Z'),
    idempotencyKey: 'task-complete:store-1:task-1:emp-1',
  };
  const task = {
    id: 'task-1',
    storeId: 'store-1',
    workDate: '2026-08-14',
    status: 'IN_PROGRESS' as const,
    requiresPhoto: false,
    requiresReview: true,
    expectedMin: null,
    expectedMax: null,
  };

  it('requiresReview=true: execução finalizada vai para AGUARDANDO CONFERÊNCIA', () => {
    const decision = decideTaskOutcome(command, task, null);
    expect(decision.kind).toBe('record');
    if (decision.kind !== 'record') return;
    expect(decision.execution.resultingStatus).toBe('AWAITING_REVIEW');
    expect(decision.execution.startedAt).toEqual(command.startedAt);
  });

  it('requiresReview=false (ou ausente): conclui direto — sem gargalo', () => {
    const noReview = decideTaskOutcome(command, { ...task, requiresReview: false }, null);
    if (noReview.kind === 'record') expect(noReview.execution.resultingStatus).toBe('DONE');
    const { requiresReview: omitted, ...legacyTask } = task;
    void omitted; // template legado: campo simplesmente ausente
    const legacy = decideTaskOutcome(command, { ...legacyTask, status: 'PENDING' }, null);
    if (legacy.kind === 'record') expect(legacy.execution.resultingStatus).toBe('DONE');
    expect(noReview.kind).toBe('record');
    expect(legacy.kind).toBe('record');
  });

  it('AWAITING_REVIEW bloqueia novo desfecho do operador', () => {
    expect(decideTaskOutcome(command, { ...task, status: 'AWAITING_REVIEW' }, null)).toMatchObject({
      kind: 'rejected',
      code: 'TASK_AWAITING_REVIEW',
    });
  });

  it('adiar (skip) nunca passa por conferência', () => {
    const decision = decideTaskOutcome({ ...command, kind: 'skip' }, task, null);
    if (decision.kind === 'record') expect(decision.execution.resultingStatus).toBe('SKIPPED');
    expect(decision.kind).toBe('record');
  });

  it('terceiro NÃO adia trabalho em curso de outro ator; concluir por colega segue válido', () => {
    const inProgress = { ...task, requiresReview: false, startedByEmployeeId: 'emp-1' };
    expect(
      decideTaskOutcome(
        { ...command, kind: 'skip', performedByEmployeeId: 'emp-2' },
        inProgress,
        null,
      ),
    ).toMatchObject({ kind: 'rejected', code: 'TASK_IN_EXECUTION_BY_OTHER' });
    // o próprio ator pode adiar o que iniciou
    expect(decideTaskOutcome({ ...command, kind: 'skip' }, inProgress, null)).toMatchObject({
      kind: 'record',
    });
    // colega pode CONCLUIR — autoria real registrada
    const byColleague = decideTaskOutcome(
      { ...command, performedByEmployeeId: 'emp-2' },
      inProgress,
      null,
    );
    expect(byColleague.kind).toBe('record');
    if (byColleague.kind === 'record') {
      expect(byColleague.execution.performedByEmployeeId).toBe('emp-2');
    }
  });

  it('trabalho entregue não conta como atraso de execução', () => {
    const due = new Date('2026-08-14T12:00:00.000Z'); // já venceu
    expect(isOverdue('AWAITING_REVIEW', due, NOW)).toBe(false);
    expect(isOverdue('IN_PROGRESS', due, NOW)).toBe(true);
    expect(isOverdue('PENDING', due, NOW)).toBe(true);
  });
});

describe('decideReviewExecution — conferência do encarregado', () => {
  const command = {
    executionId: 'exec-1',
    storeId: 'store-1',
    outcome: 'APPROVED' as const,
    note: null as string | null,
    reviewerProfileId: 'prof-9',
    reviewerEmployeeId: 'emp-9',
    reviewedAt: NOW,
  };
  const execution = {
    id: 'exec-1',
    storeId: 'store-1',
    dailyTaskId: 'task-1',
    performedByEmployeeId: 'emp-1',
    existingReviewOutcome: null as 'APPROVED' | 'RETURNED' | null,
  };
  const task = { id: 'task-1', status: 'AWAITING_REVIEW' as const };

  it('aprovação leva ao ÚNICO terminal (DONE) com reviewer registrado', () => {
    const decision = decideReviewExecution(command, execution, task);
    expect(decision).toMatchObject({
      kind: 'review',
      review: {
        outcome: 'APPROVED',
        reviewedByEmployeeId: 'emp-9',
        resultingTaskStatus: 'DONE',
        note: null,
      },
    });
  });

  it('devolução exige motivo e leva a CORREÇÃO NECESSÁRIA', () => {
    expect(
      decideReviewExecution({ ...command, outcome: 'RETURNED', note: '  ' }, execution, task),
    ).toMatchObject({ kind: 'rejected', code: 'REASON_REQUIRED' });
    const returned = decideReviewExecution(
      { ...command, outcome: 'RETURNED', note: 'Limpar novamente a parte inferior.' },
      execution,
      task,
    );
    expect(returned).toMatchObject({
      kind: 'review',
      review: {
        resultingTaskStatus: 'NEEDS_CORRECTION',
        note: 'Limpar novamente a parte inferior.',
      },
    });
  });

  it('quem executou não confere o próprio trabalho (mesmo com PIN válido)', () => {
    expect(
      decideReviewExecution({ ...command, reviewerEmployeeId: 'emp-1' }, execution, task),
    ).toMatchObject({ kind: 'rejected', code: 'REVIEWER_IS_EXECUTOR' });
  });

  it('reconferir com o MESMO desfecho converge; desfecho diferente é rejeitado', () => {
    const reviewed = { ...execution, existingReviewOutcome: 'APPROVED' as const };
    expect(decideReviewExecution(command, reviewed, task)).toEqual({
      kind: 'already-reviewed',
      outcome: 'APPROVED',
    });
    expect(
      decideReviewExecution({ ...command, outcome: 'RETURNED', note: 'x' }, reviewed, task),
    ).toMatchObject({ kind: 'rejected', code: 'ALREADY_REVIEWED_DIFFERENTLY' });
  });

  it('tarefa fora de AGUARDANDO CONFERÊNCIA não é conferível', () => {
    expect(
      decideReviewExecution(command, execution, { id: 'task-1', status: 'DONE' }),
    ).toMatchObject({ kind: 'rejected', code: 'TASK_NOT_IN_REVIEW' });
  });
});
