// Breadcrumb (6.3.6 §7) — nav > ol; item atual com aria-current=page;
// separador 100% decorativo via CSS (fora da árvore acessível); truncamento
// VISUAL por ellipsis (nome completo permanece no DOM/AT). Colapso de
// intermediários: não implementado nesta etapa (usaria Menu — registrado);
// o caminho completo permanece sempre acessível.

'use client';

import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import { handleAdapterClick, type NavigationLinkAdapter } from '../shared/link.js';

export interface BreadcrumbItem {
  readonly label: string;
  /** Ausente ⇒ item não navegável (ex.: o atual). */
  readonly link?: NavigationLinkAdapter;
}

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  readonly items: readonly BreadcrumbItem[];
  /** Nome acessível (default oficial pt-BR). */
  readonly label?: string;
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(function Breadcrumb(
  { items, label = 'Trilha de navegação', className, ...rest },
  ref,
) {
  return (
    <nav {...rest} ref={ref} aria-label={label} className={cx('t-breadcrumb', className)}>
      <ol className="t-breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${String(index)}-${item.label}`} className="t-breadcrumb-item">
              {item.link !== undefined && !isLast ? (
                <a
                  className="t-breadcrumb-link t-focusable"
                  href={item.link.href}
                  onClick={(event) => handleAdapterClick(event, item.link as NavigationLinkAdapter)}
                >
                  {item.label}
                </a>
              ) : (
                <span className="t-breadcrumb-current" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
