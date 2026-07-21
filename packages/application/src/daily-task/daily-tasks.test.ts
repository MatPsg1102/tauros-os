// Testes dos use cases do quadro de tarefas (7.2): materialização
// idempotente, autorização efetiva, desfechos append-only e recuperação.

import { describe, expect, it } from 'vitest';

import type {
  DailyTaskRecord,
  EffectiveAuthorization,
  TaskExecutionEnqueueInput,
  TaskExecutionRecord,
  TaskTemplateSnapshot,
} from '@tauros/contracts';
import { PERMISSION_MODEL_VERSION } from '@tauros/contracts';

import { LoadDailyTasksUseCase, dailyTaskIdFor } from './load-daily-tasks.js';
import { RecordTaskOutcomeUseCase, taskOutcomeIdempotencyKeyFor } from './record-task-outcome.js';

const DAY_START = new Date('2026-07-21T10:30:00.000Z');
const NOW = new Date('2026-07-21T12:00:00.000Z');
const WORK_DATE = '2026-07-21';

function authorization(overrides: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-1',
    operatorEmployeeId: 'emp-1',
    storeId: 'store-1',
    sessionId: 'platform:prof-1',
    permissions: ['session.open', 'session.close'],
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: undefined,
    validUntil: new Date(NOW.getTime() + 3_600_000),
    origin: 'online',
    ...overrides,
  };
}

const templates: readonly TaskTemplateSnapshot[] = [
  {
    templateId: 'tpl-temp',
    title: 'Registrar temperatura da câmara fria',
    frequency: 'DAILY',
    requiresPhoto: false,
    expectedMin: -2,
    expectedMax: 4,
    targetPositionId: null,
    dueOffsetMinutes: 60,
  },
  {
    templateId: 'tpl-limpeza',
    title: 'Higienizar bancada de manipulação',
    frequency: 'DAILY',
    requiresPhoto: true,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: null,
    dueOffsetMinutes: 30,
  },
];

interface Repo {
  tasks: Map<string, DailyTaskRecord>;
  executions: Map<string, TaskExecutionRecord>;
  failSaveAll: boolean;
  failSaveExecution: boolean;
}

function makeRepo(): Repo {
  return {
    tasks: new Map(),
    executions: new Map(),
    failSaveAll: false,
    failSaveExecution: false,
  };
}

function repositoryPort(repo: Repo) {
  return {
    byWorkDate: (storeId: string, workDate: string) =>
      Promise.resolve(
        [...repo.tasks.values()].filter(
          (task) => task.storeId === storeId && task.workDate === workDate,
        ),
      ),
    byId: (id: string) => Promise.resolve(repo.tasks.get(id) ?? null),
    saveAll: (records: readonly DailyTaskRecord[]) => {
      if (repo.failSaveAll) return Promise.reject(new Error('disk full'));
      for (const record of records) repo.tasks.set(record.id, record);
      return Promise.resolve();
    },
    save: (record: DailyTaskRecord) => {
      repo.tasks.set(record.id, record);
      return Promise.resolve();
    },
    executionByIdempotencyKey: (storeId: string, key: string) =>
      Promise.resolve(
        [...repo.executions.values()].find(
          (execution) => execution.storeId === storeId && execution.idempotencyKey === key,
        ) ?? null,
      ),
    saveExecution: (execution: TaskExecutionRecord) => {
      if (repo.failSaveExecution) return Promise.reject(new Error('disk full'));
      repo.executions.set(execution.id, execution);
      return Promise.resolve();
    },
    updateExecutionSyncStatus: () => Promise.resolve(),
  };
}

function makeLoader(repo: Repo, failTemplates = false): LoadDailyTasksUseCase {
  return new LoadDailyTasksUseCase(
    { now: () => NOW },
    {
      activeTemplates: () =>
        failTemplates
          ? Promise.reject(new Error('definições indisponíveis'))
          : Promise.resolve(templates),
    },
    repositoryPort(repo),
  );
}

const loadInput = {
  workDate: WORK_DATE,
  operationalDayStart: DAY_START,
  configVersionRef: 'cfg-v1',
};

