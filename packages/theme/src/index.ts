// @tauros/theme — ponte oficial entre @tauros/tokens e React (6.3.2).
// Resolve, aplica e disponibiliza o tema; nunca cria valores visuais.

export { buildInitialThemeScript } from './initial-theme-script.js';
export type { InitialThemeScriptOptions } from './initial-theme-script.js';
export { browserSystemPreferences, staticSystemPreferences } from './system-preferences.js';
export type { SystemPreferencesPort } from './system-preferences.js';
export { ThemeContext, useTheme } from './theme-context.js';
export type { ThemeContextValue } from './theme-context.js';
export { createThemeDomAdapter } from './theme-dom-adapter.js';
export type { AppliedThemeHandle } from './theme-dom-adapter.js';
export { NestedThemeProviderError, ThemeProviderMissingError } from './theme-errors.js';
export { ThemeProvider } from './theme-provider.js';
export type { ThemeProviderProps } from './theme-provider.js';
export { resolveEffectiveTheme, resolveModes } from './theme-resolver.js';
export type { EffectiveTheme } from './theme-resolver.js';
export {
  localStoragePreferenceStorage,
  noopPreferenceStorage,
  safeLoadPreferences,
  safeSavePreferences,
  validatePreferences,
} from './theme-storage.js';
export type { PreferenceStoragePort } from './theme-storage.js';
export {
  DEFAULT_PREFERENCES,
  DEFAULT_SYSTEM_SNAPSHOT,
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_VERSION,
} from './theme-types.js';
export type {
  ColorSchemePreference,
  RuntimeModePreferences,
  SystemPreferencesSnapshot,
  ThemeDomAttributes,
  ThemePreferences,
} from './theme-types.js';
