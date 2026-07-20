// Preferências do SISTEMA (6.3.2 §8) — porta própria sobre matchMedia,
// com fronteira SSR explícita: sem window ⇒ snapshot default e subscribe no-op.
// prefers-contrast só é usado quando suportado (fallback seguro).

import { DEFAULT_SYSTEM_SNAPSHOT, type SystemPreferencesSnapshot } from './theme-types.js';

export interface SystemPreferencesPort {
  get(): SystemPreferencesSnapshot;
  /** Notifica mudanças; retorna unsubscribe. SSR: no-op. */
  subscribe(listener: (snapshot: SystemPreferencesSnapshot) => void): () => void;
}

const QUERIES = {
  dark: '(prefers-color-scheme: dark)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  highContrast: '(prefers-contrast: more)',
} as const;

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function safeMatches(query: string): boolean {
  try {
    return window.matchMedia(query).matches;
  } catch {
    // navegador sem suporte à query (ex.: prefers-contrast) — fallback seguro.
    return false;
  }
}

/** Implementação de navegador; injetável/substituível em testes. */
export function browserSystemPreferences(): SystemPreferencesPort {
  const read = (): SystemPreferencesSnapshot => {
    if (!hasMatchMedia()) return DEFAULT_SYSTEM_SNAPSHOT;
    return {
      prefersDark: safeMatches(QUERIES.dark),
      prefersReducedMotion: safeMatches(QUERIES.reducedMotion),
      prefersHighContrast: safeMatches(QUERIES.highContrast),
    };
  };

  return {
    get: read,
    subscribe(listener): () => void {
      if (!hasMatchMedia()) return () => undefined;
      const lists: MediaQueryList[] = [];
      const handler = (): void => listener(read());
      for (const query of Object.values(QUERIES)) {
        try {
          const mql = window.matchMedia(query);
          mql.addEventListener('change', handler);
          lists.push(mql);
        } catch {
          // query não suportada — ignora com segurança.
        }
      }
      return () => {
        for (const mql of lists) mql.removeEventListener('change', handler);
      };
    },
  };
}

/** Porta estática (SSR/testes) com snapshot fixo. */
export function staticSystemPreferences(
  snapshot: SystemPreferencesSnapshot = DEFAULT_SYSTEM_SNAPSHOT,
): SystemPreferencesPort {
  return { get: () => snapshot, subscribe: () => () => undefined };
}
