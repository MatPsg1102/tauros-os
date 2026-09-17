// Nuvem opcional do Carcass Cost (P-0001): Supabase Auth por e-mail/senha e a
// tabela public.carcass_cost_calculations (RLS owner-only por auth.uid()).
// Fronteira mínima, justificada pelos dois consumidores: o App usa `auth`,
// o useCalculator usa `history`. Sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
// não existe nuvem e o app se comporta exatamente como antes (só localStorage).
// Identidade de produto separada do Employee + PIN do Tauros OS (ADR-021 intocado).

import { createClient } from '@supabase/supabase-js';

import type { HistoryEntry } from './model.js';
import { HISTORY_LIMIT, sanitizeHistoryEntry } from './storage.js';

export interface CloudSession {
  readonly email: string;
}

export interface CloudAuth {
  /** Sessão persistida pelo supabase-js (sobrevive a recarregar/fechar a aba). */
  readonly getSession: () => Promise<CloudSession | null>;
  /** Notifica login/logout; devolve a função que cancela a assinatura. */
  readonly onChange: (listener: (session: CloudSession | null) => void) => () => void;
  /** Resolve com a mensagem de erro (pt-BR) ou null em sucesso. */
  readonly signIn: (email: string, password: string) => Promise<string | null>;
  readonly signOut: () => Promise<void>;
}

export interface CloudHistory {
  readonly list: () => Promise<readonly HistoryEntry[]>;
  readonly save: (entry: HistoryEntry) => Promise<void>;
  readonly remove: (id: string) => Promise<void>;
}

export interface CloudApi {
  readonly auth: CloudAuth;
  readonly history: CloudHistory;
}

export const CALCULATIONS_TABLE = 'carcass_cost_calculations';
export const CLOUD_UNAVAILABLE_MESSAGE = 'Sem conexão com a nuvem. Tente novamente.';

// Subconjuntos estruturais do supabase-js realmente usados: os testes
// implementam só isto e o client real é aceito por compatibilidade estrutural.
interface SessionLike {
  readonly user: { readonly email?: string };
}
interface ErrorLike {
  readonly message: string;
}
export interface AuthClientLike {
  getSession(): Promise<{ data: { session: SessionLike | null } }>;
  onAuthStateChange(callback: (event: string, session: SessionLike | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ error: ErrorLike | null }>;
  signOut(): Promise<{ error: ErrorLike | null }>;
}
interface QueryResult<T> {
  readonly data: T;
  readonly error: ErrorLike | null;
}
export interface TableClientLike {
  from(table: string): {
    select(columns: string): {
      order(
        column: string,
        options: { ascending: boolean },
      ): { limit(count: number): PromiseLike<QueryResult<unknown>> };
    };
    insert(row: Record<string, unknown>): PromiseLike<{ error: ErrorLike | null }>;
    delete(): { eq(column: string, value: string): PromiseLike<{ error: ErrorLike | null }> };
  };
}

function sessionOf(session: SessionLike | null): CloudSession | null {
  const email = session?.user.email;
  return typeof email === 'string' && email.length > 0 ? { email } : null;
}

function signInMessage(error: ErrorLike): string {
  if (/invalid login credentials/i.test(error.message)) return 'E-mail ou senha inválidos.';
  if (/fetch|network/i.test(error.message)) return CLOUD_UNAVAILABLE_MESSAGE;
  return `Não foi possível entrar: ${error.message}`;
}

export function createCloudAuth(client: AuthClientLike): CloudAuth {
  return {
    getSession: async () => sessionOf((await client.getSession()).data.session),
    onChange: (listener) => {
      const { data } = client.onAuthStateChange((_event, session) => {
        listener(sessionOf(session));
      });
      return () => {
        data.subscription.unsubscribe();
      };
    },
    signIn: async (email, password) => {
      const { error } = await client.signInWithPassword({ email, password });
      return error === null ? null : signInMessage(error);
    },
    signOut: async () => {
      const { error } = await client.signOut();
      if (error !== null) throw new Error(error.message);
    },
  };
}

// Linha da tabela → HistoryEntry: `entry` guarda {mode, quick, real, costs,
// summary}; id e saved_at são colunas. Tudo passa pelo mesmo saneamento do
// localStorage — linha inválida é descartada, nunca derruba o app.
function entryOfRow(row: unknown): HistoryEntry | null {
  if (typeof row !== 'object' || row === null) return null;
  const { id, saved_at: savedAt, entry } = row as Record<string, unknown>;
  if (typeof entry !== 'object' || entry === null) return null;
  return sanitizeHistoryEntry({ ...entry, id, savedAt });
}

export function createCloudHistory(client: TableClientLike): CloudHistory {
  return {
    list: async () => {
      const { data, error } = await client
        .from(CALCULATIONS_TABLE)
        .select('id,saved_at,entry')
        .order('saved_at', { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error !== null) throw new Error(error.message);
      if (!Array.isArray(data)) return [];
      return data.map(entryOfRow).filter((entry): entry is HistoryEntry => entry !== null);
    },
    save: async (entry) => {
      const { id, savedAt, ...rest } = entry;
      const { error } = await client
        .from(CALCULATIONS_TABLE)
        .insert({ id, saved_at: savedAt, entry: rest });
      if (error !== null) throw new Error(error.message);
    },
    remove: async (id) => {
      const { error } = await client.from(CALCULATIONS_TABLE).delete().eq('id', id);
      if (error !== null) throw new Error(error.message);
    },
  };
}

/** Nuvem a partir do ambiente do build (Vite). Variável ausente ⇒ null ⇒ só local. */
export function createCloudApi(env: Record<string, unknown> = import.meta.env): CloudApi | null {
  const url = env['VITE_SUPABASE_URL'];
  const key = env['VITE_SUPABASE_ANON_KEY'];
  if (typeof url !== 'string' || url.length === 0 || typeof key !== 'string' || key.length === 0) {
    return null;
  }
  const client = createClient(url, key);
  return { auth: createCloudAuth(client.auth), history: createCloudHistory(client) };
}
