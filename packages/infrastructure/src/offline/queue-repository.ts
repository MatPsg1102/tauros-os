// Repositório da fila sobre o LocalStorePort (RA-QUEUE-01 §2/§4).
// Persistência via codec canônico (§2): entrada inválida vai para QUARENTENA e
// nunca ao processador. Lease com fencing token (§6). Limpeza segura registra
// TOMBSTONE — evidência de conclusão para a DAG (§5).

import { assertAcyclic, dependencyStatus, InvalidDependencyError } from './dag.js';
import { decodeQueueItem, encodeQueueItem } from './codec.js';
import { makeEvent, type TechnicalEventPort } from './events.js';
import type { LocalSchema, LocalStorePort, LocalTransaction } from './local-store.js';
import type { NewQueueItem, QueueItem } from './queue-item.js';
import { createQueueItem } from './queue-item.js';
import type { OfflineTechnicalParameters } from './offline-parameters.js';
import type { QueueState } from './state-machine.js';

export const OFFLINE_SCHEMA: LocalSchema = {
  databaseName: 'tauros-offline',
  version: 1,
  migrations: [
    {
      toVersion: 1,
      description: 'Fila offline, conflitos, quarentena, tombstones e metadados',
      stores: [
        { name: 'queue_items', indexes: { by_state: 'state', by_entity: 'entityType' } },
        { name: 'conflict_records', indexes: { by_item: 'itemId' } },
        { name: 'quarantine' },
        { name: 'tombstones' },
        { name: 'meta' },
      ],
    },
  ],
};

const QUEUE = 'queue_items';
const TOMBSTONES = 'tombstones';
const QUARANTINE = 'quarantine';

export class SafeCleanupError extends Error {
  constructor(itemId: string, state: string) {
    super(
      `Limpeza negada para "${itemId}" em estado ${state}. ` +
        `Somente itens SYNCED podem ser removidos da fila.`,
    );
    this.name = 'SafeCleanupError';
  }
}

export class PayloadTooLargeError extends Error {
  constructor(itemId: string, bytes: number, max: number) {
    super(
      `Payload de "${itemId}" tem ${bytes} bytes (máximo ${max}). ` +
        `Reduza o payload ou envie como anexo.`,
    );
    this.name = 'PayloadTooLargeError';
  }
}

interface Tombstone {
  readonly itemId: string;
  readonly removedAt: string;
  readonly finalState: 'SYNCED';
}

export class LocalQueueRepository {
  constructor(
    private readonly store: LocalStorePort,
    private readonly events: TechnicalEventPort,
    private readonly clock: () => Date,
    private readonly params: Pick<
      OfflineTechnicalParameters,
      'maxPayloadBytes' | 'maxConflictRecords'
    >,
  ) {}

  /**
   * Enfileira validando: tamanho de payload, aciclicidade e EXISTÊNCIA das
   * dependências (dep desconhecida sem tombstone ⇒ InvalidDependencyError).
   */
  async enqueue(input: NewQueueItem): Promise<QueueItem> {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(input.payload ?? null)).length;
    if (payloadBytes > this.params.maxPayloadBytes) {
      throw new PayloadTooLargeError(input.id, payloadBytes, this.params.maxPayloadBytes);
    }

