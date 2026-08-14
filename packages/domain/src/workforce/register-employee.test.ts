// Testes do domínio de cadastro de colaborador — invariantes puras.

import { describe, expect, it } from 'vitest';

import { decideRegisterEmployee, type RegisterEmployeeCommand } from './register-employee.js';

const NOW = new Date('2026-08-13T14:00:00.000Z');

const command: RegisterEmployeeCommand = {
  employeeId: 'emp-1',
  assignmentId: 'asg-1',
  storeId: 'store-1',
  fullName: 'João da Silva',
  startDate: '2026-08-17',
  positionId: 'pos-acougueiro-1',
  teamId: 'team-a',
  shiftDefinitionId: 'def-0730',
  clientCreatedAt: NOW,
  idempotencyKey: 'employee-register:store-1:x',
};

describe('decideRegisterEmployee', () => {
  it('cadastra colaborador ativo com vínculo temporal aberto', () => {
    const decision = decideRegisterEmployee(command, null);
    expect(decision.kind).toBe('register');
    if (decision.kind !== 'register') return;
    expect(decision.employee).toMatchObject({
      id: 'emp-1',
      fullName: 'João da Silva',
      active: true,
    });
    // equipe, posição e JORNADA são campos SEPARADOS do vínculo — nunca um
    // nome composto nem um horário embutido na equipe
    expect(decision.assignment).toMatchObject({
      employeeId: 'emp-1',
      teamId: 'team-a',
      operationalPositionId: 'pos-acougueiro-1',
      shiftDefinitionId: 'def-0730',
      validFrom: '2026-08-17',
      validUntil: null,
    });
  });

  it('normaliza o nome (trim) e rejeita nome só de espaços', () => {
    const trimmed = decideRegisterEmployee({ ...command, fullName: '  Ana Prado  ' }, null);
    expect(trimmed.kind).toBe('register');
    if (trimmed.kind === 'register') expect(trimmed.employee.fullName).toBe('Ana Prado');

    expect(decideRegisterEmployee({ ...command, fullName: '   ' }, null)).toMatchObject({
      kind: 'rejected',
      code: 'NAME_REQUIRED',
    });
  });

  it('rejeita data de início fora do formato civil', () => {
    expect(decideRegisterEmployee({ ...command, startDate: '17/08/2026' }, null)).toMatchObject({
      kind: 'rejected',
      code: 'INVALID_DATE',
    });
  });

  it('rejeita cadastro sem posição ou sem equipe', () => {
    expect(decideRegisterEmployee({ ...command, positionId: ' ' }, null)).toMatchObject({
      kind: 'rejected',
      code: 'POSITION_REQUIRED',
    });
    expect(decideRegisterEmployee({ ...command, teamId: '' }, null)).toMatchObject({
      kind: 'rejected',
      code: 'TEAM_REQUIRED',
    });
  });

  it('reapresentação com a mesma chave converge para o MESMO cadastro', () => {
    expect(decideRegisterEmployee(command, 'emp-existente')).toEqual({
      kind: 'already-registered',
      employeeId: 'emp-existente',
    });
  });
});
