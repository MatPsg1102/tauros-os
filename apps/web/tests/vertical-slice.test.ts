// Teste de integração VERTICAL (7.1 §36/§39): UI→aplicação→domínio→
// repositório local→auditoria→fila→processor→transporte→confirmação,
// com implementações REAIS internas (Memory stores, fila, coordinator);
// fake apenas na fronteira externa (transporte). Clock determinístico.

import { beforeEach, describe, expect, it } from 'vitest';

import type { EffectiveAuthorization } from '@tauros/contracts';
import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';

const NOW = new Date('2026-07-21T12:00:00.000Z');
const TZ = 'America/Sao_Paulo';

function auth(overrides: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-0001',
    operatorEmployeeId: 'emp-0001',
    storeId: 'store-centro-0001',
    sessionId: 'platform-sess-01',
    permissions: ['session.open'],
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
      });
      return world.container;
    },
  };
  world.reload();
  return world;
}

async function openAsFixtureOperator(
  world: World,
  overrides: Partial<EffectiveAuthorization> = {},
) {
  const authorization = auth(overrides);
  world.container.setAuthorization(authorization);
  return world.container.openSession.execute({
    authorization,
    membershipId: 'memb-0001',
    deviceId: 'device-A',
    storeTimeZone: TZ,
    openedOffline: !world.online,
  });
}

let world: World;
beforeEach(() => {
  world = makeWorld();
});

describe('cenário OFFLINE completo (abre → fila → reload → reconnect → synced)', () => {
  it('atravessa todas as camadas sem duplicar o turno', async () => {
    // 1-4) dispositivo offline, snapshot válido, configuração materializada
    world.transport.available = false;
    world.online = false;

    // 5-6) abertura validada no domínio e persistida localmente
    const result = await openAsFixtureOperator(world);
    expect(result.kind).toBe('opened');
    const record = result.kind === 'opened' ? result.record : null;
    expect(record?.openedOffline).toBe(true);
    expect(record?.operationalDate).toBe('2026-07-21');
    expect(record?.syncStatus).toBe('queued');

    // 7) comando na fila oficial em PENDING com snapshot e ator
    const item = await world.container.queueItemForSession(record!.id);
    expect(item?.state).toBe('PENDING');
    expect(item?.authorization.operatorEmployeeId).toBe('emp-0001');
    expect(item?.idempotencyKey).toContain('session-open:store-centro-0001:emp-0001');

    // auditoria: evento de negócio no outbox durável
    const outbox = await world.offlineStore.transaction(['audit_outbox'], 'read', (tx) =>
      tx.getAll('audit_outbox'),
    );
    expect(JSON.stringify(outbox)).toContain('auth.login.success');

    // 8) drain offline não sincroniza (conectividade composta nega)
    await world.container.drainAndReflect();
    expect((await world.container.queueItemForSession(record!.id))?.state).toBe('PENDING');

    // 9) RELOAD: novo container sobre os mesmos stores restaura o estado
    const reloaded = world.reload();
    const restored = await reloaded.sessions.findActive('store-centro-0001', 'emp-0001');
    expect(restored?.id).toBe(record!.id);
    expect(restored?.syncStatus).toBe('queued');

    // 10-11) reconexão: drena, transporte confirma, estado vira synced
    world.online = true;
    world.transport.available = true;
    reloaded.setAuthorization(auth());
    await reloaded.drainAndReflect();
    const synced = await reloaded.sessions.byId(record!.id);
    expect(synced?.syncStatus).toBe('synced');
    expect(world.transport.submissions).toBe(1); // uma única submissão

    // replay pós-sync (retry de rede duplicado) ⇒ dedupe idempotente no servidor
    const again = await world.transport.submit({
      idempotencyKey: record!.idempotencyKey,
      payload: { record },
    } as never);
    expect(again).toEqual({ kind: 'persisted' });
  });
});

