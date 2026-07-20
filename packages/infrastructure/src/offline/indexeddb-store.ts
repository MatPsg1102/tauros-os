// Adapter IndexedDB do LocalStorePort (produção, via `idb`).
// Mesmo contrato do MemoryLocalStore — comprovado pela suíte de contrato
// compartilhada (local-store-contract.ts) rodando sobre fake-indexeddb.
//
// Diferenças deliberadas vs MemoryLocalStore (documentadas):
// - Persistência durável entre instâncias/reaberturas (memória é process-lifetime).
// - Versão futura desconhecida ⇒ FutureVersionError (memória não versiona em disco).

import { deleteDB, openDB, type IDBPDatabase } from 'idb';

import type { TechnicalEventPort } from './events.js';
import { makeEvent } from './events.js';
import {
  FutureVersionError,
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
    let migrationError: unknown;
    try {
      this.db = await openDB(this.schema.databaseName, this.schema.version, {
        upgrade(db, oldVersion, _newVersion, transaction) {
          transaction.done.catch(() => undefined);
          try {
            // Incremental e atômico: hook que lança aborta o upgrade inteiro
            // (o IndexedDB garante rollback da transação de versão).
            for (const migration of [...migrations].sort((a, b) => a.toVersion - b.toVersion)) {
              if (migration.toVersion <= oldVersion) continue;
              migration.onUpgrade?.();
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
          } catch (error) {
            // Aborta o upgrade inteiro: o banco permanece na versão anterior.
            migrationError = error;
            transaction.abort();
          }
        },
        blocked() {
          // Outra aba segura a versão antiga; a abertura aguarda.
        },
      });
    } catch (error) {
      if (migrationError !== undefined) {
        throw new LocalStoreError('Migration local falhou; banco permanece na versão anterior.', {
          cause: migrationError,
        });
      }
      if (error instanceof Error && error.name === 'VersionError') {
        // Banco numa versão MAIOR que a suportada: rejeitar, nunca apagar.
        throw new FutureVersionError(this.schema.databaseName);
      }
      throw new LocalStoreError('Falha ao abrir o banco local.', { cause: error });
    }
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
      // Evita unhandled rejection do done após abort.
      idbTx.done.catch(() => undefined);
      try {
        idbTx.abort();
      } catch {
        // transação já finalizada — nada a abortar
      }
      throw error instanceof LocalStoreError
        ? error
        : new LocalStoreError('Transação IndexedDB abortada.', { cause: error });
    }
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}

/**
 * Destruição COMPLETA do banco local — ação EXCEPCIONAL, explícita e auditável
 * (evento técnico obrigatório). Nunca usada como caminho normal de migration.
 */
export async function destroyLocalDatabase(
  schema: LocalSchema,
  events: TechnicalEventPort,
  clock: () => Date,
  reason: string,
): Promise<void> {
  await deleteDB(schema.databaseName);
  events.emit(
    makeEvent(
      { eventType: 'database_destroyed', metadata: { database: schema.databaseName, reason } },
      clock(),
    ),
  );
}
