// TopBar (6.3.6 §6) — app bar superior por SLOTS declarados (leading/title/
// navigation/actions/trailing). Sem perfil/autenticação embutidos. Sticky é
// prop declarativa (z-sticky tokenizado). Distinta de NavigationBar (5.3),
// que é a navegação INFERIOR móvel.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Heading } from '../../primitives/heading/heading.js';

export interface TopBarProps extends HTMLAttributes<HTMLElement> {
  readonly leading?: ReactNode;
  /** Título da seção (string vira Heading nível 1 visual 3). */
  readonly title?: string;
  readonly navigation?: ReactNode;
  readonly actions?: ReactNode;
  readonly trailing?: ReactNode;
  readonly sticky?: boolean;
}

export const TopBar = forwardRef<HTMLElement, TopBarProps>(function TopBar(
  { leading, title, navigation, actions, trailing, sticky = false, className, children, ...rest },
  ref,
) {
  return (
    <header
      {...rest}
      ref={ref}
      className={cx('t-topbar', className)}
      data-sticky={sticky ? 'true' : undefined}
    >
      {leading !== undefined && <div className="t-topbar-leading">{leading}</div>}
      {title !== undefined && (
        <Heading level={1} visualLevel={3} className="t-topbar-title">
          {title}
        </Heading>
      )}
      {navigation !== undefined && <div className="t-topbar-nav">{navigation}</div>}
      <div className="t-topbar-spacer" />
      {actions !== undefined && <div className="t-topbar-actions">{actions}</div>}
      {trailing !== undefined && <div className="t-topbar-trailing">{trailing}</div>}
      {children}
    </header>
  );
});