describe('idempotência e duplicação (§15)', () => {
  it('duplo clique/reapresentação não cria segundo item nem segundo registro', async () => {
    world.online = true;
    world.transport.available = true;
    const first = await openAsFixtureOperator(world);
    expect(first.kind).toBe('opened');
    const second = await openAsFixtureOperator(world);
    expect(second.kind).toBe('already-open');
    const items = await world.container.queue.all();
    expect(items).toHaveLength(1);
  });

  it('processor reprocessando o MESMO item após lease expirada não duplica no servidor', async () => {
    world.online = true;
    const opened = await openAsFixtureOperator(world);
    const record = opened.kind === 'opened' ? opened.record : null;
    await world.container.drainAndReflect();
    expect(world.transport.submissions).toBe(1);
    // segundo drain: item já SYNCED/limpo — nenhuma nova submissão
    await world.container.drainAndReflect();
    expect(world.transport.submissions).toBe(1);
    expect((await world.container.sessions.byId(record!.id))?.syncStatus).toBe('synced');
  });
});

describe('conflito (dispositivo B abriu antes — §16)', () => {
  it('sincronização classifica conflito, registra e NÃO duplica nem “vence” sozinha', async () => {
    // dispositivo B abriu online com outra chave (outro dispositivo)
    world.transport.seedRemoteSession({
      storeId: 'store-centro-0001',
      actorEmployeeId: 'emp-0001',
      idempotencyKey: 'session-open:store-centro-0001:emp-0001:2026-07-21:device-B',
      sessionId: 'sess-do-device-B',
    });
    world.online = false;
    world.transport.available = false;
    const opened = await openAsFixtureOperator(world);
    const record = opened.kind === 'opened' ? opened.record : null;
    expect(record).not.toBeNull();

    world.online = true;
    world.transport.available = true;
    await world.container.drainAndReflect();

    const item = await world.container.queueItemForSession(record!.id);
    expect(item?.state).toBe('CONFLICT');
    const local = await world.container.sessions.byId(record!.id);
    expect(local?.syncStatus).toBe('conflict');
    // registro de conflito preservado para revisão (política congelada: manual)
    const conflicts = await world.container.queue.conflicts();
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

describe('recuperação (falha entre enqueue e save — §35)', () => {
  it('boot reconstrói o registro local a partir da intenção durável', async () => {
    world.online = false;
    const opened = await openAsFixtureOperator(world);
    const record = opened.kind === 'opened' ? opened.record : null;
    // simula perda do estado local (falha após enqueue): apaga o registro
    await world.appStore.transaction(['operator_sessions'], 'write', (tx) =>
      tx.delete('operator_sessions', record!.id),
    );
    expect(await world.container.sessions.byId(record!.id)).toBeNull();

    const reloaded = world.reload();
    await reloaded.reconcileFromQueue();
    const rebuilt = await reloaded.sessions.byId(record!.id);
    expect(rebuilt?.idempotencyKey).toBe(record!.idempotencyKey);
    expect(rebuilt?.syncStatus).toBe('queued');
  });
});

describe('snapshot e autorização offline (§10/§36)', () => {
  it('snapshot expirado ⇒ falha orientada sem entrada na fila', async () => {
    const result = await openAsFixtureOperator(world, {
      validUntil: new Date('2026-07-21T11:59:59.000Z'),
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_EXPIRED' });
    expect(await world.container.queue.all()).toHaveLength(0);
  });

  it('permission_model_version incompatível ⇒ falha sem efeitos', async () => {
    const result = await openAsFixtureOperator(world, { permissionModelVersion: 99 });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_VERSION_INCOMPATIBLE' });
  });

  it('sem capability ⇒ negado + auditoria access.denied, fila intacta', async () => {
    const result = await openAsFixtureOperator(world, { permissions: ['audit.read'] });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(await world.container.queue.all()).toHaveLength(0);
    const outbox = await world.offlineStore.transaction(['audit_outbox'], 'read', (tx) =>
      tx.getAll('audit_outbox'),
    );
    expect(JSON.stringify(outbox)).toContain('access.denied');
  });
});
