// Composition root (7.1 §6/§14) — monta o vertical slice inteiro sobre a
// infraestrutura congelada. Browser usa IndexedDB; testes injetam Memory.
// Recuperação explícita: intenção durável (fila) sem registro local ⇒
// reconcileFromQueue reconstrói o estado no boot (atomicidade §35).

import { OpenOperatorSessionUseCase } from '@tauros/application';
import { ConfigResolver } from '@tauros/config-engine';
import type { EffectiveAuthorization, OperatorSessionRecord } from '@tauros/contracts';
import { ENTITY_OPERATOR_SESSION } from '@tauros/contracts';
import {
  AuditEventFactory,
  AuditingEventBridge,
  CompositeConnectivity,
  DefaultAuditPolicy,
  DefaultAuditSanitizer,
  IndexedDbLocalStore,
  LocalAuditBuffer,
  LocalQueueRepository,
  MemoryLocalStore,
  NoopEventEmitter,
  OFFLINE_SCHEMA,
  QueueProcessor,
  QueueScheduler,
  RetryPolicy,
  SyncCoordinator,
  ConflictResolverRegistry,
  resolveOfflineParameters,
  type ConnectivityPort,
  type LocalStorePort,
  type QueueItem,
  type SyncTransportPort,
  type TechnicalEventPort,
} from '@tauros/infrastructure';

import {
  APP_STATE_SCHEMA,
  ConfigSessionPolicyAdapter,
  LocalOperatorSessionRepository,
  SessionAuditAdapter,
  SessionQueueAdapter,
} from './adapters.js';
import { FakeSessionSyncTransport } from './transport-fake.js';

export interface ContainerOptions {
  readonly clock?: () => Date;
  readonly deviceId?: string;
  readonly offlineStore?: LocalStorePort;
  readonly appStore?: LocalStorePort;
  readonly transport?: SyncTransportPort;
  readonly deviceOnline?: () => boolean;
  readonly events?: TechnicalEventPort;
}

export interface AppContainer {
  readonly clock: () => Date;
  readonly deviceId: string;
  readonly config: ConfigResolver;
  readonly sessions: LocalOperatorSessionRepository;
  readonly queue: LocalQueueRepository;
  readonly transport: SyncTransportPort;
  readonly connectivity: ConnectivityPort;
  readonly setAuthorization: (auth: EffectiveAuthorization | null) => void;
  readonly openSession: OpenOperatorSessionUseCase;
  /** Drena a fila e reflete o desfecho no syncStatus do registro local. */
  readonly drainAndReflect: () => Promise<void>;
  /** Recuperação de boot: fila com intenção sem registro local ⇒ reconstrói. */
  readonly reconcileFromQueue: () => Promise<void>;
  readonly queueItemForSession: (sessionId: string) => Promise<QueueItem | undefined>;
  readonly close: () => Promise<void>;
}

