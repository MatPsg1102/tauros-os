// Teste de integração VERTICAL da Área do Encarregado: criação de definição
// de tarefa atravessando aplicação→domínio→repositório local→auditoria→
// fila→processor→transporte→confirmação, com implementações REAIS internas
// (fake só na fronteira do transporte). Clock determinístico.

import { beforeEach, describe, expect, it } from 'vitest';

import { storeDayStartFor } from '@tauros/application';
import type { EffectiveAuthorization } from '@tauros/contracts';
import { CAPABILITY_CONFIG_WRITE, ENTITY_TASK_TEMPLATE } from '@tauros/contracts';
import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 11:00 na loja
const TZ = 'America/Sao_Paulo';
const STORE = 'store-centro-0001';
const WORK_DATE = '2026-08-13';

function supervisorAuth(overrides: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-0004',
    operatorEmployeeId: 'emp-0004',
    storeId: STORE,
    sessionId: 'platform:prof-0004',
    permissions: [CAPABILITY_CONFIG_WRITE, 'audit.read'],
    permissionModelVersion: 1,
    configVersionRef: undefined,
    validUntil: new Date('2026-08-14T14:00:00.000Z'),
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
      });
      return world.container;
    },
  };
  world.reload();
  return world;
}

const createInput = {
  deviceId: 'device-A',
  storeTimeZone: TZ,
  title: 'Organizar câmara fria',
  targetPositionId: 'pos-producao' as string | null,
  requiresPhoto: false,
  expectedMin: null,
  expectedMax: null,
  effectiveFrom: '2026-08-13',
  plannedStartMinutes: 15 * 60,
  dueOffsetMinutes: 17 * 60,
  recurrence: { kind: 'ONCE' } as const,
};

async function loadBoard(world: World, auth = supervisorAuth()) {
  const result = await world.container.loadDailyTasks.execute({
    authorization: auth,
    workDate: WORK_DATE,
    operationalDayStart: storeDayStartFor(NOW, TZ),
    configVersionRef: null,
  });
  if (result.kind === 'failed') throw new Error(`carga falhou: ${result.code}`);
  return result.tasks;
}

let world: World;
beforeEach(() => {
  world = makeWorld();
});

describe('criação de tarefa pelo encarregado — OFFLINE first', () => {
  it('cria offline → aparece no quadro → reload → reconexão → uma submissão', async () => {
    world.transport.available = false;
    world.online = false;
    world.container.setAuthorization(supervisorAuth());

    const created = await world.container.createTaskTemplate.execute({
      authorization: supervisorAuth(),
      ...createInput,
      createdOffline: true,
    });
    expect(created.kind).toBe('created');
    if (created.kind !== 'created') return;

    // aparece IMEDIATAMENTE no quadro (materialização local do dia)
    const board = await loadBoard(world);
    const novaTarefa = board.find((task) => task.template.title === 'Organizar câmara fria');
    expect(novaTarefa).toBeDefined();
    expect(novaTarefa?.template.targetPositionId).toBe('pos-producao');
    // vence às 17:00 da loja = 20:00Z
    expect(novaTarefa?.dueAt).toBe('2026-08-13T20:00:00.000Z');

    // definição local marcada como aguardando envio
    const templates = await world.container.templates.byStore(STORE);
    expect(templates[0]?.syncStatus).toBe('queued');

    // RELOAD: definição e tarefa materializada sobrevivem
    const reloaded = world.reload();
    world.container.setAuthorization(supervisorAuth());
    await reloaded.reconcileFromQueue();
    const boardAfterReload = await loadBoard(world);
    expect(boardAfterReload.some((task) => task.template.title === 'Organizar câmara fria')).toBe(
      true,
    );

    // RECONEXÃO: submissão única leva a criação ao servidor
    world.transport.available = true;
    world.online = true;
    await reloaded.drainAndReflect();
    const syncedTemplates = await reloaded.templates.byStore(STORE);
    expect(syncedTemplates[0]?.syncStatus).toBe('synced');

    const submissions = world.transport.submissions;
    await reloaded.drainAndReflect();
    expect(world.transport.submissions).toBe(submissions);
  });

  it('dupla submissão converge para UMA definição e UM item de fila', async () => {
    world.container.setAuthorization(supervisorAuth());
    const first = await world.container.createTaskTemplate.execute({
      authorization: supervisorAuth(),
      ...createInput,
      createdOffline: true,
    });
    const second = await world.container.createTaskTemplate.execute({
      authorization: supervisorAuth(),
      ...createInput,
      createdOffline: true,
    });
    expect(first.kind).toBe('created');
    expect(second.kind).toBe('already-created');

    const items = await world.container.queue.all();
    expect(items.filter((item) => item.entityType === ENTITY_TASK_TEMPLATE)).toHaveLength(1);
    expect(await world.container.templates.byStore(STORE)).toHaveLength(1);
    // e o quadro materializa UMA tarefa para a definição
    const board = await loadBoard(world);
    expect(board.filter((task) => task.template.title === 'Organizar câmara fria')).toHaveLength(1);
  });

  it('recuperação: intenção na fila sem registro local é reconstruída no boot', async () => {
    world.container.setAuthorization(supervisorAuth());
    await world.container.createTaskTemplate.execute({
      authorization: supervisorAuth(),
      ...createInput,
      createdOffline: true,
    });
    // simula a falha entre enqueue e save: apaga o registro local
    const [template] = await world.container.templates.byStore(STORE);
    if (template === undefined) throw new Error('template ausente');
    await world.appStore.transaction(['task_templates'], 'write', (tx) =>
      tx.delete('task_templates', template.id),
    );
    expect(await world.container.templates.byStore(STORE)).toHaveLength(0);

    const reloaded = world.reload();
    await reloaded.reconcileFromQueue();
    const recovered = await reloaded.templates.byStore(STORE);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.title).toBe('Organizar câmara fria');
  });
});

