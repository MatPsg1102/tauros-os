// Testes dos use cases de Gestão de Equipe — autorização efetiva
// (workforce.write para colaboradores; config.write para posições, ADR-019),
// referências oficiais, idempotência e ordem de efeitos. Sem relógio real,
// sem infraestrutura.

import { describe, expect, it } from 'vitest';

import type {
  CreatePositionEnqueueInput,
  EffectiveAuthorization,
  EmployeeAssignmentRecord,
  EmployeeRecord,
  OperationalPositionRecord,
  RegisterEmployeeEnqueueInput,
  TeamRecord,
  WorkforceAuditInput,
  WorkforceRepositoryPort,
} from '@tauros/contracts';
import {
  CAPABILITY_CONFIG_WRITE,
  CAPABILITY_WORKFORCE_WRITE,
  PERMISSION_MODEL_VERSION,
} from '@tauros/contracts';

import { employeeIdempotencyKeyFor, RegisterEmployeeUseCase } from './register-employee.js';
import { CreateOperationalPositionUseCase } from './create-operational-position.js';

const NOW = new Date('2026-08-13T14:00:00.000Z');
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

interface Harness {
  register: RegisterEmployeeUseCase;
  createPosition: CreateOperationalPositionUseCase;
  employees: EmployeeRecord[];
  assignments: EmployeeAssignmentRecord[];
  positions: OperationalPositionRecord[];
  teams: TeamRecord[];
  enqueuedEmployees: RegisterEmployeeEnqueueInput[];
  enqueuedPositions: CreatePositionEnqueueInput[];
  audits: WorkforceAuditInput[];
  failEnqueue: boolean;
  failSave: boolean;
}