export function buildContainer(options: ContainerOptions = {}): AppContainer {
  // ref mutável: a ponte de auditoria precisa da fila que só existe depois
  const queueRef: { current?: LocalQueueRepository } = {};
  const clock = options.clock ?? ((): Date => new Date());
  const deviceId = options.deviceId ?? 'device-web-01';

  const offlineStore =
    options.offlineStore ??
    (typeof indexedDB === 'undefined'
      ? new MemoryLocalStore(OFFLINE_SCHEMA)
      : new IndexedDbLocalStore(OFFLINE_SCHEMA));
  const appStore =
    options.appStore ??
    (typeof indexedDB === 'undefined'
      ? new MemoryLocalStore(APP_STATE_SCHEMA)
      : new IndexedDbLocalStore(APP_STATE_SCHEMA));

  // Configuration Engine com fonte local (overrides chegam com o backend real)
  const config = new ConfigResolver({ loadStoreOverrides: () => Promise.resolve([]) }, clock);

  // Auditoria: outbox durável + ponte que promove eventos técnicos por política
  const policy = new DefaultAuditPolicy();
  const sanitizer = new DefaultAuditSanitizer();
  const factory = new AuditEventFactory(policy, sanitizer, clock);
  const buffer = new LocalAuditBuffer(offlineStore, clock);
  const events: TechnicalEventPort =
    options.events ??
    new AuditingEventBridge(new NoopEventEmitter(), policy, factory, buffer, (id) =>
      queueRef.current!.get(id),
    );

  const params = resolveOfflineParameters({ instanceId: `web:${deviceId}` });
  const queue = new LocalQueueRepository(offlineStore, events, clock, params);
  queueRef.current = queue;
  const retry = new RetryPolicy(config, () => 0.5);
  const conflicts = new ConflictResolverRegistry();
  const transport = options.transport ?? new FakeSessionSyncTransport();
  const processor = new QueueProcessor(queue, transport, retry, conflicts, events, clock, params);
  const scheduler = new QueueScheduler(queue, config, events, clock);

  const deviceOnline =
    options.deviceOnline ??
    ((): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const backendUp = (): Promise<boolean> =>
    Promise.resolve(transport instanceof FakeSessionSyncTransport ? transport.available : true);
  const connectivity = new CompositeConnectivity({
    device: () => Promise.resolve(deviceOnline()),
    backend: backendUp,
    auth: () => Promise.resolve(true),
    service: backendUp,
  });

  const coordinator = new SyncCoordinator(connectivity, queue, scheduler, processor, events, clock);

  const sessions = new LocalOperatorSessionRepository(appStore);

  let currentAuth: EffectiveAuthorization | null = null;
  const authorization = (): EffectiveAuthorization => {
    if (currentAuth === null) throw new Error('sessão operacional não identificada');
    return currentAuth;
  };

  const queueAdapter = new SessionQueueAdapter(queue, authorization, deviceId, clock);
  const auditAdapter = new SessionAuditAdapter(factory, buffer);
  const policyAdapter = new ConfigSessionPolicyAdapter(config);

  const openSession = new OpenOperatorSessionUseCase(
    { now: clock },
    { uuid: () => crypto.randomUUID() },
    policyAdapter,
    sessions,
    queueAdapter,
    auditAdapter,
  );

  const queueItemForSession = async (sessionId: string): Promise<QueueItem | undefined> => {
    const all = await queue.all();
    return all.find(
      (item) => item.entityType === ENTITY_OPERATOR_SESSION && item.entityId === sessionId,
    );
  };

  const drainAndReflect = async (): Promise<void> => {
    const report = await coordinator.drain();
    for (const result of report.processed) {
      const item = await queue.get(result.itemId);
      const sessionId = item?.entityId;
      if (sessionId === undefined || item?.entityType !== ENTITY_OPERATOR_SESSION) continue;
      if (result.finalState === 'SYNCED') await sessions.updateSyncStatus(sessionId, 'synced');
      else if (result.finalState === 'CONFLICT')
        await sessions.updateSyncStatus(sessionId, 'conflict');
      else if (result.finalState === 'PERMANENT_FAILURE' || result.finalState === 'NEEDS_REVIEW')
        await sessions.updateSyncStatus(sessionId, 'failed');
    }
    // itens SYNCED podem já ter sido limpos: reconcilia registros 'queued'
    const pending = await queue.all();
    const pendingIds = new Set(
      pending
        .filter((item) => item.entityType === ENTITY_OPERATOR_SESSION)
        .map((item) => item.entityId),
    );
    // nada a fazer aqui além do reflexo acima; restauração completa no boot
    void pendingIds;
  };

  const reconcileFromQueue = async (): Promise<void> => {
    const items = await queue.all();
    for (const item of items) {
      if (item.entityType !== ENTITY_OPERATOR_SESSION) continue;
      const payload = item.payload as { record?: OperatorSessionRecord };
      const record = payload.record;
      if (record === undefined) continue;
      const existing = await sessions.byId(record.id);
      if (existing === null) {
        // intenção durável sem estado local (falha entre enqueue e save)
        await sessions.save(record);
      }
    }
  };

  return {
    clock,
    deviceId,
    config,
    sessions,
    queue,
    transport,
    connectivity,
    setAuthorization: (auth) => {
      currentAuth = auth;
    },
    openSession,
    drainAndReflect,
    reconcileFromQueue,
    queueItemForSession,
    close: async () => {
      await offlineStore.close();
      await appStore.close();
    },
  };
}
