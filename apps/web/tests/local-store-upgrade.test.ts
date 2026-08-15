// Upgrade do banco local do app v1 (7.1) → v2 (7.2) no IndexedDB REAL
// (simulado por fake-indexeddb). Prova que a migração é aditiva: as sessões
// já persistidas no aparelho sobrevivem à chegada do quadro de tarefas.
// Arquivo isolado: o import global de IndexedDB não deve afetar outros testes.

import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { IndexedDbLocalStore, type LocalSchema } from '@tauros/infrastructure';

import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';
import { LocalPinLockoutStore } from '../src/wiring/identity-adapters.js';

const V1_SCHEMA: LocalSchema = {
  databaseName: 'tauros-app-state-upgrade',
  version: 1,
  migrations: [APP_STATE_SCHEMA.migrations[0]!],
};

const V2_SCHEMA: LocalSchema = {
  databaseName: 'tauros-app-state-upgrade',
  version: 2,
  migrations: APP_STATE_SCHEMA.migrations.slice(0, 2),
};

const LEGACY_SESSION = {
  id: 'sess-da-7-1',
  storeId: 'store-centro-0001',
  actorEmployeeId: 'emp-0001',
  status: 'ACTIVE',
  operationalDate: '2026-07-21',
};

describe('banco local do app — migração aditiva v2 → v3', () => {
  it('preserva sessões e tarefas ao chegar o store do encarregado', async () => {
    const V2: LocalSchema = {
      databaseName: 'tauros-app-state-upgrade-v3',
      version: 2,
      migrations: APP_STATE_SCHEMA.migrations.slice(0, 2),
    };
    const V3: LocalSchema = { ...APP_STATE_SCHEMA, databaseName: 'tauros-app-state-upgrade-v3' };

    const v2 = new IndexedDbLocalStore(V2);
    await v2.transaction(['operator_sessions'], 'write', (tx) =>
      tx.put('operator_sessions', LEGACY_SESSION.id, LEGACY_SESSION),
    );
    await v2.transaction(['daily_tasks'], 'write', (tx) =>
      tx.put('daily_tasks', 'tarefa-antiga', {
        id: 'tarefa-antiga',
        status: 'DONE',
        storeDateKey: 'store-centro-0001:2026-07-21',
      }),
    );
    await v2.close();

    const v3 = new IndexedDbLocalStore(V3);
    const session = await v3.transaction(['operator_sessions'], 'read', (tx) =>
      tx.get('operator_sessions', LEGACY_SESSION.id),
    );
    const task = await v3.transaction(['daily_tasks'], 'read', (tx) =>
      tx.get('daily_tasks', 'tarefa-antiga'),
    );
    expect(session).toMatchObject({ id: LEGACY_SESSION.id });
    expect(task).toMatchObject({ status: 'DONE' });

    // o store novo nasce vazio e utilizável (índices de idempotência ativos)
    await v3.transaction(['task_templates'], 'write', (tx) =>
      tx.put('task_templates', 'tpl-1', {
        id: 'tpl-1',
        storeId: 'store-centro-0001',
        storeKey: 'store-centro-0001:chave-1',
      }),
    );
    const byKey = await v3.transaction(['task_templates'], 'read', (tx) =>
      tx.getByIndex('task_templates', 'by_store_key', 'store-centro-0001:chave-1'),
    );
    expect(byKey).toHaveLength(1);
    await v3.close();
  });
});

