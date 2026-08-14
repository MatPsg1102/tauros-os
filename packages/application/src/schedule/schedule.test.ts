// Testes dos use cases de Escala Operacional — jornada como config
// (config.write), troca de jornada como vínculo (workforce.write), e a fonte
// oficial de presença planejada resolvendo LOJAS DIFERENTES com padrões
// diferentes no MESMO domínio (prova anti-acoplamento ao nosso açougue).

import { describe, expect, it } from 'vitest';

import type {
  ChangeWorkPeriodEnqueueInput,
  CreateShiftDefinitionEnqueueInput,
  EffectiveAuthorization,
  EmployeeAssignmentRecord,
  EmployeeRecord,
  OperationalPositionRecord,
  ScheduleRepositoryPort,
  ShiftDefinitionRecord,
  ShiftPatternRecord,
  TeamRecord,
  WorkforceAuditInput,
  WorkforceRepositoryPort,
} from '@tauros/contracts';
import {
  CAPABILITY_CONFIG_WRITE,
  CAPABILITY_WORKFORCE_WRITE,
  PERMISSION_MODEL_VERSION,
} from '@tauros/contracts';

import { ChangeEmployeeWorkPeriodUseCase } from './change-employee-work-period.js';
import { CreateShiftDefinitionUseCase } from './create-shift-definition.js';
import { LoadPlannedScheduleUseCase } from './load-planned-schedule.js';

const NOW = new Date('2026-08-17T14:00:00.000Z'); // 11:00 na loja (17/08)
const TZ = 'America/Sao_Paulo';

function authorization(overrides: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-0004',
    operatorEmployeeId: 'emp-0004',
    storeId: 'store-1',
    sessionId: 'platform:prof-0004',
    permissions: [CAPABILITY_WORKFORCE_WRITE, CAPABILITY_CONFIG_WRITE, 'audit.read'],
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: undefined,
    validUntil: new Date(NOW.getTime() + 3_600_000),
    origin: 'online',
    ...overrides,
  };
}

function definition(
  id: string,
  storeId: string,
  startTime: string,
  endTime: string,
): ShiftDefinitionRecord {
  return {
    id,
    storeId,
    name: `${startTime}–${endTime}`,
    startTime,
    endTime,
    clientCreatedAt: NOW.toISOString(),
    idempotencyKey: `shift-definition-baseline:${storeId}:${startTime}-${endTime}`,
    syncStatus: 'synced',
    auditCorrelationId: id,
  };
}

interface Harness {
  createDefinition: CreateShiftDefinitionUseCase;
  changeWorkPeriod: ChangeEmployeeWorkPeriodUseCase;
  loadPlanned: LoadPlannedScheduleUseCase;
  employees: EmployeeRecord[];
  assignments: EmployeeAssignmentRecord[];
  teams: TeamRecord[];
  positions: OperationalPositionRecord[];
  definitions: ShiftDefinitionRecord[];
  patterns: ShiftPatternRecord[];
  enqueuedDefinitions: CreateShiftDefinitionEnqueueInput[];
  enqueuedChanges: ChangeWorkPeriodEnqueueInput[];
  audits: WorkforceAuditInput[];
}

