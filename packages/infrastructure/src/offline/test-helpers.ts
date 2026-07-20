// Helpers de teste do módulo offline — relógio mutável, transporte stub,
// mundo montado sobre MemoryLocalStore. Sem rede, sem timers reais.

import { ConfigResolver } from '@tauros/config-engine';

import type { AuthorizationSnapshot } from './authorization-snapshot.js';
import { CapturingEventEmitter } from './events.js';
import { MemoryLocalStore } from './memory-store.js';
import { ConflictResolverRegistry } from './conflict.js';
import type { NewQueueItem } from './queue-item.js';
import { LocalQueueRepository, OFFLINE_SCHEMA } from './queue-repository.js';
import { QueueProcessor } from './processor.js';
import { QueueScheduler } from './scheduler.js';
import { RetryPolicy } from './retry-policy.js';
import { SyncCoordinator } from './coordinator.js';
import { CompositeConnectivity, type ConnectivityProbes } from './connectivity.js';
import type { SubmitOutcome, SyncTransportPort } from './sync-transport.js';

export const STORE_ID = '00000000-0000-0000-0000-00000000s001';

export interface MutableClock {
  now: Date;
  readonly fn: () => Date;
  advance(ms: number): void;
}

export function makeClock(startIso = '2026-07-20T10:00:00Z'): MutableClock {
  const clock = {
    now: new Date(startIso),
    fn: () => clock.now,
    advance(ms: number) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
  };
  return clock;
}

export function makeSnapshot(clock: MutableClock, ttlMs = 3_600_000): AuthorizationSnapshot {
  return {
    operatorProfileId: 'profile-1',
    operatorEmployeeId: 'employee-1',
    storeId: STORE_ID,
    sessionId: 'session-1',
    permissions: ['tasks.execute.own'],
    permissionModelVersion: 1,
    configVersionRef: undefined,
    capturedAt: clock.now,
    validUntil: new Date(clock.now.getTime() + ttlMs),
    authOrigin: 'offline-pin',
  };
}

export function makeNewItem(
  id: string,
  snapshot: AuthorizationSnapshot,
  overrides: Partial<NewQueueItem> = {},
): NewQueueItem {
  return {
    id,
    operation: 'insert',
    entityType: 'generic_record',
    entityId: `entity-${id}`,
    payload: { value: 42 },
    idempotencyKey: `idem-${id}`,
    authorization: snapshot,
    trace: {
      storeId: STORE_ID,
      deviceId: 'device-1',
      sessionId: snapshot.sessionId,
      schemaVersion: 1,
      priority: 10,
    },
    ...overrides,
  };
}

/** Transporte stub: outcomes programados por id (FIFO); default = persisted. */
export class FakeTransport implements SyncTransportPort {
  readonly submitted: string[] = [];
  private readonly plans = new Map<string, SubmitOutcome[]>();

  plan(itemId: string, ...outcomes: SubmitOutcome[]): void {
    this.plans.set(itemId, [...(this.plans.get(itemId) ?? []), ...outcomes]);
  }

  submit(item: { id: string }): Promise<SubmitOutcome> {
    this.submitted.push(item.id);
    const queue = this.plans.get(item.id);
    const outcome = queue?.shift() ?? { kind: 'persisted' as const };
    return Promise.resolve(outcome);
  }
}

export interface World {
  readonly clock: MutableClock;
  readonly store: MemoryLocalStore;
  readonly repo: LocalQueueRepository;
  readonly events: CapturingEventEmitter;
  readonly transport: FakeTransport;
  readonly retry: RetryPolicy;
  readonly registry: ConflictResolverRegistry;
  readonly processor: QueueProcessor;
  readonly scheduler: QueueScheduler;
  readonly config: ConfigResolver;
  coordinator(probes?: Partial<ConnectivityProbes>): SyncCoordinator;
}

export function makeWorld(random: () => number = () => 0.5): World {
  const clock = makeClock();
  const store = new MemoryLocalStore(OFFLINE_SCHEMA);
  const events = new CapturingEventEmitter();
  const repo = new LocalQueueRepository(store, events, clock.fn);
  const config = new ConfigResolver({ loadStoreOverrides: () => Promise.resolve([]) }, clock.fn);
  const retry = new RetryPolicy(config, random);
  const registry = new ConflictResolverRegistry();
  const transport = new FakeTransport();
  const processor = new QueueProcessor(repo, transport, retry, registry, events, clock.fn, {
    instanceId: 'proc-A',
    leaseTtlMs: 60_000,
  });
  const scheduler = new QueueScheduler(repo, config, events, clock.fn);

  const online: ConnectivityProbes = {
    device: () => Promise.resolve(true),
    backend: () => Promise.resolve(true),
    auth: () => Promise.resolve(true),
    service: () => Promise.resolve(true),
  };

  return {
    clock,
    store,
    repo,
    events,
    transport,
    retry,
    registry,
    processor,
    scheduler,
    config,
    coordinator(probes = {}) {
      return new SyncCoordinator(
        new CompositeConnectivity({ ...online, ...probes }),
        repo,
        scheduler,
        processor,
        events,
        clock.fn,
      );
    },
  };
}
