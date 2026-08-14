// Testes de jornada — criação (janela como dado) e troca com vigência.

import { describe, expect, it } from 'vitest';

import {
  decideCreateShiftDefinition,
  type CreateShiftDefinitionCommand,
} from './create-shift-definition.js';
import { decideChangeWorkPeriod, previousCivilDay } from './change-work-period.js';

const NOW = new Date('2026-08-13T14:00:00.000Z');

const command: CreateShiftDefinitionCommand = {
  definitionId: 'def-1',
  storeId: 'store-1',
  name: '',
  startTime: '07:30',
  endTime: '19:30',
  clientCreatedAt: NOW,
  idempotencyKey: 'shift-definition-create:store-1:07:30-19:30',
};

describe('decideCreateShiftDefinition', () => {
  it('cria jornada com nome derivado da janela quando não informado', () => {
    const decision = decideCreateShiftDefinition(command, null);
    expect(decision.kind).toBe('create');
    if (decision.kind !== 'create') return;
    expect(decision.definition).toMatchObject({
      name: '07:30–19:30',
      startTime: '07:30',
      endTime: '19:30',
    });
  });

  it('aceita nome próprio e qualquer janela válida (ex.: 06:00–18:00)', () => {
    const decision = decideCreateShiftDefinition(
      { ...command, name: 'Turno abertura', startTime: '06:00', endTime: '18:00' },
      null,
    );
    if (decision.kind === 'create') {
      expect(decision.definition.name).toBe('Turno abertura');
    }
    expect(decision.kind).toBe('create');
  });

  it('rejeita horário fora de HH:MM e janela vazia', () => {
    expect(decideCreateShiftDefinition({ ...command, startTime: '25:00' }, null)).toMatchObject({
      kind: 'rejected',
      code: 'INVALID_TIME',
    });
    expect(
      decideCreateShiftDefinition({ ...command, startTime: '07:30', endTime: '07:30' }, null),
    ).toMatchObject({ kind: 'rejected', code: 'EMPTY_WINDOW' });
  });

  it('mesma janela na loja converge para a jornada existente', () => {
    expect(decideCreateShiftDefinition(command, 'def-existente')).toEqual({
      kind: 'already-created',
      definitionId: 'def-existente',
    });
  });
});

describe('decideChangeWorkPeriod', () => {
  const current = {
    id: 'asg-1',
    storeId: 'store-1',
    employeeId: 'emp-1',
    teamId: 'team-a',
    positionId: 'pos-x',
    shiftDefinitionId: 'def-0730',
    validFrom: '2026-08-01',
  };

  it('fecha o vínculo vigente na véspera e abre o novo — histórico preservado', () => {
    const decision = decideChangeWorkPeriod({
      newAssignmentId: 'asg-2',
      current,
      newShiftDefinitionId: 'def-0830',
      changeDate: '2026-08-20',
    });
    expect(decision.kind).toBe('change');
    if (decision.kind !== 'change') return;
    expect(decision.closed).toEqual({ assignmentId: 'asg-1', validUntil: '2026-08-19' });
    // equipe e posição NÃO mudam ao trocar jornada
    expect(decision.opened).toMatchObject({
      teamId: 'team-a',
      positionId: 'pos-x',
      shiftDefinitionId: 'def-0830',
      validFrom: '2026-08-20',
      validUntil: null,
    });
  });

  it('jornada igual à vigente converge (already-applied)', () => {
    expect(
      decideChangeWorkPeriod({
        newAssignmentId: 'asg-2',
        current,
        newShiftDefinitionId: 'def-0730',
        changeDate: '2026-08-20',
      }),
    ).toEqual({ kind: 'already-applied', assignmentId: 'asg-1' });
  });

  it('sem vínculo vigente é rejeitado', () => {
    expect(
      decideChangeWorkPeriod({
        newAssignmentId: 'asg-2',
        current: null,
        newShiftDefinitionId: 'def-0830',
        changeDate: '2026-08-20',
      }),
    ).toMatchObject({ kind: 'rejected', code: 'NO_CURRENT_ASSIGNMENT' });
  });

  it('véspera civil cruza mês e ano corretamente', () => {
    expect(previousCivilDay('2026-09-01')).toBe('2026-08-31');
    expect(previousCivilDay('2027-01-01')).toBe('2026-12-31');
  });
});
