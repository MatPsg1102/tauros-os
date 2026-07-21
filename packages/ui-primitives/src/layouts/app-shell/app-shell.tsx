// AppShell (6.3.7 §8) — estrutura principal da aplicação autenticada, por
// SLOTS (não importa Sidebar/TopBar — recebe qualquer composição aprovada):
//   sidebar | topBar | navigationBar (inferior móvel) | children (conteúdo).
// Estratégia de viewport/scroll (uma única região de scroll — sem scroll
// duplo): shell em grid com altura 100vh + 100dvh (viewport dinâmica móvel);
// .t-shell-content é O container de scroll (StickyRegion documenta isso).
// Safe areas: aplicadas UMA vez pelo shell (topo no topBar, base na região
// da navigationBar) — passar NavigationBar SEM `fixed` (o shell posiciona).
// SkipLink opcional (necessário quando há navegação antes do main): âncora
// pura (#id), sem roteador. Sem storage, permissões, rotas ou dados.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';

export interface AppShellSkipLink {
  readonly label: string;
  /** id do destino (ex.: id da Page principal). */
  readonly targetId: string;
}

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  readonly sidebar?: ReactNode;
  readonly topBar?: ReactNode;
  /** Navegação inferior móvel (NavigationBar SEM `fixed`). */
  readonly navigationBar?: ReactNode;
  readonly skipLink?: AppShellSkipLink;
  readonly children: ReactNode;
}

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  { sidebar, topBar, navigationBar, skipLink, className, children, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={cx('t-shell', className)}>
      {skipLink !== undefined && (
        <a className="t-skiplink t-focusable" href={`#${skipLink.targetId}`}>
          {skipLink.label}
        </a>
      )}
      {topBar !== undefined && <div className="t-shell-topbar">{topBar}</div>}
      <div className="t-shell-middle">
        {sidebar !== undefined && <div className="t-shell-sidebar">{sidebar}</div>}
        <div className="t-shell-content">{children}</div>
      </div>
      {navigationBar !== undefined && <div className="t-shell-navbar">{navigationBar}</div>}
    </div>
  );
});
