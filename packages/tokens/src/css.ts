// Geração de CSS Variables a partir do tema resolvido.
// O ThemeProvider (6.3.2) injeta estas variáveis; os componentes consomem
// EXCLUSIVAMENTE via cssVar(...) — nunca valores hardcoded.

import type { ResolvedTheme } from './semantic.js';

export const CSS_VAR_PREFIX = '--tauros';

type Primitive = string | number;

function isPrimitive(v: unknown): v is Primitive {
  return typeof v === 'string' || typeof v === 'number';
}

function flatten(value: unknown, path: readonly string[], out: Record<string, string>): void {
  if (isPrimitive(value)) {
    out[`${CSS_VAR_PREFIX}-${path.join('-')}`] = String(value);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, [...path, kebab(key)], out);
    }
  }
}

function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Tema → mapa determinístico de variáveis CSS (ordenado por chave). */
export function toCssVariables(theme: ResolvedTheme): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  const { name: _name, ...rest } = theme;
  flatten(rest, [], out);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** Bloco CSS pronto para injeção (`:root` ou seletor de tema). */
export function toCssBlock(theme: ResolvedTheme, selector = ':root'): string {
  const vars = toCssVariables(theme);
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

/**
 * Referência tipada a uma variável do tema para uso em componentes.
 * Ex.: cssVar('color-accent-default') → 'var(--tauros-color-accent-default)'.
 */
export function cssVar(path: string): string {
  return `var(${CSS_VAR_PREFIX}-${path})`;
}
