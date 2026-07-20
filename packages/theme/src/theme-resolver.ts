// Resolução PURA (6.3.2 §2/§3): preferências + sistema → modos → tema efetivo.
// Toda a semântica visual vem de @tauros/tokens (resolveTheme) — este módulo
// não conhece cores, não duplica valores e não toca o DOM.

import { resolveTheme, type ResolvedTheme, type RuntimeMode } from '@tauros/tokens';

import type {
  SystemPreferencesSnapshot,
  ThemeDomAttributes,
  ThemePreferences,
} from './theme-types.js';

export interface EffectiveTheme {
  readonly theme: ResolvedTheme;
  readonly modes: readonly RuntimeMode[];
  readonly colorScheme: 'light' | 'dark';
  readonly attributes: ThemeDomAttributes;
}

/** Preferência + sistema → lista de modos para @tauros/tokens. */
export function resolveModes(
  preferences: ThemePreferences,
  system: SystemPreferencesSnapshot,
): readonly RuntimeMode[] {
  const modes: RuntimeMode[] = [];

  const dark =
    preferences.colorScheme === 'dark' ||
    (preferences.colorScheme === 'system' && system.prefersDark);
  if (dark) modes.push('dark');

  // industrial já implica alto contraste na resolução dos tokens.
  if (preferences.modes.industrial) modes.push('industrial');
  else if (preferences.modes.highContrast || system.prefersHighContrast) {
    modes.push('highContrast');
  }

  if (preferences.modes.glove) modes.push('glove');

  const reduced =
    preferences.modes.reducedMotion === true ||
    (preferences.modes.reducedMotion === 'system' && system.prefersReducedMotion);
  if (reduced) modes.push('reducedMotion');

  return modes;
}

/** Deriva o tema efetivo — determinístico para (preferências, sistema). */
export function resolveEffectiveTheme(
  preferences: ThemePreferences,
  system: SystemPreferencesSnapshot,
): EffectiveTheme {
  const modes = resolveModes(preferences, system);
  const theme = resolveTheme(modes);
  const colorScheme = modes.includes('dark') ? 'dark' : 'light';

  return {
    theme,
    modes,
    colorScheme,
    attributes: {
      'data-theme': colorScheme,
      'data-contrast':
        modes.includes('highContrast') || modes.includes('industrial') ? 'high' : 'default',
      'data-environment': modes.includes('industrial') ? 'industrial' : 'default',
      'data-input-mode': modes.includes('glove') ? 'glove' : 'default',
      'data-motion': modes.includes('reducedMotion') ? 'reduced' : 'default',
    },
  };
}
