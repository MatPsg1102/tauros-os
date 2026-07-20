// Aplicação no DOM (6.3.2 §4/§5) — estratégia escolhida e documentada:
// `CSSStyleDeclaration.setProperty` no root.
// Por quê: atualização atômica por propriedade, sem <style> órfãos, ordem
// determinística (mapa já ordenado em @tauros/tokens), suporte natural a
// múltiplos roots e cleanup preciso (removemos SOMENTE o que aplicamos).
// Diff incremental: só propriedades alteradas são reescritas; aplicação
// idêntica é curto-circuitada (assinatura do tema).

import { toCssVariables, type ResolvedTheme } from '@tauros/tokens';

import type { ThemeDomAttributes } from './theme-types.js';

const OWNED_ATTRIBUTES = [
  'data-theme',
  'data-contrast',
  'data-environment',
  'data-input-mode',
  'data-motion',
] as const;

export interface AppliedThemeHandle {
  /** Reaplica (diff incremental); no-op se a assinatura não mudou. */
  update(theme: ResolvedTheme, attributes: ThemeDomAttributes): void;
  /** Remove APENAS o que este adapter aplicou (vars + atributos próprios). */
  cleanup(): void;
  /** Assinatura atualmente aplicada (depuração/testes). */
  readonly appliedSignature: () => string | null;
}

/** Cria o vínculo tema→root. Um handle por root (múltiplos roots explícitos). */
export function createThemeDomAdapter(root: HTMLElement): AppliedThemeHandle {
  let appliedVars: Record<string, string> = {};
  let signature: string | null = null;

  const update = (theme: ResolvedTheme, attributes: ThemeDomAttributes): void => {
    // Assinatura barata: nome do tema resolvido identifica o conjunto de modos.
    const nextSignature = theme.name;
    if (nextSignature === signature) return; // §5: sem injeção redundante

    const nextVars = toCssVariables(theme);

    // Diff incremental: escreve só o que mudou; remove o que saiu.
    for (const [name, value] of Object.entries(nextVars)) {
      if (appliedVars[name] !== value) root.style.setProperty(name, value);
    }
    for (const name of Object.keys(appliedVars)) {
      if (!(name in nextVars)) root.style.removeProperty(name);
    }

    for (const attr of OWNED_ATTRIBUTES) {
      root.setAttribute(attr, attributes[attr]);
    }

    appliedVars = { ...nextVars };
    signature = nextSignature;
  };

  const cleanup = (): void => {
    for (const name of Object.keys(appliedVars)) root.style.removeProperty(name);
    for (const attr of OWNED_ATTRIBUTES) root.removeAttribute(attr);
    appliedVars = {};
    signature = null;
  };

  return { update, cleanup, appliedSignature: () => signature };
}
