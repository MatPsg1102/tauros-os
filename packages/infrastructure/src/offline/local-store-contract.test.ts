// Executa a MESMA suíte de contrato contra os dois adapters (§1).
// IndexedDB real é simulado por fake-indexeddb (sem navegador, sem rede).

import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { IndexedDbLocalStore } from './indexeddb-store.js';
import { localStoreContract } from './local-store-contract.js';
import { FutureVersionError, type LocalSchema, type LocalStorePort } from './local-store.js';
import { MemoryLocalStore } from './memory-store.js';

let counter = 0;
const unique = (prefix: string) => () => `${prefix}-${Date.now()}-${(counter += 1)}`;

// ---------------------------------------------------------------------------
// MemoryLocalStore — process-lifetime (reabrir = vazio), sem versão em disco.
// ---------------------------------------------------------------------------
localStoreContract('MemoryLocalStore', {
  createStore: (schema) => Promise.resolve(new MemoryLocalStore(schema)),
  reopen: async (previous, schema) => {
    await previous.close();
    return new MemoryLocalStore(schema);
  },
  durableAcrossReopen: false,
  uniqueName: unique('mem'),
});

// ---------------------------------------------------------------------------
// IndexedDbLocalStore — durável entre reaberturas (fake-indexeddb).
// ---------------------------------------------------------------------------
localStoreContract('IndexedDbLocalStore (fake-indexeddb)', {
  createStore: (schema) => Promise.resolve(new IndexedDbLocalStore(schema)),
  reopen: async (previous: LocalStorePort, schema) => {
    await previous.close();
    const next = new IndexedDbLocalStore(schema);
    // força a abertura imediata para que erros de migration apareçam aqui
    await next.transaction([schema.migrations[0]!.stores[0]!.name], 'read', (tx) =>
      tx.getAll(schema.migrations[0]!.stores[0]!.name),
    );
    return next;
  },
  durableAcrossReopen: true,
  uniqueName: unique('idb'),
});

// ---------------------------------------------------------------------------
// Comportamentos específicos do adapter durável.
// ---------------------------------------------------------------------------
describe('IndexedDbLocalStore — versão futura (§3)', () => {
  it('rejeita banco em versão futura com FutureVersionError, sem apagar dados', async () => {
    const name = `future-${Date.now()}`;
    const v2: LocalSchema = {
      databaseName: name,
      version: 2,
      migrations: [
        { toVersion: 1, description: 'v1', stores: [{ name: 'items' }] },
        { toVersion: 2, description: 'v2', stores: [{ name: 'extra' }] },
      ],
    };
    const newer = new IndexedDbLocalStore(v2);
    await newer.transaction(['items'], 'write', (tx) => tx.put('items', 'k', { id: 'k' }));
    await newer.close();

    // Aplicação antiga (v1) abrindo banco v2 ⇒ rejeição segura.
    const v1: LocalSchema = {
      databaseName: name,
      version: 1,
      migrations: [{ toVersion: 1, description: 'v1', stores: [{ name: 'items' }] }],
    };
    const older = new IndexedDbLocalStore(v1);
    await expect(
      older.transaction(['items'], 'read', (tx) => tx.get('items', 'k')),
    ).rejects.toThrow(FutureVersionError);

    // Dados intactos: a versão correta ainda lê tudo.
    const again = new IndexedDbLocalStore(v2);
    await expect(
      again.transaction(['items'], 'read', (tx) => tx.get('items', 'k')),
    ).resolves.toMatchObject({ id: 'k' });
    await again.close();
  });
});
