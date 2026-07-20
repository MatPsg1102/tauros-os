// Repositório da fila sobre o LocalStorePort (RA-QUEUE-01 §2/§4).
// Claim de lease é atômico (transação); limpeza remove SOMENTE itens SYNCED.

import { assertAcyclic, dependenciesSatisfied } from './dag.js';
import type { TechnicalEventPort } from './events.js';
import type { LocalSchema, LocalStorePort } from './local-store.js';
import type { NewQueueItem, QueueItem } from './queue-item.js';
import { createQueueItem } from './queue-item.js';
import type { QueueState } from './state-machine.js';

export const OFFLINE_SCHEMA: LocalSchema = {
  databaseName: 'tauros-offline',
  version: 1,
  migrations: [
    {
      toVersion: 1,
      description: 'Fila offline, registros de conflito e metadados técnicos',
      stores: [
        { name: 'queue_items', indexes: { by_state: 'state', by_entity: 'entityType' } },
        { name: 'conflict_records', indexes: { by_item: 'itemId' } },
        { name: 'meta' },
      ],
    },
  ],
};

const QUEUE = 'queue_items';

export class SafeCleanupError extends Error {
  constructor(itemId: string, state: string) {
    super(
      `Limpeza negada para "${itemId}" em estado ${state}. ` +
        `Somente itens SYNCED podem ser removidos da fila.`,
    );
    this.name = 'SafeCleanupError';
  }
}

/** Reidrata datas após structuredClone/IndexedDB. */
function reviveItem(raw: unknown): QueueItem {
  const item = raw as QueueItem;
  const revive = (d: unknown): Date => (d instanceof Date ? d : new Date(d as string));
  return {
    ...item,
    createdAt: revive(item.createdAt),
    nextAttemptAt: item.nextAttemptAt ? revive(item.nextAttemptAt) : undefined,
    lastAttemptAt: item.lastAttemptAt ? revive(item.lastAttemptAt) : undefined,
    lastError: item.lastError ? { ...item.lastError, at: revive(item.lastError.at) } : undefined,
    lease: item.lease ? { ...item.lease, expiresAt: revive(item.lease.expiresAt) } : undefined,
    authorization: {
      ...item.authorization,
      capturedAt: revive(item.authorization.capturedAt),
      validUntil: revive(item.authorization.validUntil),
    },
  };
}

export class LocalQueueRepository {
  constructor(
    private readonly store: LocalStorePort,
    private readonly events: TechnicalEventPort,
    private readonly clock: () => Date,
  ) {}

  /** Enfileira validando aciclicidade da DAG (ciclo ⇒ erro auditável, item rejeitado). */
  async enqueue(input: NewQueueItem): Promise<QueueItem> {
    return this.store.transaction([QUEUE], 'write', async (tx) => {
      const byId = new Map<string, QueueItem>(
        (await tx.getAll(QUEUE)).map((r) => {
          const item = reviveItem(r);
          return [item.id, item] as const;
        }),
      );

      try {
        assertAcyclic({ id: input.id, dependsOn: input.dependsOn ?? [] }, byId);
      } catch (error) {
        this.events.emit({
          type: 'cycle_detected',
          at: this.clock(),
          itemId: input.id,
          detail: { message: (error as Error).message },
        });
        throw error;
      }

      const blocked = !dependenciesSatisfied({ dependsOn: input.dependsOn ?? [] }, byId);
      const item = createQueueItem(input, this.clock(), blocked);
      await tx.put(QUEUE, item.id, item);
      this.events.emit({
        type: blocked ? 'item_blocked' : 'item_enqueued',
        at: this.clock(),
        itemId: item.id,
      });
      return item;
    });
  }

  async get(id: string): Promise<QueueItem | undefined> {
    return this.store.transaction([QUEUE], 'read', async (tx) => {
      const raw = await tx.get(QUEUE, id);
      return raw === undefined ? undefined : reviveItem(raw);
    });
  }

  async all(): Promise<readonly QueueItem[]> {
    return this.store.transaction([QUEUE], 'read', async (tx) =>
      (await tx.getAll(QUEUE)).map(reviveItem),
    );
  }

  async byState(state: QueueState): Promise<readonly QueueItem[]> {
    return this.store.transaction([QUEUE], 'read', async (tx) =>
      (await tx.getByIndex(QUEUE, 'by_state', state)).map(reviveItem),
    );
  }

  /** Atualização atômica de um item (usada pelo processador/scheduler). */
  async put(item: QueueItem): Promise<void> {
    await this.store.transaction([QUEUE], 'write', (tx) => tx.put(QUEUE, item.id, item));
  }

  /**
   * Claim atômico de lease: só se PENDING, sem lease ativa.
   * Retorna o item com lease OU undefined (já tomado/não elegível).
   */
  async claimLease(id: string, owner: string, ttlMs: number): Promise<QueueItem | undefined> {
    return this.store.transaction([QUEUE], 'write', async (tx) => {
      const raw = await tx.get(QUEUE, id);
      if (raw === undefined) return undefined;
      const item = reviveItem(raw);
      const now = this.clock();
      const leaseActive =
        item.lease !== undefined && item.lease.expiresAt.getTime() > now.getTime();
      if (item.state !== 'PENDING' || leaseActive) return undefined;
      const leased: QueueItem = {
        ...item,
        lease: { owner, expiresAt: new Date(now.getTime() + ttlMs) },
      };
      await tx.put(QUEUE, id, leased);
      return leased;
    });
  }

  /** Recupera itens presos em SYNCING com lease expirada (crash/fechamento). */
  async reclaimExpiredLeases(): Promise<readonly QueueItem[]> {
    return this.store.transaction([QUEUE], 'write', async (tx) => {
      const now = this.clock();
      const reclaimed: QueueItem[] = [];
      for (const raw of await tx.getByIndex(QUEUE, 'by_state', 'SYNCING')) {
        const item = reviveItem(raw);
        if (item.lease === undefined || item.lease.expiresAt.getTime() <= now.getTime()) {
          const back: QueueItem = { ...item, state: 'PENDING', lease: undefined };
          await tx.put(QUEUE, item.id, back);
          reclaimed.push(back);
          this.events.emit({ type: 'lease_reclaimed', at: now, itemId: item.id });
        }
      }
      return reclaimed;
    });
  }

  /** Limpeza segura: remove apenas SYNCED; qualquer outro estado é erro. */
  async removeCompleted(ids: readonly string[]): Promise<number> {
    return this.store.transaction([QUEUE], 'write', async (tx) => {
      let removed = 0;
      for (const id of ids) {
        const raw = await tx.get(QUEUE, id);
        if (raw === undefined) continue;
        const item = reviveItem(raw);
        if (item.state !== 'SYNCED') throw new SafeCleanupError(id, item.state);
        await tx.delete(QUEUE, id);
        removed += 1;
      }
      if (removed > 0) {
        this.events.emit({ type: 'cleanup_completed', at: this.clock(), detail: { removed } });
      }
      return removed;
    });
  }

  async saveConflict(record: { id: string } & Record<string, unknown>): Promise<void> {
    await this.store.transaction(['conflict_records'], 'write', (tx) =>
      tx.put('conflict_records', record.id, record),
    );
  }

  async conflicts(): Promise<readonly Record<string, unknown>[]> {
    return this.store.transaction(
      ['conflict_records'],
      'read',
      async (tx) => (await tx.getAll('conflict_records')) as Record<string, unknown>[],
    );
  }
}
