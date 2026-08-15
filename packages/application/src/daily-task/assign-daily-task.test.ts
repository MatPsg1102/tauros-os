// Testes do use case de atribuição situacional — autorização efetiva,
// validação de posição, idempotência e a regra central: atribuir a ocorrência
// de hoje NÃO altera o template.

import { describe, expect, it } from 'vitest';

import type {
  DailyTaskAssignEnqueueInput,
  DailyTaskAuditInput,
  DailyTaskRecord,
  EffectiveAuthorization,
  OperationalPositionView,
} from '@tauros/contracts';
import { CAPABILITY_CONFIG_WRITE, PERMISSION_MODEL_VERSION } from '@tauros/contracts';

import { AssignDailyTaskUseCase } from './assign-daily-task.js';

const NOW = new Date('2026-08-13T14:00:00.000Z');

function authorization(over: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-4',
    operatorEmployeeId: 'emp-4',
    storeId: 'store-1',
    sessionId: 'platform:prof-4',
    permissions: [CAPABILITY_CONFIG_WRITE, 'audit.read'],
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: undefined,
    validUntil: new Date(NOW.getTime() + 3_600_000),
    origin: 'online',
    ...over,
  };
}

const positions: readonly OperationalPositionView[] = [
  { id: 'pos-atendimento', key: 'atendimento', name: 'Atendimento' },
  { id: 'pos-apoio', key: 'apoio', name: 'Apoio' },
];

function task(over: Partial<DailyTaskRecord> = {}): DailyTaskRecord {
  return {
    id: 'daily-task:store-1:2026-08-13:tpl-x',
    storeId: 'store-1',
    templateId: 'tpl-x',
    workDate: '2026-08-13',
    plannedStartAt: null,
    dueAt: '2026-08-13T20:00:00.000Z',
    status: 'PENDING',
    assignedPositionId: null,
    expectedMinSnapshot: null,
    expectedMaxSnapshot: null,
    configVersionRef: null,
    template: {
      templateId: 'tpl-x',
      title: 'Conferir estoque',
      frequency: 'CUSTOM',
      requiresPhoto: false,
      expectedMin: null,
      expectedMax: null,
      targetPositionId: null,
      dueOffsetMinutes: 120,
    },
    lastExecutionId: null,
    syncStatus: null,
    ...over,
  };
}

function makeHarness(initial: DailyTaskRecord = task()) {
  const tasks = new Map<string, DailyTaskRecord>([[initial.id, initial]]);
  const enqueued: DailyTaskAssignEnqueueInput[] = [];
  const audits: DailyTaskAuditInput[] = [];
  const repository = {
    byWorkDate: () => Promise.resolve([...tasks.values()]),
    byId: (id: string) => Promise.resolve(tasks.get(id) ?? null),
    saveAll: () => Promise.resolve(),
    save: (record: DailyTaskRecord) => {
      tasks.set(record.id, record);
      return Promise.resolve();
    },
    executionByIdempotencyKey: () => Promise.resolve(null),
    executionById: () => Promise.resolve(null),
    saveExecution: () => Promise.resolve(),
    updateExecutionSyncStatus: () => Promise.resolve(),
    attachExecutionReview: () => Promise.resolve(),
  };
  const useCase = new AssignDailyTaskUseCase(
    { now: () => NOW },
    { uuid: () => 'q-1' },
    { positions: () => Promise.resolve(positions), members: () => Promise.resolve([]) },
    repository,
    { enqueueAssignDailyTask: (i) => (enqueued.push(i), Promise.resolve()) },
    { record: (i) => (audits.push(i), Promise.resolve()) },
  );
  return { tasks, enqueued, audits, useCase };
}

const base = {
  deviceId: 'device-A',
  dailyTaskId: 'daily-task:store-1:2026-08-13:tpl-x',
  positionId: 'pos-atendimento',
  assignedOffline: false,
};

describe('AssignDailyTaskUseCase', () => {
  it('atribui a ocorrência, enfileira e persiste (responsável efetivo muda)', async () => {
    const h = makeHarness();
    const result = await h.useCase.execute({ authorization: authorization(), ...base });
    expect(result.kind).toBe('assigned');
    if (result.kind !== 'assigned') return;
    expect(result.dailyTask.assignedPositionId).toBe('pos-atendimento');
    expect(h.enqueued).toHaveLength(1);
    expect(h.tasks.get(base.dailyTaskId)?.assignedPositionId).toBe('pos-atendimento');
  });

  it('atribuir a ocorrência NÃO altera o template (targetPositionId segue null)', async () => {
    const h = makeHarness();
    await h.useCase.execute({ authorization: authorization(), ...base });
    expect(h.tasks.get(base.dailyTaskId)?.template.targetPositionId).toBeNull();
  });

  it('sem config.write ⇒ negado + access.denied, nada enfileirado', async () => {
    const h = makeHarness();
    const result = await h.useCase.execute({
      authorization: authorization({ permissions: ['audit.read'] }),
      ...base,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(h.enqueued).toHaveLength(0);
    expect(h.audits.at(-1)).toMatchObject({ eventType: 'access.denied', result: 'rejected' });
  });

  it('posição inexistente ⇒ UNKNOWN_POSITION', async () => {
    const h = makeHarness();
    const result = await h.useCase.execute({
      authorization: authorization(),
      ...base,
      positionId: 'pos-inventada',
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'UNKNOWN_POSITION' });
  });

  it('reatribuir à MESMA posição converge (idempotente)', async () => {
    const h = makeHarness(task({ assignedPositionId: 'pos-atendimento' }));
    const result = await h.useCase.execute({ authorization: authorization(), ...base });
    expect(result.kind).toBe('already-assigned');
    expect(h.enqueued).toHaveLength(0);
  });

  it('não atribui ocorrência já concluída', async () => {
    const h = makeHarness(task({ status: 'DONE' }));
    const result = await h.useCase.execute({ authorization: authorization(), ...base });
    expect(result).toMatchObject({ kind: 'failed', code: 'NOT_ASSIGNABLE' });
  });
});
