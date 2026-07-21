// Contrato NEUTRO de links (6.3.6 §1) — o Design System não conhece roteador.
// `href` preservado sempre (nova aba, modifier keys, botão central, download e
// links externos seguem o NATIVO); `navigate` só intercepta o clique primário
// simples, permitindo SPA sem acoplamento. Sem `navigate` ⇒ link 100% nativo.

'use client';

import type { MouseEvent } from 'react';

export interface NavigationLinkAdapter {
  readonly href: string;
  /** Navegação SPA opcional (fornecida pela aplicação/roteador). */
  readonly navigate?: () => void;
}

/** true quando o clique deve seguir o comportamento nativo do navegador. */
export function isNativeNavigationClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.currentTarget.target === '_blank' ||
    event.currentTarget.hasAttribute('download')
  );
}

/** Handler de clique do contrato neutro: SPA apenas no clique primário puro. */
export function handleAdapterClick(
  event: MouseEvent<HTMLAnchorElement>,
  adapter: NavigationLinkAdapter,
): void {
  if (adapter.navigate === undefined) return; // nativo integral
  if (isNativeNavigationClick(event)) return;
  event.preventDefault();
  adapter.navigate();
}