    return this.store.transaction([QUEUE, TOMBSTONES, QUARANTINE], 'write', async (tx) => {
      const { byId } = await this.loadValid(tx);
      const tombstones = await this.loadTombstones(tx);

      try {
        assertAcyclic({ id: input.id, dependsOn: input.dependsOn ?? [] }, byId);
      } catch (error) {
        this.events.emit(
          makeEvent(
            {
              eventType: 'cycle_detected',
              queueItemId: input.id,
              storeId: input.trace.storeId,
              error: { name: 'CycleDetectedError', message: (error as Error).message },
            },
            this.clock(),
          ),
        );
        throw error;
      }

      const status = dependencyStatus({ dependsOn: input.dependsOn ?? [] }, byId, tombstones);
      if (status.missing.length > 0) {
        throw new InvalidDependencyError(input.id, status.missing);
      }

      const item = createQueueItem(input, this.clock(), !status.satisfied);
      await tx.put(QUEUE, item.id, encodeQueueItem(item));
      this.events.emit(
        makeEvent(
          {
            eventType: status.satisfied ? 'item_enqueued' : 'item_blocked',
            queueItemId: item.id,
            storeId: item.trace.storeId,
            sessionId: item.trace.sessionId,
            nextState: item.state,
          },
          this.clock(),
        ),
      );
      return item;
    });
  }

  async get(id: string): Promise<QueueItem | undefined> {
    return this.store.transaction([QUEUE, QUARANTINE], 'write', async (tx) => {
      const raw = await tx.get(QUEUE, id);
      if (raw === undefined) return undefined;
      const decoded = decodeQueueItem(raw);
      if (decoded.ok) return decoded.item;
      await this.quarantine(tx, id, raw, decoded.reason);
      return undefined;
    });
  }

  async all(): Promise<readonly QueueItem[]> {
    return this.store.transaction([QUEUE, QUARANTINE], 'write', async (tx) => {
      const { items } = await this.loadValid(tx, true);
      return items;
    });
  }

  async byState(state: QueueState): Promise<readonly QueueItem[]> {
    return (await this.all()).filter((i) => i.state === state);
  }

  async tombstoneIds(): Promise<ReadonlySet<string>> {
    return this.store.transaction([TOMBSTONES], 'read', async (tx) => this.loadTombstones(tx));
  }

  /** Atualização atômica SEM guarda de lease (uso: scheduler/promoção). */
  async put(item: QueueItem): Promise<void> {
    await this.store.transaction([QUEUE], 'write', (tx) =>
      tx.put(QUEUE, item.id, encodeQueueItem(item)),
    );
  }

  /**
   * Atualização GUARDADA por fencing token (§6): só persiste se o item ainda
   * carrega a lease com o token esperado. Worker antigo ⇒ false, nada gravado.
   */
  async putIfLeaseHolder(item: QueueItem, expectedToken: string): Promise<boolean> {
    return this.store.transaction([QUEUE], 'write', async (tx) => {
      const raw = await tx.get(QUEUE, item.id);
      if (raw === undefined) return false;
      const current = decodeQueueItem(raw);
      if (!current.ok) return false;
      if (current.item.lease?.token !== expectedToken) return false;
      await tx.put(QUEUE, item.id, encodeQueueItem(item));
      return true;
    });
  }

  /** Claim atômico com fencing token; só PENDING sem lease ativa. */
  async claimLease(id: string, owner: string, ttlMs: number): Promise<QueueItem | undefined> {
    return this.store.transaction([QUEUE], 'write', async (tx) => {
      const raw = await tx.get(QUEUE, id);
      if (raw === undefined) return undefined;
      const decoded = decodeQueueItem(raw);
      if (!decoded.ok) return undefined;
      const item = decoded.item;
      const now = this.clock();
      const leaseActive =
        item.lease !== undefined && item.lease.expiresAt.getTime() > now.getTime();
      if (item.state !== 'PENDING' || leaseActive) return undefined;
      const leased: QueueItem = {
        ...item,
        lease: { owner, token: crypto.randomUUID(), expiresAt: new Date(now.getTime() + ttlMs) },
      };
      await tx.put(QUEUE, id, encodeQueueItem(leased));
      return leased;
    });
  }

  /** Recupera SYNCING com lease expirada (crash/aba fechada) para PENDING. */
  async reclaimExpiredLeases(): Promise<readonly QueueItem[]> {
    return this.store.transaction([QUEUE, QUARANTINE], 'write', async (tx) => {
      const now = this.clock();
      const reclaimed: QueueItem[] = [];
      const { items } = await this.loadValid(tx, true);
      for (const item of items) {
        if (item.state !== 'SYNCING') continue;
        if (item.lease === undefined || item.lease.expiresAt.getTime() <= now.getTime()) {
          const back: QueueItem = { ...item, state: 'PENDING', lease: undefined };
          await tx.put(QUEUE, item.id, encodeQueueItem(back));
          reclaimed.push(back);
          this.events.emit(
            makeEvent(
              {
                eventType: 'lease_reclaimed',
                queueItemId: item.id,
                storeId: item.trace.storeId,
                previousState: 'SYNCING',
                nextState: 'PENDING',
              },
              now,
            ),
          );
        }
      }
      return reclaimed;
    });
  }

  /** Limpeza segura: remove SYNCED e grava TOMBSTONE (evidência p/ DAG §5). */
  async removeCompleted(ids: readonly string[]): Promise<number> {
    return this.store.transaction([QUEUE, TOMBSTONES], 'write', async (tx) => {
      let removed = 0;
      for (const id of ids) {
        const raw = await tx.get(QUEUE, id);
        if (raw === undefined) continue;
        const decoded = decodeQueueItem(raw);
        const state = decoded.ok ? decoded.item.state : 'INVALID';
        if (state !== 'SYNCED') throw new SafeCleanupError(id, state);
        const tombstone: Tombstone = {
          itemId: id,
          removedAt: this.clock().toISOString(),
          finalState: 'SYNCED',
        };
        await tx.put(TOMBSTONES, id, tombstone);
        await tx.delete(QUEUE, id);
        removed += 1;
      }
      if (removed > 0) {
        this.events.emit(
          makeEvent({ eventType: 'cleanup_completed', metadata: { removed } }, this.clock()),
        );
      }
      return removed;
    });
  }

  /** Registros de conflito com limite técnico (mais antigos são descartados). */
  async saveConflict(
    record: { id: string; detectedAt: Date } & Record<string, unknown>,
  ): Promise<void> {
    await this.store.transaction(['conflict_records'], 'write', async (tx) => {
      await tx.put('conflict_records', record.id, {
        ...record,
        detectedAt: record.detectedAt.toISOString(),
      });
      const all = (await tx.getAll('conflict_records')) as Array<{
        id: string;
        detectedAt: string;
      }>;
      if (all.length > this.params.maxConflictRecords) {
        const excess = all
          .sort((a, b) => a.detectedAt.localeCompare(b.detectedAt))
          .slice(0, all.length - this.params.maxConflictRecords);
        for (const old of excess) await tx.delete('conflict_records', old.id);
      }
    });
  }

  async conflicts(): Promise<readonly Record<string, unknown>[]> {
    return this.store.transaction(
      ['conflict_records'],
      'read',
      async (tx) => (await tx.getAll('conflict_records')) as Record<string, unknown>[],
    );
  }

  async quarantined(): Promise<readonly Record<string, unknown>[]> {
    return this.store.transaction(
      [QUARANTINE],
      'read',
      async (tx) => (await tx.getAll(QUARANTINE)) as Record<string, unknown>[],
    );
  }

  private async loadTombstones(tx: LocalTransaction): Promise<ReadonlySet<string>> {
    const rows = (await tx.getAll(TOMBSTONES)) as readonly Tombstone[];
    return new Set(rows.map((t) => t.itemId));
  }

  /** Carrega itens válidos; inválidos vão à quarentena (nunca ao processador). */
  private async loadValid(
    tx: LocalTransaction,
    quarantineInvalid = false,
  ): Promise<{ items: readonly QueueItem[]; byId: ReadonlyMap<string, QueueItem> }> {
    const items: QueueItem[] = [];
    for (const raw of await tx.getAll(QUEUE)) {
      const decoded = decodeQueueItem(raw);
      if (decoded.ok) {
        items.push(decoded.item);
      } else if (quarantineInvalid) {
        const id = (raw as { id?: string }).id ?? `unknown:${crypto.randomUUID()}`;
        await this.quarantine(tx, id, raw, decoded.reason);
      }
    }
    return { items, byId: new Map(items.map((i) => [i.id, i] as const)) };
  }

  private async quarantine(
    tx: LocalTransaction,
    id: string,
    raw: unknown,
    reason: string,
  ): Promise<void> {
    await tx.put(QUARANTINE, id, {
      quarantinedAt: this.clock().toISOString(),
      reason,
      raw,
    });
    await tx.delete(QUEUE, id);
    this.events.emit(
      makeEvent(
        {
          eventType: 'item_quarantined',
          queueItemId: id,
          error: { name: 'PersistenceValidationError', message: reason },
        },
        this.clock(),
      ),
    );
  }
}
