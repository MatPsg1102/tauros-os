// Abstração de persistência local (RA-QUEUE-01 §1).
// O IndexedDB NUNCA vaza para domínio/aplicação: só esta porta é consumida.

/** Definição de um object store local com índices por keyPath ('a.b'). */
export interface LocalStoreDefinition {
  readonly name: string;
  readonly indexes?: Readonly<Record<string, string>>;
}

/** Migration local: leva o schema à versão `toVersion`. */
export interface LocalMigration {
  readonly toVersion: number;
  readonly description: string;
  /** Stores criados/alterados nesta versão (aplicado pelo adapter). */
  readonly stores: readonly LocalStoreDefinition[];
}

/** Schema local versionado (migrations ordenadas e forward-only). */
export interface LocalSchema {
  readonly databaseName: string;
  readonly version: number;
  readonly migrations: readonly LocalMigration[];
}

/** Operações disponíveis dentro de uma transação. */
export interface LocalTransaction {
  get(store: string, key: string): Promise<unknown | undefined>;
  put(store: string, key: string, value: unknown): Promise<void>;
  delete(store: string, key: string): Promise<void>;
  getAll(store: string): Promise<readonly unknown[]>;
  getByIndex(store: string, index: string, value: unknown): Promise<readonly unknown[]>;
}

/**
 * Porta de armazenamento local: transações atômicas (tudo-ou-nada) sobre
 * um schema versionado. Implementações: MemoryLocalStore (testes/fallback)
 * e IndexedDbLocalStore (produção).
 */
export interface LocalStorePort {
  readonly schema: LocalSchema;
  transaction<T>(
    stores: readonly string[],
    mode: 'read' | 'write',
    fn: (tx: LocalTransaction) => Promise<T> | T,
  ): Promise<T>;
  /** Fecha conexões; segura para chamar em shutdown/fechamento inesperado. */
  close(): Promise<void>;
}

export class LocalStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LocalStoreError';
  }
}

/** Resolve keyPath 'a.b' sobre um valor (usado por índices em memória). */
export function resolveKeyPath(value: unknown, keyPath: string): unknown {
  let current: unknown = value;
  for (const part of keyPath.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
