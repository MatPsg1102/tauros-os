// @tauros/config-engine — Configuration Engine (ADR-019).
// Única fonte de resolução de configuração: catálogo (Baseline v1.0 como
// código), herança global → loja, vigência, versão, cache e snapshots.

export { CONFIG_CATALOG, CONFIG_KEYS, isConfigKey } from './catalog.js';
export type { ConfigKey, ConfigValueOf } from './catalog.js';
export type { ConfigSourcePort } from './ports.js';
export { ConfigResolver, UnknownConfigKeyError } from './resolver.js';
export type {
  ConfigKeyDefinition,
  ConfigPrimitive,
  ConfigRevalidation,
  ConfigScope,
  ConfigSnapshot,
  StoreConfigOverride,
} from './types.js';
