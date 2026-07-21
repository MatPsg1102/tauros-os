// Teste de integração VERTICAL da 7.2: fechamento de turno e quadro de
// tarefas atravessando UI-model→aplicação→domínio→repositório local→
// auditoria→fila→processor→transporte→confirmação. Implementações REAIS
// internas; fake apenas na fronteira externa. Clock determinístico.

import { beforeEach, describe, expect, it } from 'vitest';

import type { EffectiveAuthorization, TaskTemplateSnapshot } from '@tauros/contracts';
import { ENTITY_TASK_EXECUTION } from '@tauros/contracts';
import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';

const NOW = new Date('2026-07-21T12:00:00.000Z');
const DAY_START = new Date('2026-07-21T10:30:00.000Z');
const TZ = 'America/Sao_Paulo';
const STORE = 'store-centro-0001';
const WORK_DATE = '2026-07-21';

const TEMPLATES: readonly TaskTemplateSnapshot[] = [
  {
    templateId: 'tpl-camara-fria',
    title: 'Registrar temperatura da câmara fria',
    frequency: 'DAILY',
    requiresPhoto: false,
    expectedMin: -2,
    expectedMax: 4,
    targetPositionId: null,
    dueOffsetMinutes: 90,
  },
  {
    templateId: 'tpl-bancada',
    title: 'Higienizar bancada de manipulação',
    frequency: 'DAILY',
    requiresPhoto: true,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: null,
    dueOffsetMinutes: 240,
  },
];

function auth(overrides: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-0001',
    operatorEmployeeId: 'emp-0001',
    storeId: STORE,
    sessionId: 'platform-sess-01',
    permissions: ['session.open', 'session.close'],
    permissionModelVersion: 1,
    configVersionRef: undefined,
    validUntil: new Date('2026-07-22T12:00:00.000Z'),
    origin: 'offline-snapshot',
    ...overrides,
  };
}

interface World {
  offlineStore: MemoryLocalStore;
  appStore: MemoryLocalStore;
  transport: FakeSessionSyncTransport;
  online: boolean;
  container: AppContainer;
  /** Simula reload: novo container sobre os MESMOS stores persistidos. */
  reload: () => AppContainer;
}

function makeWorld(): World {
  const offlineStore = new MemoryLocalStore(OFFLINE_SCHEMA);
  const appStore = new MemoryLocalStore(APP_STATE_SCHEMA);
  const transport = new FakeSessionSyncTransport();
  const world: World = {
    offlineStore,
    appStore,
    transport,
    online: false,
    container: undefined as unknown as AppContainer,
    reload: () => {
      world.container = buildContainer({
        clock: () => NOW,
        deviceId: 'device-A',
        offlineStore,
        appStore,
        transport,
        deviceOnline: () => world.online,
        templates: { activeTemplates: () => Promise.resolve(TEMPLATES) },
      });
      return world.container;
    },
  };
  world.reload();
  return world;
}

async function openShift(world: World): Promise<string> {
  const authorization = auth();
  world.container.setAuthorization(authorization);
  const result = await world.container.openSession.execute({
    authorization,
    membershipId: 'memb-0001',
    deviceId: 'device-A',
    storeTimeZone: TZ,
    openedOffline: !world.online,
  });
  if (result.kind === 'failed') throw new Error(`abertura falhou: ${result.code}`);
  return result.record.id;
}

async function loadTasks(world: World) {
  const result = await world.container.loadDailyTasks.execute({
    authorization: auth(),
    workDate: WORK_DATE,
    operationalDayStart: DAY_START,
    configVersionRef: null,
  });
  if (result.kind === 'failed') throw new Error(`carga falhou: ${result.code}`);
  return result.tasks;
}

let world: World;
beforeEach(() => {
  world = makeWorld();
});

