// Upgrade do banco local do app v1 (7.1) → v2 (7.2) no IndexedDB REAL
// (simulado por fake-indexeddb). Prova que a migração é aditiva: as sessões
// já persistidas no aparelho sobrevivem à chegada do quadro de tarefas.
// Arquivo isolado: o import global de IndexedDB não deve afetar outros testes.

import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { IndexedDbLocalStore, type LocalSchema } from '@tauros/infrastructure';

import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';

const V1_SCHEMA: LocalSchema = {
  databaseName: 'tauros-app-state-upgrade',
  version: 1,
  migrations: [APP_STATE_SCHEMA.migrations[0]!],
};

const V2_SCHEMA: LocalSchema = {
  databaseName: 'tauros-app-state-upgrade',
  version: 2,
  migrations: APP_STATE_SCHEMA.migrations,
};

const LEGACY_SESSION = {
  id: 'sess-da-7-1',
  storeId: 'store-centro-0001',
  actorEmployeeId: 'emp-0001',
  status: 'ACTIVE',
  operationalDate: '2026-07-21',
};

describe('banco local do app — migração aditiva v1 → v2', () => {
  it('preserva as sessões da 7.1 e cria os stores da 7.2', async () => {
    // aparelho que já rodava a 7.1
    const v1 = new IndexedDbLocalStore(V1_SCHEMA);
    await v1.transaction(['operator_sessions'], 'write', (tx) =>
      tx.put('operator_sessions', LEGACY_SESSION.id, LEGACY_SESSION),
    );
    await v1.close();

    // atualização do app: MESMO banco, schema v2
    const v2 = new IndexedDbLocalStore(V2_SCHEMA);

    const preserved = await v2.transaction(['operator_sessions'], 'read', (tx) =>
      tx.get('operator_sessions', LEGACY_SESSION.id),
    );
    expect(preserved).toMatchObject({ id: 'sess-da-7-1', status: 'ACTIVE' });

    // os stores novos existem e nascem vazios
    const tasks = await v2.transaction(['daily_tasks'], 'read', (tx) => tx.getAll('daily_tasks'));
    const executions = await v2.transaction(['task_executions'], 'read', (tx) =>
      tx.getAll('task_executions'),
    );
    expect(tasks).toHaveLength(0);
    expect(executions).toHaveLength(0);

    // e o store novo é utilizável logo após o upgrade
    await v2.transaction(['daily_tasks'], 'write', (tx) =>
      tx.put('daily_tasks', 'tarefa-1', {
        id: 'tarefa-1',
        storeDateKey: 'store-centro-0001:2026-07-21',
      }),
    );
    const found = await v2.transaction(['daily_tasks'], 'read', (tx) =>
      tx.getByIndex('daily_tasks', 'by_store_date', 'store-centro-0001:2026-07-21'),
    );
    expect(found).toHaveLength(1);
    await v2.close();
  });
});
