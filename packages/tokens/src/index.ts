// @tauros/tokens — Design Tokens oficiais (Etapa 5.2 congelada, 6.3.1).
// Fonte agnóstica de framework: Core → Semantic → Context → Aliases,
// modos Runtime como rebinding e geração de CSS Variables.
// Nenhum componente usa valor visual fora daqui.

export { resolveAliases } from './aliases.js';
export type { ActionableAlias, ResolvedAliases } from './aliases.js';
export { contextTokens, dominantStatus, resolveContext, STATUS_PRECEDENCE } from './context.js';
export type { ContextState, ContextTokens, StatusKey } from './context.js';
export { core } from './core.js';
export type { CoreTokens } from './core.js';
export { CSS_VAR_PREFIX, cssVar, toCssBlock, toCssVariables } from './css.js';
export { resolveTheme } from './runtime.js';
export type { RuntimeMode } from './runtime.js';
export { darkTheme, lightTheme } from './semantic.js';
export type {
  EmphasisLevel,
  ResolvedTheme,
  StatusIcon,
  StatusShape,
  StatusToken,
} from './semantic.js';