describe('fechamento de turno OFFLINE (fecha → fila → reload → reconnect → synced)', () => {
  it('atravessa todas as camadas sem duplicar o fechamento', async () => {
    world.transport.available = false;
    world.online = false;
    const sessionId = await openShift(world);

    const closed = await world.container.closeSession.execute({
      authorization: auth(),
      sessionId,
      deviceId: 'device-A',
      storeTimeZone: TZ,
      closedOffline: true,
      endReason: 'LOGOUT',
    });
    expect(closed.kind).toBe('closed');

    // estado local imediato, sem servidor
    const local = await world.container.sessions.byId(sessionId);
    expect(local?.status).toBe('CLOSED_LOCAL');
    expect(local?.closeSyncStatus).toBe('queued');

    // RELOAD: o fechamento sobrevive no armazenamento local
    const reloaded = world.reload();
    world.container.setAuthorization(auth());
    await reloaded.reconcileFromQueue();
    const afterReload = await reloaded.sessions.byId(sessionId);
    expect(afterReload?.status).toBe('CLOSED_LOCAL');

    // RECONEXÃO: uma única submissão leva o fechamento ao servidor
    world.transport.available = true;
    world.online = true;
    await reloaded.drainAndReflect();
    const synced = await reloaded.sessions.byId(sessionId);
    expect(synced?.closeSyncStatus).toBe('synced');
    expect(synced?.status).toBe('CLOSED_CONFIRMED');

    // drenar de novo não reenvia nem duplica
    const submissionsAfterFirst = world.transport.submissions;
    await reloaded.drainAndReflect();
    expect(world.transport.submissions).toBe(submissionsAfterFirst);
  });

  it('replay do fechamento não cria segunda operação na fila', async () => {
    const sessionId = await openShift(world);
    await world.container.closeSession.execute({
      authorization: auth(),
      sessionId,
      deviceId: 'device-A',
      storeTimeZone: TZ,
      closedOffline: true,
      endReason: 'LOGOUT',
    });
    const again = await world.container.closeSession.execute({
      authorization: auth(),
      sessionId,
      deviceId: 'device-A',
      storeTimeZone: TZ,
      closedOffline: true,
      endReason: 'LOGOUT',
    });
    expect(again.kind).toBe('already-closed');
    const items = await world.container.queue.all();
    expect(items.filter((item) => item.operation === 'update')).toHaveLength(1);
  });

  it('conflito (turno fechado em outro aparelho) preserva o registro local', async () => {
    const sessionId = await openShift(world);
    world.transport.available = true;
    world.online = true;
    await world.container.drainAndReflect(); // abertura sincronizada

    // outro aparelho fechou o mesmo turno
    world.transport.seedRemoteClosedSession({
      storeId: STORE,
      actorEmployeeId: 'emp-0001',
      idempotencyKey: 'session-open:store-centro-0001:emp-0001:2026-07-21:device-A',
      sessionId,
    });

    await world.container.closeSession.execute({
      authorization: auth(),
      sessionId,
      deviceId: 'device-A',
      storeTimeZone: TZ,
      closedOffline: false,
      endReason: 'LOGOUT',
    });
    await world.container.drainAndReflect();

    const local = await world.container.sessions.byId(sessionId);
    expect(local?.closeSyncStatus).toBe('conflict');
    // NADA foi perdido: o fechamento local continua registrado
    expect(local?.status).toBe('CLOSED_LOCAL');
    expect(local?.clientClosedAt).not.toBeNull();
  });

  it('nega o fechamento sem a capability, sem tocar fila nem estado', async () => {
    const sessionId = await openShift(world);
    const denied = await world.container.closeSession.execute({
      authorization: auth({ permissions: ['session.open'] }),
      sessionId,
      deviceId: 'device-A',
      storeTimeZone: TZ,
      closedOffline: true,
      endReason: 'LOGOUT',
    });
    expect(denied).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    const local = await world.container.sessions.byId(sessionId);
    expect(local?.status).toBe('ACTIVE');
  });
});

