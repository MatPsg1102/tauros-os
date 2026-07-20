// Configuration Baseline v1.0 como código: catálogo tipado das chaves.
// Fonte: Tauros OS — Configuration Baseline v1.0 §5 (índice de chaves).
// Alterar um DEFAULT aqui é mudança de Baseline — exige aprovação, não commit casual.

import type { ConfigKeyDefinition, ConfigPrimitive } from './types.js';

const def = <T extends ConfigPrimitive>(d: ConfigKeyDefinition<T>): ConfigKeyDefinition<T> => d;

export const CONFIG_CATALOG = {
  // --- Sincronização (RA-QUEUE-01 · Baseline §1) ---
  'sync.retry.maxAttempts': def({
    description: 'Máximo de tentativas de reenvio por item da fila',
    scope: 'store',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 5,
  }),
  'sync.retry.baseDelayMs': def({
    description: 'Base do backoff exponencial (ms)',
    scope: 'store',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 30_000,
  }),
  'sync.retry.factor': def({
    description: 'Fator do backoff exponencial',
    scope: 'store',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 2,
  }),
  'sync.retry.capMs': def({
    description: 'Teto do backoff (ms)',
    scope: 'store',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 480_000,
  }),
  'sync.retry.jitter': def({
    description: 'Estratégia de jitter do backoff',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 'equal',
  }),
  'sync.retry.honorRetryAfter': def({
    description: 'Respeitar header Retry-After em 429',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: true,
  }),
  'sync.auth.maxTokenRefresh': def({
    description: 'Renovações de token por item sem consumir tentativa',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 3,
  }),
  'sync.concurrency.max': def({
    description: 'Concorrência máxima entre itens independentes da fila',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 3,
  }),

  // --- Sessão (ADR-015 · Baseline §2) ---
  'session.idleLockMs': def({
    description: 'Inatividade até bloqueio de UI (ms)',
    scope: 'store',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 900_000,
  }),
  'session.absoluteMaxMs': def({
    description:
      'Validade absoluta da sessão de autoria (ms) — parâmetro de plataforma, independente da duração do turno',
    scope: 'store',
    hotReload: true,
    revalidation: 'next-session',
    defaultValue: 43_200_000,
  }),
  'session.requirePinOnResume': def({
    description: 'Exigir PIN ao retomar de bloqueio',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: true,
  }),
  'session.reauthOnAbsolute': def({
    description: 'Reautenticação completa na expiração absoluta',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: true,
  }),
  'session.lockAppliesOffline': def({
    description: 'Bloqueio por inatividade também offline',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: true,
  }),

  // --- PIN offline (ADR-018 · Baseline §3) ---
  'auth.pin.length': def({
    description: 'Comprimento do PIN',
    scope: 'store',
    hotReload: false,
    revalidation: 'credential-reset',
    defaultValue: 6,
  }),
  'auth.pin.maxAttempts': def({
    description: 'Erros consecutivos até lockout',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 5,
  }),
  'auth.pin.offlineValidityMs': def({
    description: 'Janela de desbloqueio offline desde o último login online (ms)',
    scope: 'store',
    hotReload: true,
    revalidation: 'next-login',
    defaultValue: 259_200_000,
  }),
  'auth.pin.hashAlgo': def({
    description: 'Algoritmo de hash do PIN',
    scope: 'global',
    hotReload: false,
    revalidation: 'credential-reset',
    defaultValue: 'argon2id',
  }),
  'auth.pin.kdfIterations': def({
    description: 'Iterações do KDF de fallback (PBKDF2)',
    scope: 'global',
    hotReload: false,
    revalidation: 'credential-reset',
    defaultValue: 210_000,
  }),
  'auth.pin.lockoutStepsMs': def({
    description: 'Escada de lockout progressivo (ms)',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: [300_000, 900_000] as readonly number[],
  }),
  'auth.pin.hardReauthAfter': def({
    description: 'Erros totais até exigir reautenticação online',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: 10,
  }),

  // --- KPIs (Baseline §4) ---
  'kpi.live.enabled': def({
    description: 'KPIs do período corrente via views live',
    scope: 'store',
    hotReload: true,
    revalidation: 'none',
    defaultValue: true,
  }),
  'kpi.snapshot.grains': def({
    description: 'Grãos de snapshot materializados',
    scope: 'store',
    hotReload: true,
    revalidation: 'none',
    defaultValue: ['shift', 'day', 'week', 'month'] as readonly string[],
  }),
  'kpi.snapshot.cron': def({
    description: 'Cron dos snapshots do dia corrente',
    scope: 'store',
    hotReload: true,
    revalidation: 'none',
    defaultValue: '0 * * * *',
  }),
  'kpi.reconcile.cron': def({
    description: 'Cron da reconciliação noturna',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: '30 2 * * *',
  }),
  'kpi.offline.showStaleAsOf': def({
    description: 'Exibir "atualizado às HH:MM" em dado defasado',
    scope: 'global',
    hotReload: true,
    revalidation: 'none',
    defaultValue: true,
  }),
} as const satisfies Record<string, ConfigKeyDefinition>;

/** União literal de todas as chaves conhecidas. */
export type ConfigKey = keyof typeof CONFIG_CATALOG;

/** Tipo do valor de uma chave específica. */
export type ConfigValueOf<K extends ConfigKey> = (typeof CONFIG_CATALOG)[K]['defaultValue'];

export const CONFIG_KEYS = Object.keys(CONFIG_CATALOG) as readonly ConfigKey[];

export function isConfigKey(key: string): key is ConfigKey {
  return Object.prototype.hasOwnProperty.call(CONFIG_CATALOG, key);
}