describe('autorização do encarregado (ADR-018 + RLS)', () => {
  it('sem config.write, nada é enfileirado nem persistido', async () => {
    const marina = supervisorAuth({
      operatorProfileId: 'prof-0001',
      operatorEmployeeId: 'emp-0001',
      permissions: ['session.open', 'session.close', 'audit.read'],
    });
    world.container.setAuthorization(marina);
    const result = await world.container.createTaskTemplate.execute({
      authorization: marina,
      ...createInput,
      createdOffline: false,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(await world.container.queue.all()).toHaveLength(0);
    expect(await world.container.templates.byStore(STORE)).toHaveLength(0);
  });

  it('o SERVIDOR (fake) rejeita item cujo snapshot não carrega config.write', async () => {
    // defesa em profundidade: mesmo que um item entre na fila com snapshot
    // sem a capability, o transporte responde rejeição definitiva.
    const semCapability = supervisorAuth({ permissions: ['audit.read'] });
    world.container.setAuthorization(semCapability);
    // enfileira diretamente pelo adapter (contornando o use case de propósito)
    const [templateFake] = [
      {
        id: 'tpl-forcada',
        storeId: STORE,
        title: 'Tarefa forçada',
        frequency: 'ONCE' as const,
        targetPositionId: 'pos-producao',
        requiresPhoto: false,
        expectedMin: null,
        expectedMax: null,
        active: true,
        clientCreatedAt: NOW.toISOString(),
        effectiveFrom: '2026-08-13',
        plannedStartMinutes: 540,
        dueOffsetMinutes: 600,
        recurrence: { kind: 'ONCE' as const },
        idempotencyKey: 'task-template-create:forcada',
        syncStatus: 'queued' as const,
        auditCorrelationId: 'tpl-forcada',
      },
    ];
    const { TemplateQueueAdapter } = await import('../src/wiring/adapters.js');
    const adapter = new TemplateQueueAdapter(
      world.container.queue,
      () => semCapability,
      'device-A',
      () => NOW,
    );
    await adapter.enqueueCreateTemplate({ queueItemId: 'q-forcada', template: templateFake! });

    world.transport.available = true;
    world.online = true;
    await world.container.drainAndReflect();
    const item = (await world.container.queue.all()).find((i) => i.id === 'q-forcada');
    // rejeição definitiva (nunca reenviar) — refletida como failed
    expect(item?.state === 'PERMANENT_FAILURE' || item === undefined).toBe(true);
  });
});

describe('integração com o quadro do operador', () => {
  it('tarefa criada pelo encarregado aparece no quadro do OPERADOR', async () => {
    world.container.setAuthorization(supervisorAuth());
    await world.container.createTaskTemplate.execute({
      authorization: supervisorAuth(),
      ...createInput,
      createdOffline: true,
    });

    // operador (Marina) carrega o quadro do dia — mesma loja, mesmo aparelho
    const marina = supervisorAuth({
      operatorProfileId: 'prof-0001',
      operatorEmployeeId: 'emp-0001',
      permissions: ['session.open', 'session.close', 'audit.read'],
    });
    const board = await loadBoard(world, marina);
    expect(board.some((task) => task.template.title === 'Organizar câmara fria')).toBe(true);
  });
});

describe('segurança da fixture de desenvolvimento', () => {
  it('o PIN nunca entra na fila, na auditoria nem no armazenamento', async () => {
    world.container.setAuthorization(supervisorAuth());
    await world.container.createTaskTemplate.execute({
      authorization: supervisorAuth(),
      ...createInput,
      createdOffline: true,
    });

    // serializa TUDO que está persistido nos dois bancos locais
    const dump: unknown[] = [];
    for (const schema of [OFFLINE_SCHEMA, APP_STATE_SCHEMA]) {
      const store = schema === OFFLINE_SCHEMA ? world.offlineStore : world.appStore;
      const storeNames = schema.migrations.flatMap((migration) =>
        migration.stores.map((definition) => definition.name),
      );
      for (const name of storeNames) {
        const rows = await store.transaction([name], 'read', (tx) => tx.getAll(name));
        dump.push(...rows);
      }
    }
    const serialized = JSON.stringify(dump);
    expect(serialized.includes('1234')).toBe(false);
    expect(serialized.includes('"pin"')).toBe(false);
  });
});
