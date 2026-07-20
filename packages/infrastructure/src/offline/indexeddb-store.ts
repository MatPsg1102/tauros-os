// Adapter IndexedDB do LocalStorePort (produção, via `idb`).
// Mesmo contrato do MemoryLocalStore — os testes de contrato rodam na memória;
// este adapter mantém-se fino de propósito.

import { openDB, type IDBPDatabase } from 'idb';

import {
  LocalStoreError,
  type LocalSchema,
  type LocalStorePort,
  type LocalTransaction,
} from './local-store.js';

export class IndexedDbLocalStore implements LocalStorePort {
  private db: IDBPDatabase | null = null;

  constructor(readonly schema: LocalSchema) {}

  private async open(): Promise<IDBPDatabase> {
    if (this.db) return this.db;
    const { migrations } = this.schema;
    this.db = await openDB(this.schema.databaseName, this.schema.version, {
      upgrade(db, oldVersion) {
        for (const migration of [...migrations].sort((a, b) => a.toVersion - b.toVersion)) {
          if (migration.toVersion <= oldVersion) continue;
          for (const store of migration.stores) {
            const os = db.objectStoreNames.contains(store.name)
              ? null
              : db.createObjectStore(store.name);
            if (os && store.indexes) {
              for (const [indexName, keyPath] of Object.entries(store.indexes)) {
                os.createIndex(indexName, keyPath);
              }
            }
          }
        }
      },
    });
    return this.db;
  }

  async transaction<T>(
    stores: readonly string[],
    mode: 'read' | 'write',
    fn: (tx: LocalTransaction) => Promise<T> | T,
  ): Promise<T> {
    const db = await this.open();
    const idbTx = db.transaction([...stores], mode === 'write' ? 'readwrite' : 'readonly');

    const view: LocalTransaction = {
      get: async (store, key) => idbTx.objectStore(store).get(key),
      put: async (store, key, value) => {
        if (mode !== 'write') throw new LocalStoreError('Escrita em transação read-only.');
        // `put` só é tipado em transações readwrite; o guard acima garante o modo.
        await idbTx.objectStore(store).put!(value, key);
      },
      delete: async (store, key) => {
        if (mode !== 'write') throw new LocalStoreError('Escrita em transação read-only.');
        await idbTx.objectStore(store).delete!(key);
      },
      getAll: async (store) => idbTx.objectStore(store).getAll(),
      getByIndex: async (store, index, value) =>
        idbTx
          .objectStore(store)
          .index(index)
          .getAll(value as IDBValidKey),
    };

    try {
      const result = await fn(view);
      await idbTx.done;
      return result;
    } catch (error) {
      try {
        idbTx.abort();
      } catch {
        // transação já finalizada — nada a abortar
      }
      throw new LocalStoreError('Transação IndexedDB abortada.', { cause: error });
    }
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}