function makeHarness(): Harness {
  const harness: Harness = {
    employees: [
      {
        id: 'emp-1',
        storeId: 'store-1',
        registration: 'emp-1',
        fullName: 'João da Silva',
        active: true,
        clientCreatedAt: NOW.toISOString(),
        idempotencyKey: 'k-emp-1',
        syncStatus: 'synced',
        auditCorrelationId: 'emp-1',
      },
      {
        id: 'emp-2',
        storeId: 'store-1',
        registration: 'emp-2',
        fullName: 'Paula Souza',
        active: true,
        clientCreatedAt: NOW.toISOString(),
        idempotencyKey: 'k-emp-2',
        syncStatus: 'synced',
        auditCorrelationId: 'emp-2',
      },
      {
        id: 'emp-b1',
        storeId: 'store-2',
        registration: 'emp-b1',
        fullName: 'Bruno Lima',
        active: true,
        clientCreatedAt: NOW.toISOString(),
        idempotencyKey: 'k-emp-b1',
        syncStatus: 'synced',
        auditCorrelationId: 'emp-b1',
      },
    ],
    assignments: [
      // loja 1 — MESMA equipe, jornadas diferentes
      {
        id: 'asg-1',
        storeId: 'store-1',
        employeeId: 'emp-1',
        teamId: 'team-a',
        operationalPositionId: 'pos-1',
        shiftDefinitionId: 'def-0730',
        validFrom: '2026-08-01',
        validUntil: null,
      },
      {
        id: 'asg-2',
        storeId: 'store-1',
        employeeId: 'emp-2',
        teamId: 'team-a',
        operationalPositionId: 'pos-caixa',
        shiftDefinitionId: 'def-0830',
        validFrom: '2026-08-01',
        validUntil: null,
      },
      // loja 2 — outra operação
      {
        id: 'asg-b1',
        storeId: 'store-2',
        employeeId: 'emp-b1',
        teamId: 'team-unica',
        operationalPositionId: 'pos-b',
        shiftDefinitionId: 'def-0800',
        validFrom: '2026-08-01',
        validUntil: null,
      },
    ],
    teams: [
      { id: 'team-a', storeId: 'store-1', name: 'Equipe A', rotationOffset: 0 },
      { id: 'team-b', storeId: 'store-1', name: 'Equipe B', rotationOffset: 1 },
      { id: 'team-unica', storeId: 'store-2', name: 'Equipe Única', rotationOffset: 0 },
    ],
    positions: [
      {
        id: 'pos-1',
        storeId: 'store-1',
        key: 'pos-1',
        name: 'Açougueiro 1',
        clientCreatedAt: NOW.toISOString(),
        idempotencyKey: 'k-pos-1',
        syncStatus: 'synced',
        auditCorrelationId: 'pos-1',
      },
      {
        id: 'pos-caixa',
        storeId: 'store-1',
        key: 'pos-caixa',
        name: 'Operador de caixa',
        clientCreatedAt: NOW.toISOString(),
        idempotencyKey: 'k-pos-caixa',
        syncStatus: 'synced',
        auditCorrelationId: 'pos-caixa',
      },
      {
        id: 'pos-b',
        storeId: 'store-2',
        key: 'pos-b',
        name: 'Balconista',
        clientCreatedAt: NOW.toISOString(),
        idempotencyKey: 'k-pos-b',
        syncStatus: 'synced',
        auditCorrelationId: 'pos-b',
      },
    ],
    definitions: [
      definition('def-0730', 'store-1', '07:30', '19:30'),
      definition('def-0830', 'store-1', '08:30', '20:30'),
      definition('def-0800', 'store-2', '08:00', '17:00'),
    ],
    patterns: [
      {
        id: 'pat-rot',
        storeId: 'store-1',
        name: '12x36',
        effectiveFrom: null,
        effectiveUntil: null,
        days: [
          { dayIndex: 0, works: true },
          { dayIndex: 1, works: false },
        ],
      },
      {
        id: 'pat-week',
        storeId: 'store-2',
        name: 'Segunda a sexta',
        effectiveFrom: null,
        effectiveUntil: null,
        days: [
          { dayIndex: 0, works: true },
          { dayIndex: 1, works: true },
          { dayIndex: 2, works: true },
          { dayIndex: 3, works: true },
          { dayIndex: 4, works: true },
          { dayIndex: 5, works: false },
          { dayIndex: 6, works: false },
        ],
      },
    ],
    enqueuedDefinitions: [],
    enqueuedChanges: [],
    audits: [],
    createDefinition: undefined as unknown as CreateShiftDefinitionUseCase,
    changeWorkPeriod: undefined as unknown as ChangeEmployeeWorkPeriodUseCase,
    loadPlanned: undefined as unknown as LoadPlannedScheduleUseCase,
  };

  const workforce: WorkforceRepositoryPort = {
    employees: (storeId) =>
      Promise.resolve(harness.employees.filter((employee) => employee.storeId === storeId)),
    employeeByIdempotencyKey: () => Promise.resolve(null),
    assignments: (storeId) =>
      Promise.resolve(harness.assignments.filter((assignment) => assignment.storeId === storeId)),
    saveRegistration: () => Promise.resolve(),
    saveAssignment: (record) => {
      const index = harness.assignments.findIndex((assignment) => assignment.id === record.id);
      if (index >= 0) harness.assignments[index] = record;
      else harness.assignments.push(record);
      return Promise.resolve();
    },
    updateEmployeeSyncStatus: () => Promise.resolve(),
    teams: (storeId) => Promise.resolve(harness.teams.filter((team) => team.storeId === storeId)),
    saveTeam: () => Promise.resolve(),
    positions: (storeId) =>
      Promise.resolve(harness.positions.filter((position) => position.storeId === storeId)),
    positionByKey: () => Promise.resolve(null),
    savePosition: () => Promise.resolve(),
    updatePositionSyncStatus: () => Promise.resolve(),
  };
  const schedule: ScheduleRepositoryPort = {
    definitions: (storeId) =>
      Promise.resolve(harness.definitions.filter((definition) => definition.storeId === storeId)),
    definitionByWindow: (storeId, startTime, endTime) =>
      Promise.resolve(
        harness.definitions.find(
          (candidate) =>
            candidate.storeId === storeId &&
            candidate.startTime === startTime &&
            candidate.endTime === endTime,
        ) ?? null,
      ),
    saveDefinition: (record) => {
      harness.definitions.push(record);
      return Promise.resolve();
    },
    updateDefinitionSyncStatus: () => Promise.resolve(),
    patterns: (storeId) =>
      Promise.resolve(harness.patterns.filter((pattern) => pattern.storeId === storeId)),
    savePattern: (record) => {
      harness.patterns.push(record);
      return Promise.resolve();
    },
  };
  const queue = {
    enqueueCreateShiftDefinition: (input: CreateShiftDefinitionEnqueueInput) => {
      harness.enqueuedDefinitions.push(input);
      return Promise.resolve();
    },
    enqueueChangeWorkPeriod: (input: ChangeWorkPeriodEnqueueInput) => {
      harness.enqueuedChanges.push(input);
      return Promise.resolve();
    },
  };
  const audit = {
    record: (input: WorkforceAuditInput) => {
      harness.audits.push(input);
      return Promise.resolve();
    },
  };
  let counter = 0;
  const clock = { now: () => NOW };
  const ids = { uuid: () => `uuid-${String(++counter).padStart(2, '0')}` };
  harness.createDefinition = new CreateShiftDefinitionUseCase(clock, ids, schedule, queue, audit);
  harness.changeWorkPeriod = new ChangeEmployeeWorkPeriodUseCase(
    clock,
    ids,
    workforce,
    schedule,
    queue,
    audit,
  );
  harness.loadPlanned = new LoadPlannedScheduleUseCase(clock, workforce, schedule);
  return harness;
}

