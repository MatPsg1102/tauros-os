// Modelo de preferência (6.3.2 §2) — separa PREFERÊNCIA (escolha do usuário,
// persistível) de TEMA EFETIVO (derivado; nunca persistido como escolha).

/** Preferência explícita de esquema de cor. */
export type ColorSchemePreference = 'light' | 'dark' | 'system';

/** Modos operacionais combináveis (rebinding em @tauros/tokens). */
export interface RuntimeModePreferences {
  readonly highContrast: boolean;
  readonly industrial: boolean;
  readonly glove: boolean;
  readonly reducedMotion: boolean | 'system';
}

/** Preferências de apresentação — o ÚNICO conteúdo persistível. */
export interface ThemePreferences {
  readonly colorScheme: ColorSchemePreference;
  readonly modes: RuntimeModePreferences;
}

export const PREFERENCES_VERSION = 1 as const;
export const PREFERENCES_STORAGE_KEY = 'tauros.theme.preferences.v1';

export const DEFAULT_PREFERENCES: ThemePreferences = {
  colorScheme: 'system',
  modes: { highContrast: false, industrial: false, glove: false, reducedMotion: 'system' },
};

/** Snapshot das preferências do SISTEMA (matchMedia), já normalizado. */
export interface SystemPreferencesSnapshot {
  readonly prefersDark: boolean;
  readonly prefersReducedMotion: boolean;
  /** prefers-contrast: more — false quando não suportado (fallback seguro). */
  readonly prefersHighContrast: boolean;
}

export const DEFAULT_SYSTEM_SNAPSHOT: SystemPreferencesSnapshot = {
  prefersDark: false,
  prefersReducedMotion: false,
  prefersHighContrast: false,
};

/** Atributos semânticos aplicados ao root (§4). */
export interface ThemeDomAttributes {
  readonly 'data-theme': 'light' | 'dark';
  readonly 'data-contrast': 'default' | 'high';
  readonly 'data-environment': 'default' | 'industrial';
  readonly 'data-input-mode': 'default' | 'glove';
  readonly 'data-motion': 'default' | 'reduced';
}
