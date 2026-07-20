// ConfigResolver — única porta de resolução de configuração (ADR-019).
// Herança global → loja · vigência · versão · cache com invalidação · snapshot.

import { CONFIG_CATALOG, CONFIG_KEYS, isConfigKey } from './catalog.js';
import type { ConfigKey, ConfigValueOf } from './catalog.js';
import type { ConfigSourcePort } from './ports.js';
import type { ConfigPrimitive, ConfigSnapshot, StoreConfigOverride } from './types.js';

/** Erro com causa + próximo passo (P7 da Design Language). */
export class UnknownConfigKeyError extends Error {
  constructor(key: string) {
    super(
      `Chave de configuração desconhecida: "${key}". ` +
        `Use uma chave do catálogo (CONFIG_KEYS) ou registre-a no Baseline antes.`,
    );
    this.name = 'UnknownConfigKeyError';
  }
}

interface CacheEntry {
  readonly overrides: readonly StoreConfigOverride[];
  readonly loadedAt: Date;
}

/**
 * Resolve configuração vigente. Nenhum módulo lê tabelas de config direto:
 * tudo passa por aqui (SAS §2 — Configuration Engine).
 */
export class ConfigResolver {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly source: ConfigSourcePort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Valor vigente da chave para a loja (ou default global sem loja). */
  async resolve<K extends ConfigKey>(key: K, storeId?: string): Promise<ConfigValueOf<K>> {
    if (!isConfigKey(key)) {
      throw new UnknownConfigKeyError(key);
    }
    const definition = CONFIG_CATALOG[key];

    // Chaves global-only nunca sofrem override por loja.
    if (definition.scope === 'global' || storeId === undefined) {
      return definition.defaultValue as ConfigValueOf<K>;
    }

    const override = this.effectiveOverride(await this.overridesFor(storeId), key);
    return (override?.value ?? definition.defaultValue) as ConfigValueOf<K>;
  }

  /** Snapshot imutável de todas as chaves — para materializações (DailyTasks etc.). */
  async snapshot(storeId?: string): Promise<ConfigSnapshot> {
    const values: Record<string, ConfigPrimitive> = {};
    for (const key of CONFIG_KEYS) {
      values[key] = await this.resolve(key, storeId);
    }
    return {
      storeId: storeId ?? null,
      resolvedAt: this.clock(),
      values: Object.freeze(values),
    };
  }

  /** Invalida o cache de uma loja (ou de todas) — chamado nos eventos *Changed. */
  invalidate(storeId?: string): void {
    if (storeId === undefined) {
      this.cache.clear();
    } else {
      this.cache.delete(storeId);
    }
  }

  private async overridesFor(storeId: string): Promise<readonly StoreConfigOverride[]> {
    const cached = this.cache.get(storeId);
    if (cached) {
      return cached.overrides;
    }
    const overrides = await this.source.loadStoreOverrides(storeId);
    this.cache.set(storeId, { overrides, loadedAt: this.clock() });
    return overrides;
  }

  /** Override vigente: dentro da vigência, maior versão vence. */
  private effectiveOverride(
    overrides: readonly StoreConfigOverride[],
    key: ConfigKey,
  ): StoreConfigOverride | undefined {
    const now = this.clock();
    return overrides
      .filter(
        (o) =>
          o.key === key &&
          o.effectiveFrom <= now &&
          (o.effectiveUntil === undefined || o.effectiveUntil > now),
      )
      .reduce<StoreConfigOverride | undefined>(
        (best, o) => (best === undefined || o.version > best.version ? o : best),
        undefined,
      );
  }
}