describe('CreateShiftDefinitionUseCase', () => {
  it('cria jornada nova (ex.: 06:00–18:00), enfileira e audita config.changed', async () => {
    const harness = makeHarness();
    const result = await harness.createDefinition.execute({
      authorization: authorization(),
      deviceId: 'device-A',
      name: '',
      startTime: '06:00',
      endTime: '18:00',
      createdOffline: false,
    });
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.definition).toMatchObject({
      name: '06:00–18:00',
      startTime: '06:00',
      endTime: '18:00',
      syncStatus: 'queued',
    });
    expect(harness.enqueuedDefinitions).toHaveLength(1);
    expect(harness.audits.at(-1)).toMatchObject({
      eventType: 'config.changed',
      entityType: 'shift_definitions',
      result: 'success',
    });
  });

  it('mesma janela converge para a jornada existente', async () => {
    const harness = makeHarness();
    const result = await harness.createDefinition.execute({
      authorization: authorization(),
      deviceId: 'device-A',
      name: 'Qualquer nome',
      startTime: '07:30',
      endTime: '19:30',
      createdOffline: false,
    });
    expect(result.kind).toBe('already-created');
    if (result.kind === 'already-created') expect(result.definition.id).toBe('def-0730');
    expect(harness.enqueuedDefinitions).toHaveLength(0);
  });

  it('nega sem config.write (workforce.write NÃO basta — jornada é config)', async () => {
    const harness = makeHarness();
    const result = await harness.createDefinition.execute({
      authorization: authorization({ permissions: [CAPABILITY_WORKFORCE_WRITE] }),
      deviceId: 'device-A',
      name: '',
      startTime: '06:00',
      endTime: '18:00',
      createdOffline: false,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(harness.audits.at(-1)).toMatchObject({
      eventType: 'access.denied',
      errorCode: CAPABILITY_CONFIG_WRITE,
    });
  });
});

describe('ChangeEmployeeWorkPeriodUseCase', () => {
  it('troca preservando histórico: fecha o vigente na véspera e abre o novo', async () => {
    const harness = makeHarness();
    const result = await harness.changeWorkPeriod.execute({
      authorization: authorization(),
      deviceId: 'device-A',
      storeTimeZone: TZ,
      employeeId: 'emp-1',
      shiftDefinitionId: 'def-0830',
      changedOffline: false,
    });
    expect(result.kind).toBe('changed');
    if (result.kind !== 'changed') return;
    expect(result.closedAssignment).toMatchObject({ id: 'asg-1', validUntil: '2026-08-16' });
    expect(result.openedAssignment).toMatchObject({
      teamId: 'team-a',
      operationalPositionId: 'pos-1',
      shiftDefinitionId: 'def-0830',
      validFrom: '2026-08-17',
      validUntil: null,
    });
    // histórico intacto: dois vínculos, nenhum sobrescrito
    const joao = harness.assignments.filter((assignment) => assignment.employeeId === 'emp-1');
    expect(joao).toHaveLength(2);
    expect(harness.enqueuedChanges).toHaveLength(1);
    expect(harness.audits.at(-1)).toMatchObject({
      eventType: 'admin.action',
      entityType: 'employee_assignments',
      result: 'success',
    });
  });

  it('jornada igual à vigente converge sem efeitos', async () => {
    const harness = makeHarness();
    const result = await harness.changeWorkPeriod.execute({
      authorization: authorization(),
      deviceId: 'device-A',
      storeTimeZone: TZ,
      employeeId: 'emp-1',
      shiftDefinitionId: 'def-0730',
      changedOffline: false,
    });
    expect(result.kind).toBe('already-applied');
    expect(harness.enqueuedChanges).toHaveLength(0);
  });

  it('nega sem workforce.write (config.write NÃO basta — vínculo é RH)', async () => {
    const harness = makeHarness();
    const result = await harness.changeWorkPeriod.execute({
      authorization: authorization({ permissions: [CAPABILITY_CONFIG_WRITE] }),
      deviceId: 'device-A',
      storeTimeZone: TZ,
      employeeId: 'emp-1',
      shiftDefinitionId: 'def-0830',
      changedOffline: false,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
  });
});

describe('LoadPlannedScheduleUseCase — fonte oficial multiloja', () => {
  it('loja 1 (12x36): equipe do dia com jornadas PRÓPRIAS distintas', async () => {
    const harness = makeHarness();
    const result = await harness.loadPlanned.execute({
      authorization: authorization(),
      storeAnchorDate: '2026-08-17',
      operationalDates: ['2026-08-17', '2026-08-18'],
    });
    expect(result.kind).toBe('loaded');
    if (result.kind !== 'loaded') return;
    const [today, tomorrow] = result.days;
    expect(today?.status).toBe('resolved');
    expect(today?.patternName).toBe('12x36');
    expect(today?.scheduledTeams).toEqual([{ teamId: 'team-a', teamName: 'Equipe A' }]);
    const byId = new Map(today?.employees.map((employee) => [employee.employeeId, employee]));
    expect(byId.get('emp-1')?.workPeriod).toMatchObject({ startTime: '07:30', endTime: '19:30' });
    expect(byId.get('emp-2')?.workPeriod).toMatchObject({ startTime: '08:30', endTime: '20:30' });
    expect(byId.get('emp-1')?.positionName).toBe('Açougueiro 1');
    // dia seguinte: rotação alterna para a Equipe B (sem colaboradores nela)
    expect(tomorrow?.scheduledTeams).toEqual([{ teamId: 'team-b', teamName: 'Equipe B' }]);
    expect(tomorrow?.employees).toHaveLength(0);
  });

  it('loja 2 usa padrão semanal SEM alterar código — MESMO use case/resolver', async () => {
    const harness = makeHarness();
    const result = await harness.loadPlanned.execute({
      authorization: authorization({ storeId: 'store-2' }),
      storeAnchorDate: '2026-08-17', // segunda-feira
      operationalDates: ['2026-08-18', '2026-08-22'], // terça e sábado
    });
    expect(result.kind).toBe('loaded');
    if (result.kind !== 'loaded') return;
    const [tuesday, saturday] = result.days;
    expect(tuesday?.patternName).toBe('Segunda a sexta');
    expect(tuesday?.scheduledTeams).toEqual([{ teamId: 'team-unica', teamName: 'Equipe Única' }]);
    expect(tuesday?.employees[0]).toMatchObject({
      fullName: 'Bruno Lima',
      workPeriod: { startTime: '08:00', endTime: '17:00' },
    });
    expect(saturday?.scheduledTeams).toEqual([]);
    expect(saturday?.employees).toEqual([]);
  });

  it('loja sem âncora resolve como unconfigured explícito', async () => {
    const harness = makeHarness();
    const result = await harness.loadPlanned.execute({
      authorization: authorization(),
      storeAnchorDate: null,
      operationalDates: ['2026-08-17'],
    });
    if (result.kind === 'loaded') {
      expect(result.days[0]).toMatchObject({ status: 'unconfigured', employees: [] });
    }
    expect(result.kind).toBe('loaded');
  });
});