describe('LoadDailyTasksUseCase', () => {
  it('materializa o dia a partir dos templates vigentes', async () => {
    const repo = makeRepo();
    const result = await makeLoader(repo).execute({ authorization: authorization(), ...loadInput });
    expect(result.kind).toBe('loaded');
    if (result.kind !== 'loaded') return;
    expect(result.tasks).toHaveLength(2);
    expect(repo.tasks.size).toBe(2);
    expect(result.tasks[0]?.template.title).toBe('Higienizar bancada de manipulação');
  });

  it('materialização é idempotente (releitura não duplica)', async () => {
    const repo = makeRepo();
    const loader = makeLoader(repo);
    await loader.execute({ authorization: authorization(), ...loadInput });
    const again = await loader.execute({ authorization: authorization(), ...loadInput });
    expect(repo.tasks.size).toBe(2);
    if (again.kind !== 'loaded') throw new Error('esperava loaded');
    expect(again.tasks).toHaveLength(2);
  });

  it('releitura NUNCA sobrescreve desfecho já registrado', async () => {
    const repo = makeRepo();
    const loader = makeLoader(repo);
    await loader.execute({ authorization: authorization(), ...loadInput });
    const id = dailyTaskIdFor('store-1', WORK_DATE, 'tpl-limpeza');
    const persisted = repo.tasks.get(id);
    if (persisted === undefined) throw new Error('tarefa ausente');
    repo.tasks.set(id, { ...persisted, status: 'DONE', lastExecutionId: 'exec-1' });

    const again = await loader.execute({ authorization: authorization(), ...loadInput });
    if (again.kind !== 'loaded') throw new Error('esperava loaded');
    expect(again.tasks.find((task) => task.id === id)?.status).toBe('DONE');
  });

  it('deriva OVERDUE do vencimento (nunca digitado)', async () => {
    const repo = makeRepo();
    const result = await makeLoader(repo).execute({ authorization: authorization(), ...loadInput });
    if (result.kind !== 'loaded') throw new Error('esperava loaded');
    // limpeza vence 30min após 10:30 = 11:00 < 12:00 (NOW) ⇒ atrasada
    const limpeza = result.tasks.find((task) => task.templateId === 'tpl-limpeza');
    expect(limpeza?.status).toBe('OVERDUE');
    // temperatura vence 11:30 < 12:00 ⇒ também atrasada
    expect(result.tasks.every((task) => task.status === 'OVERDUE')).toBe(true);
  });

  it('não marca atraso antes do vencimento', async () => {
    const repo = makeRepo();
    const loader = new LoadDailyTasksUseCase(
      { now: () => new Date('2026-07-21T10:45:00.000Z') },
      { activeTemplates: () => Promise.resolve(templates) },
      repositoryPort(repo),
    );
    const result = await loader.execute({ authorization: authorization(), ...loadInput });
    if (result.kind !== 'loaded') throw new Error('esperava loaded');
    expect(result.tasks.every((task) => task.status === 'PENDING')).toBe(true);
  });

  it('rejeita snapshot expirado', async () => {
    const repo = makeRepo();
    const result = await makeLoader(repo).execute({
      authorization: authorization({ validUntil: new Date(NOW.getTime() - 1) }),
      ...loadInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_EXPIRED' });
  });

  it('rejeita versão de modelo de permissão incompatível', async () => {
    const repo = makeRepo();
    const result = await makeLoader(repo).execute({
      authorization: authorization({ permissionModelVersion: PERMISSION_MODEL_VERSION + 1 }),
      ...loadInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_VERSION_INCOMPATIBLE' });
  });

  it('falha explicitamente quando as definições estão indisponíveis', async () => {
    const repo = makeRepo();
    const result = await makeLoader(repo, true).execute({
      authorization: authorization(),
      ...loadInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'CONFIG_UNAVAILABLE' });
  });

  it('propaga falha de materialização local', async () => {
    const repo = makeRepo();
    repo.failSaveAll = true;
    const result = await makeLoader(repo).execute({ authorization: authorization(), ...loadInput });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERSISTENCE_FAILED' });
  });
});

interface OutcomeHarness {
  useCase: RecordTaskOutcomeUseCase;
  repo: Repo;
  enqueued: TaskExecutionEnqueueInput[];
  failEnqueue: boolean;
}

async function makeOutcomeHarness(): Promise<OutcomeHarness> {
  const repo = makeRepo();
  await makeLoader(repo).execute({ authorization: authorization(), ...loadInput });
  const harness: OutcomeHarness = {
    repo,
    enqueued: [],
    failEnqueue: false,
    useCase: undefined as unknown as RecordTaskOutcomeUseCase,
  };
  let counter = 0;
  harness.useCase = new RecordTaskOutcomeUseCase(
    { now: () => NOW },
    { uuid: () => `exec-${String(++counter).padStart(2, '0')}` },
    repositoryPort(repo),
    {
      enqueueTaskExecution: (item) => {
        if (harness.failEnqueue) return Promise.reject(new Error('queue down'));
        harness.enqueued.push(item);
        return Promise.resolve();
      },
    },
  );
  return harness;
}

const TEMP_TASK = dailyTaskIdFor('store-1', WORK_DATE, 'tpl-temp');
const LIMPEZA_TASK = dailyTaskIdFor('store-1', WORK_DATE, 'tpl-limpeza');

const outcomeInput = {
  operatorSessionId: 'sess-1',
  deviceId: 'device-1',
  numericValue: null,
  notes: null,
  hasEvidence: false,
  performedOffline: false,
};

describe('RecordTaskOutcomeUseCase', () => {
  it('conclui uma tarefa: enfileira, registra execução e move a tarefa', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: TEMP_TASK,
      kind: 'complete',
      ...outcomeInput,
      numericValue: 2,
    });
    expect(result.kind).toBe('recorded');
    if (result.kind !== 'recorded') return;
    expect(result.execution.result).toBe('PASS');
    expect(result.task.status).toBe('DONE');
    expect(result.task.lastExecutionId).toBe(result.execution.id);
    expect(harness.enqueued).toHaveLength(1);
  });

  it('registra FAIL quando o valor sai da faixa esperada', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: TEMP_TASK,
      kind: 'complete',
      ...outcomeInput,
      numericValue: 12,
    });
    if (result.kind !== 'recorded') throw new Error('esperava recorded');
    expect(result.execution.result).toBe('FAIL');
    expect(result.task.status).toBe('DONE');
  });

  it('adia uma tarefa (SKIPPED, result NA)', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: LIMPEZA_TASK,
      kind: 'skip',
      ...outcomeInput,
    });
    if (result.kind !== 'recorded') throw new Error('esperava recorded');
    expect(result.execution.result).toBe('NA');
    expect(result.task.status).toBe('SKIPPED');
  });

  it('replay não duplica execução (chave determinística)', async () => {
    const harness = await makeOutcomeHarness();
    const payload = {
      authorization: authorization(),
      dailyTaskId: TEMP_TASK,
      kind: 'complete' as const,
      ...outcomeInput,
      numericValue: 2,
    };
    const first = await harness.useCase.execute(payload);
    const second = await harness.useCase.execute(payload);
    expect(first.kind).toBe('recorded');
    expect(second.kind).toBe('already-recorded');
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.repo.executions.size).toBe(1);
    expect(harness.enqueued[0]?.execution.idempotencyKey).toBe(
      taskOutcomeIdempotencyKeyFor('complete', 'store-1', TEMP_TASK, 'emp-1'),
    );
  });

  it('exige evidência quando o template pede foto', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: LIMPEZA_TASK,
      kind: 'complete',
      ...outcomeInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'EVIDENCE_REQUIRED' });
    expect(harness.enqueued).toHaveLength(0);
  });

  it('exige medição quando há faixa esperada', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: TEMP_TASK,
      kind: 'complete',
      ...outcomeInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'VALUE_REQUIRED' });
  });

  it('recusa segundo desfecho sobre tarefa já resolvida', async () => {
    const harness = await makeOutcomeHarness();
    await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: LIMPEZA_TASK,
      kind: 'skip',
      ...outcomeInput,
    });
    const again = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: LIMPEZA_TASK,
      kind: 'complete',
      ...outcomeInput,
      hasEvidence: true,
    });
    expect(again).toMatchObject({ kind: 'failed', code: 'TASK_ALREADY_RESOLVED' });
  });

  it('rejeita tarefa inexistente', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: 'daily-task:store-1:2026-07-21:inexistente',
      kind: 'complete',
      ...outcomeInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'TASK_NOT_FOUND' });
  });

  it('rejeita tarefa de outra loja', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ storeId: 'store-9' }),
      dailyTaskId: TEMP_TASK,
      kind: 'complete',
      ...outcomeInput,
      numericValue: 2,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'STORE_MISMATCH' });
  });

  it('rejeita execução sem turno aberto (autoria)', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: TEMP_TASK,
      kind: 'complete',
      ...outcomeInput,
      operatorSessionId: '',
      numericValue: 2,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SESSION_REQUIRED' });
  });

  it('rejeita snapshot expirado', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ validUntil: new Date(NOW.getTime() - 1) }),
      dailyTaskId: TEMP_TASK,
      kind: 'complete',
      ...outcomeInput,
      numericValue: 2,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_EXPIRED' });
  });

  it('rejeita versão de modelo de permissão incompatível', async () => {
    const harness = await makeOutcomeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ permissionModelVersion: PERMISSION_MODEL_VERSION + 1 }),
      dailyTaskId: TEMP_TASK,
      kind: 'complete',
      ...outcomeInput,
      numericValue: 2,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_VERSION_INCOMPATIBLE' });
  });

  it('falha de fila não registra execução nem move a tarefa', async () => {
    const harness = await makeOutcomeHarness();
    harness.failEnqueue = true;
    const result = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: TEMP_TASK,
      kind: 'complete',
      ...outcomeInput,
      numericValue: 2,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'ENQUEUE_FAILED' });
    expect(harness.repo.executions.size).toBe(0);
    expect(harness.repo.tasks.get(TEMP_TASK)?.status).toBe('PENDING');
  });

  it('falha de persistência mantém a intenção durável enfileirada', async () => {
    const harness = await makeOutcomeHarness();
    harness.repo.failSaveExecution = true;
    const result = await harness.useCase.execute({
      authorization: authorization(),
      dailyTaskId: TEMP_TASK,
      kind: 'complete',
      ...outcomeInput,
      numericValue: 2,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERSISTENCE_FAILED' });
    expect(harness.enqueued).toHaveLength(1);
  });
});