function makeHarness(): Harness {
  const harness: Harness = {
    employees: [],
    assignments: [],
    positions: [
      {
        id: 'pos-acougueiro-1',
        storeId: 'store-1',
        key: 'acougueiro-1',
        name: 'Açougueiro 1',
        clientCreatedAt: NOW.toISOString(),
        idempotencyKey: 'position-baseline:store-1:acougueiro-1',
        syncStatus: 'synced',
        auditCorrelationId: 'pos-acougueiro-1',
      },
    ],
    teams: [
      { id: 'team-a', storeId: 'store-1', name: 'Equipe A' },
      { id: 'team-b', storeId: 'store-1', name: 'Equipe B' },
    ],
    enqueuedEmployees: [],
    enqueuedPositions: [],
    audits: [],
    failEnqueue: false,
    failSave: false,
    register: undefined as unknown as RegisterEmployeeUseCase,
    createPosition: undefined as unknown as CreateOperationalPositionUseCase,
  };
  const repository: WorkforceRepositoryPort = {
    employees: (storeId) =>
      Promise.resolve(harness.employees.filter((employee) => employee.storeId === storeId)),
    employeeByIdempotencyKey: (storeId, key) =>
      Promise.resolve(
        harness.employees.find(
          (employee) => employee.storeId === storeId && employee.idempotencyKey === key,
        ) ?? null,
      ),
    assignments: (storeId) =>
      Promise.resolve(harness.assignments.filter((assignment) => assignment.storeId === storeId)),
    saveRegistration: (employee, assignment) => {
      if (harness.failSave) return Promise.reject(new Error('disk full'));
      harness.employees.push(employee);
      harness.assignments.push(assignment);
      return Promise.resolve();
    },
    updateEmployeeSyncStatus: () => Promise.resolve(),
    teams: (storeId) => Promise.resolve(harness.teams.filter((team) => team.storeId === storeId)),
    saveTeam: (record) => {
      harness.teams.push(record);
      return Promise.resolve();
    },
    positions: (storeId) =>
      Promise.resolve(harness.positions.filter((position) => position.storeId === storeId)),
    positionByKey: (storeId, key) =>
      Promise.resolve(
        harness.positions.find(
          (position) => position.storeId === storeId && position.key === key,
        ) ?? null,
      ),
    savePosition: (record) => {
      if (harness.failSave) return Promise.reject(new Error('disk full'));
      harness.positions.push(record);
      return Promise.resolve();
    },
    updatePositionSyncStatus: () => Promise.resolve(),
  };
  const queue = {
    enqueueRegisterEmployee: (input: RegisterEmployeeEnqueueInput) => {
      if (harness.failEnqueue) return Promise.reject(new Error('queue down'));
      harness.enqueuedEmployees.push(input);
      return Promise.resolve();
    },
    enqueueCreatePosition: (input: CreatePositionEnqueueInput) => {
      if (harness.failEnqueue) return Promise.reject(new Error('queue down'));
      harness.enqueuedPositions.push(input);
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
  harness.register = new RegisterEmployeeUseCase(clock, ids, repository, queue, audit);
  harness.createPosition = new CreateOperationalPositionUseCase(
    clock,
    ids,
    repository,
    queue,
    audit,
  );
  return harness;
}

const registerInput = {
  deviceId: 'device-A',
  storeTimeZone: TZ,
  fullName: 'João da Silva',
  startDate: '2026-08-17',
  positionId: 'pos-acougueiro-1',
  teamId: 'team-a',
  createdOffline: false,
};

describe('RegisterEmployeeUseCase — caminho autorizado', () => {
  it('cadastra pessoa + vínculo, enfileira e audita admin.action', async () => {
    const harness = makeHarness();
    const result = await harness.register.execute({
      authorization: authorization(),
      ...registerInput,
    });
    expect(result.kind).toBe('registered');
    if (result.kind !== 'registered') return;
    expect(result.employee).toMatchObject({
      fullName: 'João da Silva',
      active: true,
      syncStatus: 'queued',
    });
    // matrícula placeholder = id (unicidade honesta até o vertical admin)
    expect(result.employee.registration).toBe(result.employee.id);
    expect(result.assignment).toMatchObject({
      employeeId: result.employee.id,
      teamId: 'team-a',
      operationalPositionId: 'pos-acougueiro-1',
      validFrom: '2026-08-17',
      validUntil: null,
    });
    expect(harness.enqueuedEmployees).toHaveLength(1);
    expect(harness.employees).toHaveLength(1);
    expect(harness.assignments).toHaveLength(1);
    expect(harness.audits.at(-1)).toMatchObject({
      eventType: 'admin.action',
      result: 'success',
      entityType: 'employees',
      entityId: result.employee.id,
    });
  });

  it('usa chave de idempotência determinística e converge no double-submit', async () => {
    const harness = makeHarness();
    const first = await harness.register.execute({
      authorization: authorization(),
      ...registerInput,
    });
    const second = await harness.register.execute({
      authorization: authorization(),
      ...registerInput,
    });
    expect(first.kind).toBe('registered');
    expect(second.kind).toBe('already-registered');
    expect(harness.enqueuedEmployees).toHaveLength(1);
    expect(harness.employees).toHaveLength(1);
    expect(harness.enqueuedEmployees[0]?.employee.idempotencyKey).toBe(
      employeeIdempotencyKeyFor('store-1', '2026-08-13', 'emp-0004', 'João da Silva'),
    );
  });

  it('cadastro offline marca a origem na auditoria', async () => {
    const harness = makeHarness();
    await harness.register.execute({
      authorization: authorization({ origin: 'offline-snapshot' }),
      ...registerInput,
      createdOffline: true,
    });
    expect(harness.audits.at(-1)?.source).toBe('client-offline');
  });
});

describe('RegisterEmployeeUseCase — autorização e referências', () => {
  it('nega sem workforce.write e audita access.denied (config.write NÃO basta)', async () => {
    const harness = makeHarness();
    const result = await harness.register.execute({
      authorization: authorization({ permissions: [CAPABILITY_CONFIG_WRITE, 'audit.read'] }),
      ...registerInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(harness.audits.at(-1)).toMatchObject({
      eventType: 'access.denied',
      errorCode: CAPABILITY_WORKFORCE_WRITE,
    });
    expect(harness.enqueuedEmployees).toHaveLength(0);
  });

  it('rejeita snapshot expirado', async () => {
    const harness = makeHarness();
    const result = await harness.register.execute({
      authorization: authorization({ validUntil: new Date(NOW.getTime() - 1) }),
      ...registerInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_EXPIRED' });
  });

  it('rejeita posição e equipe inexistentes na loja (ID oficial)', async () => {
    const harness = makeHarness();
    expect(
      await harness.register.execute({
        authorization: authorization(),
        ...registerInput,
        positionId: 'pos-inventada',
      }),
    ).toMatchObject({ kind: 'failed', code: 'UNKNOWN_POSITION' });
    expect(
      await harness.register.execute({
        authorization: authorization(),
        ...registerInput,
        teamId: 'team-z',
      }),
    ).toMatchObject({ kind: 'failed', code: 'UNKNOWN_TEAM' });
    expect(harness.enqueuedEmployees).toHaveLength(0);
  });

  it('rejeita nome vazio e data inválida', async () => {
    const harness = makeHarness();
    expect(
      await harness.register.execute({
        authorization: authorization(),
        ...registerInput,
        fullName: '   ',
      }),
    ).toMatchObject({ kind: 'failed', code: 'NAME_REQUIRED' });
    expect(
      await harness.register.execute({
        authorization: authorization(),
        ...registerInput,
        startDate: '17/08/2026',
      }),
    ).toMatchObject({ kind: 'failed', code: 'INVALID_DATE' });
  });
});

describe('RegisterEmployeeUseCase — falhas intermediárias', () => {
  it('falha de fila não persiste nada e audita a falha', async () => {
    const harness = makeHarness();
    harness.failEnqueue = true;
    const result = await harness.register.execute({
      authorization: authorization(),
      ...registerInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'ENQUEUE_FAILED' });
    expect(harness.employees).toHaveLength(0);
    expect(harness.audits.at(-1)).toMatchObject({ result: 'failure', errorCode: 'ENQUEUE_FAILED' });
  });

  it('falha de persistência mantém a intenção durável enfileirada (recuperável)', async () => {
    const harness = makeHarness();
    harness.failSave = true;
    const result = await harness.register.execute({
      authorization: authorization(),
      ...registerInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERSISTENCE_FAILED' });
    expect(harness.enqueuedEmployees).toHaveLength(1);
  });
});

describe('CreateOperationalPositionUseCase', () => {
  it('cria posição com chave natural, enfileira e audita config.changed', async () => {
    const harness = makeHarness();
    const result = await harness.createPosition.execute({
      authorization: authorization(),
      deviceId: 'device-A',
      name: 'Balconista de Frios',
      createdOffline: false,
    });
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.position).toMatchObject({
      name: 'Balconista de Frios',
      key: 'balconista-de-frios',
      syncStatus: 'queued',
    });
    expect(harness.enqueuedPositions).toHaveLength(1);
    expect(harness.audits.at(-1)).toMatchObject({
      eventType: 'config.changed',
      result: 'success',
      entityType: 'operational_positions',
    });
  });

  it('nome repetido converge para a posição existente (unique congelado)', async () => {
    const harness = makeHarness();
    const result = await harness.createPosition.execute({
      authorization: authorization(),
      deviceId: 'device-A',
      name: 'Açougueiro 1',
      createdOffline: false,
    });
    expect(result.kind).toBe('already-created');
    if (result.kind !== 'already-created') return;
    expect(result.position.id).toBe('pos-acougueiro-1');
    expect(harness.enqueuedPositions).toHaveLength(0);
  });

  it('nega sem config.write (workforce.write NÃO basta — ADR-019)', async () => {
    const harness = makeHarness();
    const result = await harness.createPosition.execute({
      authorization: authorization({ permissions: [CAPABILITY_WORKFORCE_WRITE] }),
      deviceId: 'device-A',
      name: 'Balconista',
      createdOffline: false,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(harness.audits.at(-1)).toMatchObject({
      eventType: 'access.denied',
      errorCode: CAPABILITY_CONFIG_WRITE,
    });
  });

  it('rejeita nome vazio', async () => {
    const harness = makeHarness();
    const result = await harness.createPosition.execute({
      authorization: authorization(),
      deviceId: 'device-A',
      name: '   ',
      createdOffline: false,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'NAME_REQUIRED' });
  });
});