describe('banco local do app — migração aditiva v5 → v6', () => {
  it('preserva jornadas e cria o store de metadados de evidência', async () => {
    const V5: LocalSchema = {
      databaseName: 'tauros-app-state-upgrade-v6',
      version: 5,
      migrations: APP_STATE_SCHEMA.migrations.slice(0, 5),
    };
    const V6: LocalSchema = { ...APP_STATE_SCHEMA, databaseName: 'tauros-app-state-upgrade-v6' };

    const v5 = new IndexedDbLocalStore(V5);
    await v5.transaction(['shift_definitions'], 'write', (tx) =>
      tx.put('shift_definitions', 'def-legado', {
        id: 'def-legado',
        storeId: 'store-centro-0001',
        storeKey: 'store-centro-0001:07:30-19:30',
      }),
    );
    await v5.close();

    const v6 = new IndexedDbLocalStore(V6);
    const definition = await v6.transaction(['shift_definitions'], 'read', (tx) =>
      tx.get('shift_definitions', 'def-legado'),
    );
    expect(definition).toMatchObject({ id: 'def-legado' });

    // store novo nasce vazio e utilizável (índice por tarefa ativo)
    await v6.transaction(['evidence'], 'write', (tx) =>
      tx.put('evidence', 'ev-1', {
        id: 'ev-1',
        storeId: 'store-centro-0001',
        dailyTaskId: 'task-1',
        storeTaskKey: 'store-centro-0001:task-1',
      }),
    );
    const byTask = await v6.transaction(['evidence'], 'read', (tx) =>
      tx.getByIndex('evidence', 'by_store_task', 'store-centro-0001:task-1'),
    );
    expect(byTask).toHaveLength(1);
    await v6.close();
  });
});

describe('banco local do app — migração aditiva v6 → v7 (Identidade Operacional)', () => {
  it('14. preserva dados e cria os stores DEDICADOS de credencial e lockout', async () => {
    const V6: LocalSchema = {
      databaseName: 'tauros-app-state-upgrade-v7',
      version: 6,
      migrations: APP_STATE_SCHEMA.migrations.slice(0, 6),
    };
    const V7: LocalSchema = { ...APP_STATE_SCHEMA, databaseName: 'tauros-app-state-upgrade-v7' };

    const v6 = new IndexedDbLocalStore(V6);
    await v6.transaction(['operator_sessions'], 'write', (tx) =>
      tx.put('operator_sessions', LEGACY_SESSION.id, LEGACY_SESSION),
    );
    await v6.close();

    const v7 = new IndexedDbLocalStore(V7);
    const session = await v7.transaction(['operator_sessions'], 'read', (tx) =>
      tx.get('operator_sessions', LEGACY_SESSION.id),
    );
    expect(session).toMatchObject({ id: LEGACY_SESSION.id });

    // stores novos nascem vazios e utilizáveis (jamais reutilizam fila/evidência)
    const creds = await v7.transaction(['operational_credentials'], 'read', (tx) =>
      tx.getAll('operational_credentials'),
    );
    const locks = await v7.transaction(['pin_lockouts'], 'read', (tx) => tx.getAll('pin_lockouts'));
    expect(creds).toHaveLength(0);
    expect(locks).toHaveLength(0);
    await v7.close();
  });

  it('5. estado de lockout SOBREVIVE ao reload (fecha e reabre o banco)', async () => {
    const SCHEMA: LocalSchema = { ...APP_STATE_SCHEMA, databaseName: 'tauros-app-state-lockout' };
    const policy = { maxAttempts: 2, lockoutStepsMs: [1000] };
    const clock = (): Date => new Date('2026-08-15T08:00:00.000Z');

    const first = new IndexedDbLocalStore(SCHEMA);
    const store1 = new LocalPinLockoutStore(first, clock);
    await store1.registerFailure('store-centro-0001', 'emp-9001', 'device-web-01', policy);
    const locked = await store1.registerFailure(
      'store-centro-0001',
      'emp-9001',
      'device-web-01',
      policy,
    );
    expect(locked.lockedUntil).not.toBeNull();
    await first.close();

    // "reload": novo processo/instância sobre o MESMO banco persistido
    const second = new IndexedDbLocalStore(SCHEMA);
    const store2 = new LocalPinLockoutStore(second, clock);
    const persisted = await store2.get('store-centro-0001', 'emp-9001', 'device-web-01');
    expect(persisted?.consecutiveFailures).toBe(2);
    expect(persisted?.lockedUntil).not.toBeNull();
    await second.close();
  });
});

