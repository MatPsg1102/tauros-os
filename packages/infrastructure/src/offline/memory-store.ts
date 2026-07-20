// Implementação em memória do LocalStorePort.
// Usada em testes e como fallback; contrato idêntico ao adapter IndexedDB.
// Atomicidade: escritas são aplicadas em buffer e commitadas só no sucesso.

import {
  LocalStoreError,
  resolveKeyPath,
  type LocalSchema,
  type LocalStoreDefinition,
  type LocalStorePort,
  type LocalTransaction,
} from './local-store.js';

type StoreMap = Map<string, unknown>;

export class MemoryLocalStore implements LocalStorePort {
  private readonly data = new Map<string, StoreMap>();
  private readonly definitions = new Map<string, LocalStoreDefinition>();
  private chain: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(readonly schema: LocalSchema) {
    // Migrations incrementais; onUpgrade que lança aborta a construção inteira
    // (nenhum estado parcial — a instância não chega a existir).
    for (const migration of [...schema.migrations].sort((a, b) => a.toVersion - b.toVersion)) {
      if (migration.toVersion > schema.version) continue;
      migration.onUpgrade?.();
      for (const store of migration.stores) {
        this.definitions.set(store.name, store);
        if (!this.data.has(store.name)) this.data.set(store.name, new Map());
      }
    }
  }

  transaction<T>(
    stores: readonly string[],
    mode: 'read' | 'write',
    fn: (tx: LocalTransaction) => Promise<T> | T,
  ): Promise<T> {
    if (this.closed) {
      return Promise.reject(new LocalStoreError('Store fechado. Reabra antes de usar.'));
    }
    for (const s of stores) {
      if (!this.data.has(s)) {
        return Promise.reject(new LocalStoreError(`Object store desconhecido: "${s}".`));
      }
    }

    // Serializa transações (uma por vez) para garantir isolamento.
    const run = this.chain.then(async () => {
      const writes: Array<{ store: string; key: string; value: unknown | undefined }> = [];
      const view = this.buildTx(stores, mode, writes);
      const result = await fn(view);
      for (const w of writes) {
        const map = this.data.get(w.store)!;
        if (w.value === undefined) map.delete(w.key);
        else map.set(w.key, w.value);
      }
      return result;
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }

  private buildTx(
    stores: readonly string[],
    mode: 'read' | 'write',
    writes: Array<{ store: string; key: string; value: unknown | undefined }>,
  ): LocalTransaction {
    const assertStore = (store: string): StoreMap => {
      if (!stores.includes(store)) {
        throw new LocalStoreError(`Store "${store}" fora do escopo da transação.`);
      }
      return this.data.get(store)!;
    };
    const assertWrite = (): void => {
      if (mode !== 'write') throw new LocalStoreError('Escrita em transação read-only.');
    };
    const pendingView = (store: string): StoreMap => {
      // Visão da transação: dados commitados + escritas pendentes desta tx.
      const base = new Map(assertStore(store));
      for (const w of writes) {
        if (w.store !== store) continue;
        if (w.value === undefined) base.delete(w.key);
        else base.set(w.key, w.value);
      }
      return base;
    };

    return {
      get: (store, key) => Promise.resolve(structuredClone(pendingView(store).get(key))),
      put: (store, key, value) => {
        assertStore(store);
        assertWrite();
        writes.push({ store, key, value: structuredClone(value) });
        return Promise.resolve();
      },
      delete: (store, key) => {
        assertStore(store);
        assertWrite();
        writes.push({ store, key, value: undefined });
        return Promise.resolve();
      },
      getAll: (store) =>
        Promise.resolve([...pendingView(store).values()].map((v) => structuredClone(v))),
      getByIndex: (store, index, value) => {
        const def = this.definitions.get(store);
        const keyPath = def?.indexes?.[index];
        if (keyPath === undefined) {
          throw new LocalStoreError(`Índice desconhecido: "${store}.${index}".`);
        }
        const hits = [...pendingView(store).values()].filter(
          (v) => resolveKeyPath(v, keyPath) === value,
        );
        return Promise.resolve(hits.map((v) => structuredClone(v)));
      },
    };
  }
}
