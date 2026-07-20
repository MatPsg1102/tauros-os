// Configuration Engine (ADR-019) — core types.
// Every operational parameter is data: typed, versioned, effective-dated.

/** Primitive shapes a configuration value may take. */
export type ConfigPrimitive = string | number | boolean | readonly string[] | readonly number[];

/**
 * Who may carry a value for the key:
 * - `global`: platform-level only (no per-store override).
 * - `store`: platform default overridable per store (inheritance global → store).
 */
export type ConfigScope = 'global' | 'store';

/** What must happen for a changed value to take effect (Baseline §5). */
export type ConfigRevalidation = 'none' | 'next-session' | 'next-login' | 'credential-reset';

/** Static metadata of a configuration key (the catalog entry). */
export interface ConfigKeyDefinition<T extends ConfigPrimitive = ConfigPrimitive> {
  readonly description: string;
  readonly scope: ConfigScope;
  /** Applies without restart via cache invalidation. */
  readonly hotReload: boolean;
  readonly revalidation: ConfigRevalidation;
  readonly defaultValue: T;
}

/** A store-level override row, with vigência and version (ADR-019). */
export interface StoreConfigOverride {
  readonly key: string;
  readonly value: ConfigPrimitive;
  readonly version: number;
  readonly effectiveFrom: Date;
  readonly effectiveUntil?: Date | undefined;
}

/** Immutable snapshot of every resolved key for a store at a moment in time. */
export interface ConfigSnapshot {
  readonly storeId: string | null;
  readonly resolvedAt: Date;
  readonly values: Readonly<Record<string, ConfigPrimitive>>;
}
