// Persistência de preferências (6.3.2 §9) — abstração tipada, validação
// estrita e falha SEMPRE segura: storage ausente/bloqueado/corrompido nunca
// derruba a aplicação. Só preferências de apresentação são persistidas.

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_VERSION,
  type ThemePreferences,
} from './theme-types.js';

/** Porta de storage — injetável; implementações devem ser SSR-safe. */
export interface PreferenceStoragePort {
  read(): unknown;
  write(value: unknown): void;
}

interface PersistedShape {
  readonly version: number;
  readonly preferences: ThemePreferences;
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

/** Validação estrita (§14): valor malicioso/desconhecido ⇒ defaults. */
export function validatePreferences(raw: unknown): ThemePreferences | null {
  if (raw === null || typeof raw !== 'object') return null;
  const outer = raw as { version?: unknown; preferences?: unknown };
  // Versão desconhecida (antiga ou futura) é rejeitada — sem migração implícita.
  if (outer.version !== PREFERENCES_VERSION) return null;
  const p = outer.preferences as { colorScheme?: unknown; modes?: unknown } | null | undefined;
  if (p === null || typeof p !== 'object') return null;
  if (p.colorScheme !== 'light' && p.colorScheme !== 'dark' && p.colorScheme !== 'system') {
    return null;
  }
  const m = p.modes as
    | { highContrast?: unknown; industrial?: unknown; glove?: unknown; reducedMotion?: unknown }
    | null
    | undefined;
  if (m === null || typeof m !== 'object') return null;
  if (!isBoolean(m.highContrast) || !isBoolean(m.industrial) || !isBoolean(m.glove)) return null;
  if (m.reducedMotion !== 'system' && !isBoolean(m.reducedMotion)) return null;

  // Reconstrução explícita: propriedades desconhecidas são descartadas.
  return {
    colorScheme: p.colorScheme,
    modes: {
      highContrast: m.highContrast,
      industrial: m.industrial,
      glove: m.glove,
      reducedMotion: m.reducedMotion,
    },
  };
}

/** Carrega com blindagem total: qualquer falha ⇒ defaults. */
export function safeLoadPreferences(storage: PreferenceStoragePort): ThemePreferences {
  try {
    return validatePreferences(storage.read()) ?? DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Persiste com blindagem: falha de escrita é silenciosa (nunca derruba). */
export function safeSavePreferences(
  storage: PreferenceStoragePort,
  preferences: ThemePreferences,
): void {
  try {
    storage.write({ version: PREFERENCES_VERSION, preferences } satisfies PersistedShape);
  } catch {
    // storage bloqueado/cheio/indisponível — preferência vive só na sessão.
  }
}

/** Implementação default sobre localStorage — SSR-safe (sem window ⇒ no-op). */
export function localStoragePreferenceStorage(
  key: string = PREFERENCES_STORAGE_KEY,
): PreferenceStoragePort {
  return {
    read(): unknown {
      if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as unknown;
    },
    write(value: unknown): void {
      if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
      window.localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

/** Storage nulo (SSR/testes): nunca lê nem grava. */
export const noopPreferenceStorage: PreferenceStoragePort = {
  read: () => null,
  write: () => undefined,
};
