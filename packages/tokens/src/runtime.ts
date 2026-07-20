// Runtime Tokens (5.2-B §6) — adaptações de ambiente como REBINDING do tema,
// sem duplicar Semantic. Modos são combináveis (industrial + glove + dark):
// cada um reescreve dimensões distintas do ResolvedTheme.

import { core } from './core.js';
import { darkTheme, lightTheme, type ResolvedTheme } from './semantic.js';

export type RuntimeMode = 'dark' | 'highContrast' | 'industrial' | 'glove' | 'reducedMotion';

/** Alto contraste: bordas e textos sobem de peso; elevação vira contorno. */
function applyHighContrast(theme: ResolvedTheme): ResolvedTheme {
  const strongBorder = theme.name === 'dark' ? core.color.neutral[500] : core.color.neutral[700];
  return {
    ...theme,
    color: {
      ...theme.color,
      text: { ...theme.color.text, secondary: theme.color.text.primary },
      border: { ...theme.color.border, default: strongBorder, strong: strongBorder },
    },
    elevation: {
      card: `0 0 0 1px ${strongBorder}`,
      sheet: `0 0 0 1px ${strongBorder}`,
      dialog: `0 0 0 2px ${strongBorder}`,
    },
  };
}

/** Industrial = alto contraste + tipografia um degrau acima (legível a distância). */
function applyIndustrial(theme: ResolvedTheme): ResolvedTheme {
  const contrasted = applyHighContrast(theme);
  return {
    ...contrasted,
    emphasis: {
      level1: { ...contrasted.emphasis.level1, size: core.type.size[600] },
      level2: { ...contrasted.emphasis.level2, size: core.type.size[500] },
      level3: { ...contrasted.emphasis.level3, size: core.type.size[400] },
      level4: { ...contrasted.emphasis.level4, size: core.type.size[300] },
      level5: { ...contrasted.emphasis.level5, size: core.type.size[200] },
    },
  };
}

/** Glove: alvo mínimo sobe para glovePlus (72px) e insets ganham folga. */
function applyGlove(theme: ResolvedTheme): ResolvedTheme {
  return {
    ...theme,
    size: { controlMin: core.touch.glovePlus },
    space: {
      ...theme.space,
      inset: { sm: core.space[150], md: core.space[300], lg: core.space[400] },
    },
  };
}

/** Reduced motion: durações a zero; a mudança de ESTADO permanece visível. */
function applyReducedMotion(theme: ResolvedTheme): ResolvedTheme {
  const instant = { duration: core.motion.duration.instant, easing: core.motion.easing.standard };
  return { ...theme, motion: { enter: instant, exit: instant, emphasis: instant } };
}

/**
 * Resolve o tema final para um conjunto de modos ativos.
 * Ordem de aplicação fixa e documentada: base(light|dark) → industrial|highContrast
 * → glove → reducedMotion. Determinístico para o mesmo conjunto.
 */
export function resolveTheme(modes: readonly RuntimeMode[]): ResolvedTheme {
  let theme: ResolvedTheme = modes.includes('dark') ? darkTheme : lightTheme;
  if (modes.includes('industrial')) theme = applyIndustrial(theme);
  else if (modes.includes('highContrast')) theme = applyHighContrast(theme);
  if (modes.includes('glove')) theme = applyGlove(theme);
  if (modes.includes('reducedMotion')) theme = applyReducedMotion(theme);
  return { ...theme, name: [theme.name, ...modes.filter((m) => m !== 'dark')].join('+') };
}
