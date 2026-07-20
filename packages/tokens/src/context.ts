// Context Tokens (5.2-B §3) — estados do DOMÍNIO mapeados para Semantic.
// Materializa o mapa Estados → Tokens do Configuration Baseline §6.
// Estados são COMPOSÁVEIS (Ajuste 2): cada dimensão ocupa um canal visual
// próprio; a precedência decide quem domina o canal de ênfase principal.

import type { ResolvedTheme, StatusToken } from './semantic.js';

/** Chave de status semântico consumida por um estado de contexto. */
export type StatusKey = keyof ResolvedTheme['color']['status'];

export interface ContextState {
  readonly status: StatusKey;
  /** Animação sugerida do indicador (respeita reduced-motion). */
  readonly indicator: 'static' | 'pulse' | 'spin';
}

/** Os 8 estados da fila offline (RA-QUEUE-01) + estados de sessão/domínio. */
export const contextTokens = {
  sync: {
    pending: { status: 'warn', indicator: 'pulse' },
    blockedByDependency: { status: 'neutral', indicator: 'static' },
    syncing: { status: 'info', indicator: 'spin' },
    synced: { status: 'success', indicator: 'static' },
    retryScheduled: { status: 'warn', indicator: 'pulse' },
    conflict: { status: 'critical', indicator: 'static' },
    needsReview: { status: 'warn', indicator: 'static' },
    permanentFailure: { status: 'error', indicator: 'static' },
  },
  session: {
    active: { status: 'success', indicator: 'static' },
    locked: { status: 'neutral', indicator: 'static' },
    expired: { status: 'warn', indicator: 'static' },
    switching: { status: 'info', indicator: 'static' },
  },
  permission: {
    denied: { status: 'error', indicator: 'static' },
    stale: { status: 'warn', indicator: 'static' },
  },
  config: {
    current: { status: 'success', indicator: 'static' },
    scheduled: { status: 'info', indicator: 'static' },
    stale: { status: 'info', indicator: 'static' },
    conflict: { status: 'critical', indicator: 'static' },
  },
  stock: {
    ok: { status: 'success', indicator: 'static' },
    low: { status: 'warn', indicator: 'static' },
    critical: { status: 'error', indicator: 'static' },
  },
  incident: {
    low: { status: 'neutral', indicator: 'static' },
    medium: { status: 'warn', indicator: 'static' },
    high: { status: 'error', indicator: 'static' },
    critical: { status: 'critical', indicator: 'static' },
  },
  priority: {
    normal: { status: 'neutral', indicator: 'static' },
    high: { status: 'warn', indicator: 'static' },
    urgent: { status: 'critical', indicator: 'static' },
  },
  connection: {
    online: { status: 'success', indicator: 'static' },
    offline: { status: 'warn', indicator: 'static' },
    unstable: { status: 'warn', indicator: 'pulse' },
  },
} as const satisfies Record<string, Record<string, ContextState>>;

export type ContextTokens = typeof contextTokens;

/**
 * Precedência de criticidade para estados COMPOSTOS (Ajuste 2):
 * quando várias dimensões competem pelo canal de ênfase principal,
 * a de maior precedência vence; as demais permanecem nos canais próprios.
 */
export const STATUS_PRECEDENCE: readonly StatusKey[] = [
  'critical',
  'error',
  'warn',
  'info',
  'success',
  'neutral',
];

/** Resolve o status dominante entre estados simultâneos. */
export function dominantStatus(states: readonly ContextState[]): StatusKey {
  for (const key of STATUS_PRECEDENCE) {
    if (states.some((s) => s.status === key)) return key;
  }
  return 'neutral';
}

/** Resolve o StatusToken de um estado de contexto no tema atual. */
export function resolveContext(theme: ResolvedTheme, state: ContextState): StatusToken {
  return theme.color.status[state.status];
}
