// Fronteira da nuvem (P-0001): mapeamento linha ↔ HistoryEntry com saneamento,
// wrappers de auth e ausência de nuvem sem variáveis de ambiente. Os clients
// falsos implementam só o subconjunto estrutural usado pelo código.
import { describe, expect, it, vi } from 'vitest';

import {
  CALCULATIONS_TABLE,
  createCloudApi,
  createCloudAuth,
  createCloudHistory,
  type AuthClientLike,
  type TableClientLike,
} from './cloud.js';
import type { HistoryEntry } from './model.js';

const ENTRY: HistoryEntry = {
  id: '11111111-1111-4111-8111-111111111111',
  savedAt: '2026-09-17T12:00:00.000Z',
  mode: 'real',
  quick: {
    animals: 100,
    avgLiveWeightKg: 115,
    livePricePerKg: 5.2,
    slaughterLossPct: 17,
    coolingLossPct: 2.5,
  },
  real: {
    animals: 110,
    scaleWeightKg: 12560,
    discountsKg: 220,
    slaughteredWeightKg: 10513.5,
    chilledWeightKg: 10217.2,
    livePricePerKg: 4.8,
  },
  costs: { slaughterFeePerHead: 50, servicePerHead: 3, driverDailyRate: 150, fuelCost: 0 },
  summary: {
    animals: 110,
    referenceWeightKg: 12340,
    finalWeightKg: 10217.2,
    livePricePerKg: 4.8,
    costPerKg: 6.38,
  },
};

type Row = Record<string, unknown>;

interface FakeTable {
  readonly rows: unknown[];
  readonly calls: string[];
  failWith: string | null;
}

function fakeTable(initial: unknown[]): {
  readonly client: TableClientLike;
  readonly fake: FakeTable;
} {
  const fake: FakeTable = { rows: [...initial], calls: [], failWith: null };
  const result = <T>(data: T): Promise<{ data: T; error: { message: string } | null }> =>
    Promise.resolve({ data, error: fake.failWith === null ? null : { message: fake.failWith } });
  const client: TableClientLike = {
    from: (table) => {
      fake.calls.push(`from:${table}`);
      return {
        select: (columns) => ({
          order: (column, options) => ({
            limit: (count) => {
              fake.calls.push(
                `select:${columns} order:${column}:${String(options.ascending)} limit:${count}`,
              );
              return result<unknown>(fake.rows);
            },
          }),
        }),
        insert: (row) => {
          fake.calls.push('insert');
          if (fake.failWith === null) fake.rows.push(row);
          return result(null);
        },
        delete: () => ({
          eq: (column, value) => {
            fake.calls.push(`delete:${column}=${value}`);
            const index = fake.rows.findIndex(
              (row) => typeof row === 'object' && row !== null && (row as Row)[column] === value,
            );
            if (index >= 0 && fake.failWith === null) fake.rows.splice(index, 1);
            return result(null);
          },
        }),
      };
    },
  };
  return { client, fake };
}

function rowOf(entry: HistoryEntry): Row {
  const { id, savedAt, ...rest } = entry;
  return { id, saved_at: savedAt, entry: rest };
}

