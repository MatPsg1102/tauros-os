// Testes de domínio do desfecho de tarefa (7.2) — modelo congelado:
// PENDING/OVERDUE → DONE|SKIPPED, append-only, sem estado intermediário.

import { describe, expect, it } from 'vitest';

import {
  decideTaskOutcome,
  isOverdue,
  type DailyTaskView,
  type TaskOutcomeCommand,
} from './task-outcome.js';

const FIXED_NOW = new Date('2026-07-21T12:00:00.000Z');

const command: TaskOutcomeCommand = {
  executionId: 'exec-1',
  storeId: 'store-1',
  dailyTaskId: 'task-1',
  operatorSessionId: 'sess-1',
  performedByProfileId: 'prof-1',
  performedByEmployeeId: 'emp-1',
  deviceId: 'device-1',
  eventTime: FIXED_NOW,
  workDate: '2026-07-21',
  kind: 'complete',
  numericValue: null,
  notes: null,
  hasEvidence: false,
  idempotencyKey: 'task-complete:store-1:task-1:emp-1',
};

const task: DailyTaskView = {
  id: 'task-1',
  storeId: 'store-1',
  workDate: '2026-07-21',
  status: 'PENDING',
  requiresPhoto: false,
  expectedMin: null,
  expectedMax: null,
};

describe('decideTaskOutcome — transições oficiais', () => {
  it('conclui uma tarefa PENDING', () => {
    const decision = decideTaskOutcome(command, task, null);
    expect(decision.kind).toBe('record');
    if (decision.kind !== 'record') return;
    expect(decision.execution.resultingStatus).toBe('DONE');
    expect(decision.execution.result).toBe('PASS');
  });

  it('conclui uma tarefa OVERDUE (atraso não impede execução)', () => {
    const decision = decideTaskOutcome(command, { ...task, status: 'OVERDUE' }, null);
    expect(decision.kind).toBe('record');
  });

  it('adia uma tarefa (SKIPPED — desfecho previsto no modelo)', () => {
    const decision = decideTaskOutcome(
      { ...command, kind: 'skip', notes: 'faltou matéria-prima' },
      task,
      null,
    );
    expect(decision.kind).toBe('record');
    if (decision.kind !== 'record') return;
    expect(decision.execution.resultingStatus).toBe('SKIPPED');
    expect(decision.execution.result).toBe('NA');
  });

  it('rejeita desfecho sobre tarefa já concluída', () => {
    const decision = decideTaskOutcome(command, { ...task, status: 'DONE' }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'TASK_ALREADY_RESOLVED' });
  });

  it('rejeita desfecho sobre tarefa já adiada', () => {
    const decision = decideTaskOutcome(command, { ...task, status: 'SKIPPED' }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'TASK_ALREADY_RESOLVED' });
  });

  it('execução duplicada (mesma chave) é idempotente, não erro', () => {
    const decision = decideTaskOutcome(command, task, 'exec-ja-registrada');
    expect(decision).toEqual({ kind: 'already-recorded', executionId: 'exec-ja-registrada' });
  });

  it('replay vence até sobre tarefa já resolvida (não duplica)', () => {
    const decision = decideTaskOutcome(command, { ...task, status: 'DONE' }, 'exec-1');
    expect(decision).toEqual({ kind: 'already-recorded', executionId: 'exec-1' });
  });
});

describe('decideTaskOutcome — obrigatoriedades do template congelado', () => {
  it('exige evidência quando requires_photo', () => {
    const decision = decideTaskOutcome(command, { ...task, requiresPhoto: true }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'EVIDENCE_REQUIRED' });
  });

  it('aceita conclusão com evidência registrada', () => {
    const decision = decideTaskOutcome(
      { ...command, hasEvidence: true },
      { ...task, requiresPhoto: true },
      null,
    );
    expect(decision.kind).toBe('record');
  });

  it('adiar não exige evidência', () => {
    const decision = decideTaskOutcome(
      { ...command, kind: 'skip', notes: 'motivo operacional' },
      { ...task, requiresPhoto: true },
      null,
    );
    expect(decision.kind).toBe('record');
  });

  it('exige medição quando há faixa esperada', () => {
    const decision = decideTaskOutcome(command, { ...task, expectedMin: 0, expectedMax: 4 }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'VALUE_REQUIRED' });
  });

  it('valor dentro da faixa resulta em PASS', () => {
    const decision = decideTaskOutcome(
      { ...command, numericValue: 3 },
      { ...task, expectedMin: 0, expectedMax: 4 },
      null,
    );
    expect(decision.kind).toBe('record');
    if (decision.kind !== 'record') return;
    expect(decision.execution.result).toBe('PASS');
  });

  it('valor fora da faixa resulta em FAIL registrado (não é rejeição)', () => {
    const decision = decideTaskOutcome(
      { ...command, numericValue: 9.5 },
      { ...task, expectedMin: 0, expectedMax: 4 },
      null,
    );
    expect(decision.kind).toBe('record');
    if (decision.kind !== 'record') return;
    expect(decision.execution.result).toBe('FAIL');
    expect(decision.execution.resultingStatus).toBe('DONE');
  });

  it('valor abaixo do mínimo também é FAIL', () => {
    const decision = decideTaskOutcome(
      { ...command, numericValue: -3 },
      { ...task, expectedMin: 0, expectedMax: 4 },
      null,
    );
    if (decision.kind !== 'record') throw new Error('esperava record');
    expect(decision.execution.result).toBe('FAIL');
  });
});

describe('decideTaskOutcome — coerência', () => {
  it('rejeita tarefa inexistente', () => {
    const decision = decideTaskOutcome(command, null, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'TASK_NOT_FOUND' });
  });

  it('rejeita loja divergente', () => {
    const decision = decideTaskOutcome(command, { ...task, storeId: 'store-2' }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'STORE_MISMATCH' });
  });

  it('rejeita data operacional divergente', () => {
    const decision = decideTaskOutcome(command, { ...task, workDate: '2026-07-20' }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'WORK_DATE_MISMATCH' });
  });

  it('rejeita execução sem turno aberto (autoria — ADR-014)', () => {
    const decision = decideTaskOutcome({ ...command, operatorSessionId: '' }, task, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'SESSION_REQUIRED' });
  });

  it('rejeita comando incompleto', () => {
    const decision = decideTaskOutcome({ ...command, deviceId: ' ' }, task, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_COMMAND' });
  });

  it('rejeita horário inválido', () => {
    const decision = decideTaskOutcome(
      { ...command, eventTime: new Date('nao-e-data') },
      task,
      null,
    );
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_COMMAND' });
  });
});

describe('isOverdue', () => {
  const due = new Date('2026-07-21T10:00:00.000Z');

  it('marca atraso quando o vencimento passou', () => {
    expect(isOverdue('PENDING', due, FIXED_NOW)).toBe(true);
  });

  it('não marca atraso antes do vencimento', () => {
    expect(isOverdue('PENDING', due, new Date('2026-07-21T09:00:00.000Z'))).toBe(false);
  });

  it('tarefa resolvida nunca fica atrasada', () => {
    expect(isOverdue('DONE', due, FIXED_NOW)).toBe(false);
    expect(isOverdue('SKIPPED', due, FIXED_NOW)).toBe(false);
  });
});