describe('quadro de tarefas do dia', () => {
  it('materializa o dia e sobrevive ao reload', async () => {
    await openShift(world);
    const tasks = await loadTasks(world);
    expect(tasks).toHaveLength(2);

    const reloaded = world.reload();
    world.container.setAuthorization(auth());
    const again = await reloaded.loadDailyTasks.execute({
      authorization: auth(),
      workDate: WORK_DATE,
      operationalDayStart: DAY_START,
      configVersionRef: null,
    });
    if (again.kind !== 'loaded') throw new Error('esperava loaded');
    expect(again.tasks).toHaveLength(2);
  });

  it('conclui tarefa OFFLINE → fila → reload → reconexão → confirmada uma vez', async () => {
    world.transport.available = false;
    world.online = false;
    const sessionId = await openShift(world);
    const tasks = await loadTasks(world);
    const temperatura = tasks.find((task) => task.templateId === 'tpl-camara-fria');
    if (temperatura === undefined) throw new Error('tarefa ausente');

    const recorded = await world.container.recordTaskOutcome.execute({
      authorization: auth(),
      dailyTaskId: temperatura.id,
      operatorSessionId: sessionId,
      deviceId: 'device-A',
      kind: 'complete',
      numericValue: 3,
      notes: null,
      hasEvidence: false,
      performedOffline: true,
    });
    expect(recorded.kind).toBe('recorded');

    // estado local imediato
    const localTask = await world.container.tasks.byId(temperatura.id);
    expect(localTask?.status).toBe('DONE');
    expect(localTask?.syncStatus).toBe('queued');

    // RELOAD: execução e desfecho sobrevivem
    const reloaded = world.reload();
    world.container.setAuthorization(auth());
    await reloaded.reconcileFromQueue();
    expect((await reloaded.tasks.byId(temperatura.id))?.status).toBe('DONE');

    // RECONEXÃO: submissão única
    world.transport.available = true;
    world.online = true;
    await reloaded.drainAndReflect();
    expect((await reloaded.tasks.byId(temperatura.id))?.syncStatus).toBe('synced');
    const submissions = world.transport.submissions;
    await reloaded.drainAndReflect();
    expect(world.transport.submissions).toBe(submissions);
  });

  it('replay da conclusão não duplica execução', async () => {
    const sessionId = await openShift(world);
    const tasks = await loadTasks(world);
    const task = tasks.find((candidate) => candidate.templateId === 'tpl-bancada');
    if (task === undefined) throw new Error('tarefa ausente');
    const payload = {
      authorization: auth(),
      dailyTaskId: task.id,
      operatorSessionId: sessionId,
      deviceId: 'device-A',
      kind: 'complete' as const,
      numericValue: null,
      notes: null,
      hasEvidence: true,
      performedOffline: true,
    };
    const first = await world.container.recordTaskOutcome.execute(payload);
    const second = await world.container.recordTaskOutcome.execute(payload);
    expect(first.kind).toBe('recorded');
    expect(second.kind).toBe('already-recorded');
    const items = await world.container.queue.all();
    expect(items.filter((item) => item.entityType === ENTITY_TASK_EXECUTION)).toHaveLength(1);
  });

  it('conflito (tarefa concluída em outro aparelho) preserva o registro local', async () => {
    const sessionId = await openShift(world);
    world.transport.available = true;
    world.online = true;
    await world.container.drainAndReflect();
    const tasks = await loadTasks(world);
    const task = tasks.find((candidate) => candidate.templateId === 'tpl-bancada');
    if (task === undefined) throw new Error('tarefa ausente');

    world.transport.seedRemoteExecution(STORE, task.id, 'exec-de-outro-aparelho');

    await world.container.recordTaskOutcome.execute({
      authorization: auth(),
      dailyTaskId: task.id,
      operatorSessionId: sessionId,
      deviceId: 'device-A',
      kind: 'complete',
      numericValue: null,
      notes: null,
      hasEvidence: true,
      performedOffline: false,
    });
    await world.container.drainAndReflect();

    const local = await world.container.tasks.byId(task.id);
    expect(local?.syncStatus).toBe('conflict');
    // o desfecho local permanece — nada foi perdido
    expect(local?.status).toBe('DONE');
    expect(local?.lastExecutionId).not.toBeNull();
  });

  it('exige evidência e medição conforme a definição congelada', async () => {
    const sessionId = await openShift(world);
    const tasks = await loadTasks(world);
    const bancada = tasks.find((task) => task.templateId === 'tpl-bancada');
    const camara = tasks.find((task) => task.templateId === 'tpl-camara-fria');
    if (bancada === undefined || camara === undefined) throw new Error('tarefas ausentes');

    const semFoto = await world.container.recordTaskOutcome.execute({
      authorization: auth(),
      dailyTaskId: bancada.id,
      operatorSessionId: sessionId,
      deviceId: 'device-A',
      kind: 'complete',
      numericValue: null,
      notes: null,
      hasEvidence: false,
      performedOffline: true,
    });
    expect(semFoto).toMatchObject({ kind: 'failed', code: 'EVIDENCE_REQUIRED' });

    const semMedicao = await world.container.recordTaskOutcome.execute({
      authorization: auth(),
      dailyTaskId: camara.id,
      operatorSessionId: sessionId,
      deviceId: 'device-A',
      kind: 'complete',
      numericValue: null,
      notes: null,
      hasEvidence: false,
      performedOffline: true,
    });
    expect(semMedicao).toMatchObject({ kind: 'failed', code: 'VALUE_REQUIRED' });

    // nenhum dos dois entrou na fila
    const items = await world.container.queue.all();
    expect(items.filter((item) => item.entityType === ENTITY_TASK_EXECUTION)).toHaveLength(0);
  });

  it('execução depende da abertura na ordem da fila (DAG)', async () => {
    world.transport.available = false;
    world.online = false;
    const sessionId = await openShift(world);
    const tasks = await loadTasks(world);
    const task = tasks.find((candidate) => candidate.templateId === 'tpl-bancada');
    if (task === undefined) throw new Error('tarefa ausente');

    const recorded = await world.container.recordTaskOutcome.execute({
      authorization: auth(),
      dailyTaskId: task.id,
      operatorSessionId: sessionId,
      deviceId: 'device-A',
      kind: 'complete',
      numericValue: null,
      notes: null,
      hasEvidence: true,
      performedOffline: true,
    });
    expect(recorded.kind).toBe('recorded');

    const items = await world.container.queue.all();
    const execution = items.find((item) => item.entityType === ENTITY_TASK_EXECUTION);
    const opening = items.find((item) => item.entityType !== ENTITY_TASK_EXECUTION);
    expect(opening).toBeDefined();
    expect(execution?.dependsOn).toContain(opening?.id);
  });
});
