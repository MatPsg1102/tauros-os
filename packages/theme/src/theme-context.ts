// Contexto React mínimo e tipado (6.3.2 §10).
// Não expõe matchMedia, storage, DOM nem cache interno.

import { createContext, useContext } from 'react';
import type { ResolvedTheme, RuntimeMode } from '@tauros/tokens';

import { ThemeProviderMissingError } from './theme-errors.js';
import type {
  ColorSchemePreference,
  RuntimeModePreferences,
  ThemePreferences,
} from './theme-types.js';

export interface ThemeContextValue {
  /** Preferências explícitas do usuário (persistíveis). */
  readonly preferences: ThemePreferences;
  /** Tema EFETIVO resolvido (derivado — nunca persistido como escolha). */
  readonly resolvedTheme: ResolvedTheme;
  /** Modos efetivamente ativos após resolução. */
  readonly modes: readonly RuntimeMode[];
  setColorScheme(scheme: ColorSchemePreference): void;
  setMode<K extends keyof RuntimeModePreferences>(mode: K, value: RuntimeModePreferences[K]): void;
  resetPreferences(): void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Hook oficial; erro orientado fora do provider. */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new ThemeProviderMissingError();
  return value;
}
