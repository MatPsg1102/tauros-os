// Token Aliases (5.2-A Ajuste 1) — mecanismo de COMPOSIÇÃO entre
// Semantic/Context e Component. Vários componentes reutilizam a mesma
// intenção; mudar o alias atualiza todos sem tocá-los.

import type { ResolvedTheme } from './semantic.js';

export interface ActionableAlias {
  readonly bg: string;
  readonly bgHover: string;
  readonly bgPressed: string;
  readonly text: string;
}

export interface ResolvedAliases {
  readonly actionable: ActionableAlias;
  readonly destructive: ActionableAlias;
  readonly surfaceCard: {
    readonly bg: string;
    readonly radius: string;
    readonly elevation: string;
  };
  readonly onSurfaceText: string;
  readonly focusRing: { readonly color: string; readonly width: string; readonly offset: string };
  readonly disabled: { readonly opacity: number; readonly text: string };
}

/** Resolve os aliases sobre um tema (light/dark/runtime — sempre coerente). */
export function resolveAliases(theme: ResolvedTheme): ResolvedAliases {
  return {
    actionable: {
      bg: theme.color.accent.default,
      bgHover: theme.color.accent.hover,
      bgPressed: theme.color.accent.pressed,
      text: theme.color.text.onAccent,
    },
    destructive: {
      bg: theme.color.status.error.fg,
      bgHover: theme.color.status.critical.fg,
      bgPressed: theme.color.status.critical.fg,
      text: theme.color.text.onAccent,
    },
    surfaceCard: {
      bg: theme.color.surface.raised,
      radius: theme.radius.card,
      elevation: theme.elevation.card,
    },
    onSurfaceText: theme.color.text.primary,
    focusRing: { color: theme.color.border.focus, width: '2px', offset: '2px' },
    disabled: { opacity: theme.opacity.disabled, text: theme.color.text.tertiary },
  };
}