describe('createCloudHistory', () => {
  it('lista em ordem decrescente de saved_at e reconstrói o HistoryEntry exato', async () => {
    const { client, fake } = fakeTable([rowOf(ENTRY)]);
    const entries = await createCloudHistory(client).list();
    expect(entries).toEqual([ENTRY]);
    expect(fake.calls).toEqual([
      `from:${CALCULATIONS_TABLE}`,
      'select:id,saved_at,entry order:saved_at:false limit:50',
    ]);
  });

  it('descarta linha inválida e saneia campo a campo, sem derrubar a lista', async () => {
    const { client } = fakeTable([
      rowOf(ENTRY),
      { id: 'sem-entry', saved_at: '2026-09-17T13:00:00.000Z' },
      { id: 42, saved_at: '2026-09-17T13:00:00.000Z', entry: {} },
      {
        id: '22222222-2222-4222-8222-222222222222',
        saved_at: '2026-09-17T14:00:00.000Z',
        entry: { mode: 'quick', quick: { animals: 'x' }, summary: { costPerKg: 7.2 } },
      },
      'lixo',
    ]);
    const entries = await createCloudHistory(client).list();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(ENTRY);
    expect(entries[1]?.mode).toBe('quick');
    expect(entries[1]?.quick.animals).toBe(110);
    expect(entries[1]?.summary.costPerKg).toBe(7.2);
    expect(entries[1]?.summary.animals).toBeNull();
  });

  it('salva id e saved_at como colunas e o restante em entry; remove por id', async () => {
    const { client, fake } = fakeTable([]);
    const history = createCloudHistory(client);
    await history.save(ENTRY);
    expect(fake.rows).toEqual([rowOf(ENTRY)]);
    await history.remove(ENTRY.id);
    expect(fake.rows).toEqual([]);
    expect(fake.calls).toContain(`delete:id=${ENTRY.id}`);
  });

  it('erro do banco vira exceção com a mensagem original', async () => {
    const { client, fake } = fakeTable([]);
    fake.failWith = 'permission denied for table carcass_cost_calculations';
    const history = createCloudHistory(client);
    await expect(history.list()).rejects.toThrow('permission denied');
    await expect(history.save(ENTRY)).rejects.toThrow('permission denied');
    await expect(history.remove(ENTRY.id)).rejects.toThrow('permission denied');
  });
});

type Listener = (event: string, session: { user: { email?: string } } | null) => void;

function fakeAuthClient(initialEmail: string | null): {
  readonly client: AuthClientLike;
  readonly listeners: Listener[];
  readonly unsubscribe: ReturnType<typeof vi.fn>;
} {
  let email = initialEmail;
  const listeners: Listener[] = [];
  const unsubscribe = vi.fn();
  const session = (): { user: { email?: string } } | null =>
    email === null ? null : { user: { email } };
  const client: AuthClientLike = {
    getSession: () => Promise.resolve({ data: { session: session() } }),
    onAuthStateChange: (callback) => {
      listeners.push(callback);
      return { data: { subscription: { unsubscribe } } };
    },
    signInWithPassword: (credentials) => {
      if (credentials.password !== 'segredo') {
        return Promise.resolve({ error: { message: 'Invalid login credentials' } });
      }
      email = credentials.email;
      return Promise.resolve({ error: null });
    },
    signOut: () => {
      email = null;
      return Promise.resolve({ error: null });
    },
  };
  return { client, listeners, unsubscribe };
}

describe('createCloudAuth', () => {
  it('expõe só o e-mail da sessão; sem sessão devolve null', async () => {
    expect(await createCloudAuth(fakeAuthClient('a@x.com').client).getSession()).toEqual({
      email: 'a@x.com',
    });
    expect(await createCloudAuth(fakeAuthClient(null).client).getSession()).toBeNull();
  });

  it('login errado devolve mensagem em pt-BR; certo devolve null e passa a ter sessão', async () => {
    const auth = createCloudAuth(fakeAuthClient(null).client);
    expect(await auth.signIn('a@x.com', 'errada')).toBe('E-mail ou senha inválidos.');
    expect(await auth.signIn('a@x.com', 'segredo')).toBeNull();
    expect(await auth.getSession()).toEqual({ email: 'a@x.com' });
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
  });

  it('onChange traduz eventos do supabase e cancela a assinatura', () => {
    const { client, listeners, unsubscribe } = fakeAuthClient(null);
    const listener = vi.fn();
    const stop = createCloudAuth(client).onChange(listener);
    listeners[0]?.('SIGNED_IN', { user: { email: 'b@x.com' } });
    listeners[0]?.('SIGNED_OUT', null);
    expect(listener.mock.calls).toEqual([[{ email: 'b@x.com' }], [null]]);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('createCloudApi', () => {
  it('sem as duas variáveis VITE_* não há nuvem (app só local)', () => {
    expect(createCloudApi({})).toBeNull();
    expect(createCloudApi({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(createCloudApi({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
  });

  it('com as variáveis cria auth e history sem tocar a rede', () => {
    const api = createCloudApi({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-de-teste',
    });
    expect(api).not.toBeNull();
    expect(typeof api?.auth.signIn).toBe('function');
    expect(typeof api?.history.list).toBe('function');
  });
});