describe('banco local do app — migração aditiva v4 → v5', () => {
  it('preserva o workforce e cria os stores da Escala Operacional', async () => {
    const V4: LocalSchema = {
      databaseName: 'tauros-app-state-upgrade-v5',
      version: 4,
      migrations: APP_STATE_SCHEMA.migrations.slice(0, 4),
    };
    const V5: LocalSchema = { ...APP_STATE_SCHEMA, databaseName: 'tauros-app-state-upgrade-v5' };

    const v4 = new IndexedDbLocalStore(V4);
    await v4.transaction(['employees'], 'write', (tx) =>
      tx.put('employees', 'emp-legado', {
        id: 'emp-legado',
        storeId: 'store-centro-0001',
        storeKey: 'store-centro-0001:chave-emp-legado',
        fullName: 'Colaborador Legado',
      }),
    );
    await v4.close();

    const v5 = new IndexedDbLocalStore(V5);
    const employee = await v5.transaction(['employees'], 'read', (tx) =>
      tx.get('employees', 'emp-legado'),
    );
    expect(employee).toMatchObject({ fullName: 'Colaborador Legado' });

    // stores novos nascem vazios e utilizáveis (chave natural indexada)
    await v5.transaction(['shift_definitions'], 'write', (tx) =>
      tx.put('shift_definitions', 'def-1', {
        id: 'def-1',
        storeId: 'store-centro-0001',
        storeKey: 'store-centro-0001:07:30-19:30',
      }),
    );
    const byWindow = await v5.transaction(['shift_definitions'], 'read', (tx) =>
      tx.getByIndex('shift_definitions', 'by_store_key', 'store-centro-0001:07:30-19:30'),
    );
    expect(byWindow).toHaveLength(1);
    const patterns = await v5.transaction(['shift_patterns'], 'read', (tx) =>
      tx.getAll('shift_patterns'),
    );
    expect(patterns).toHaveLength(0);
    await v5.close();
  });
});

describe('banco local do app — migração aditiva v3 → v4', () => {
  it('preserva definições e cria os stores da Gestão de Equipe', async () => {
    const V3: LocalSchema = {
      databaseName: 'tauros-app-state-upgrade-v4',
      version: 3,
      migrations: APP_STATE_SCHEMA.migrations.slice(0, 3),
    };
    const V4: LocalSchema = { ...APP_STATE_SCHEMA, databaseName: 'tauros-app-state-upgrade-v4' };

    const v3 = new IndexedDbLocalStore(V3);
    await v3.transaction(['task_templates'], 'write', (tx) =>
      tx.put('task_templates', 'tpl-legado', {
        id: 'tpl-legado',
        storeId: 'store-centro-0001',
        storeKey: 'store-centro-0001:chave-legada',
      }),
    );
    await v3.close();

    const v4 = new IndexedDbLocalStore(V4);
    const template = await v4.transaction(['task_templates'], 'read', (tx) =>
      tx.get('task_templates', 'tpl-legado'),
    );
    expect(template).toMatchObject({ id: 'tpl-legado' });

    // stores novos nascem vazios e utilizáveis (índice de idempotência ativo)
    const employees = await v4.transaction(['employees'], 'read', (tx) => tx.getAll('employees'));
    expect(employees).toHaveLength(0);
    await v4.transaction(['employees', 'employee_assignments'], 'write', async (tx) => {
      await tx.put('employees', 'emp-1', {
        id: 'emp-1',
        storeId: 'store-centro-0001',
        storeKey: 'store-centro-0001:chave-emp',
      });
      await tx.put('employee_assignments', 'asg-1', {
        id: 'asg-1',
        storeId: 'store-centro-0001',
        employeeId: 'emp-1',
      });
    });
    const byKey = await v4.transaction(['employees'], 'read', (tx) =>
      tx.getByIndex('employees', 'by_store_key', 'store-centro-0001:chave-emp'),
    );
    expect(byKey).toHaveLength(1);
    const teams = await v4.transaction(['teams'], 'read', (tx) => tx.getAll('teams'));
    const positions = await v4.transaction(['operational_positions'], 'read', (tx) =>
      tx.getAll('operational_positions'),
    );
    expect(teams).toHaveLength(0);
    expect(positions).toHaveLength(0);
    await v4.close();
  });
});

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
