// NavigationBar (catálogo 5.3; Etapa 4 — BottomNav contextual) — navegação
// INFERIOR móvel com base uniforme, composta por NavigationItem. `fixed` é
// declarativo (z-sticky + safe area); itens glove-first.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';

export interface NavigationBarProps extends HTMLAttributes<HTMLElement> {
  /** Nome acessível (default oficial pt-BR). */
  readonly label?: string;
  /** Fixa na base da viewport (declarativo, tokenizado). */
  readonly fixed?: boolean;
  readonly children: ReactNode;
}

export const NavigationBar = forwardRef<HTMLElement, NavigationBarProps>(function NavigationBar(
  { label = 'Navegação inferior', fixed = false, className, children, ...rest },
  ref,
) {
  return (
    <nav
      {...rest}
      ref={ref}
      aria-label={label}
      className={cx('t-navbar', className)}
      data-fixed={fixed ? 'true' : undefined}
    >
      <ul className="t-navbar-list">{children}</ul>
    </nav>
  );
});
