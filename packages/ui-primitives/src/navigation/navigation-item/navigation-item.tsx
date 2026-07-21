// NavigationItem (6.3.6 §3) — unidade reutilizável de navegação (Sidebar,
// TopBar, NavigationBar, Drawer, grupos). Nome acessível OBRIGATÓRIO (label
// não vazio — erro orientado). Estados multidimensionais: current (barra
// indicadora por POSIÇÃO + aria-current), active, disabled, unavailable
// (aria-disabled, distinto de disabled), pending (spinner decorativo).
// Colapsado: label vira visually-hidden (nome acessível preservado).
// Permissões/rotas: decisão do CONSUMIDOR — o item só recebe estados.

'use client';

import { forwardRef, useContext, type MouseEvent, type ReactNode } from 'react';

import { MissingAccessibleNameError } from '../../shared/accessibility.js';
import { cx } from '../../shared/class-names.js';
import { Spinner } from '../../primitives/spinner/spinner.js';
import { SidebarContext } from '../sidebar/sidebar-context.js';
import { handleAdapterClick, type NavigationLinkAdapter } from '../shared/link.js';

export interface NavigationItemProps {
  /** Nome do destino — obrigatório e não vazio (nome acessível). */
  readonly label: string;
  readonly icon?: ReactNode;
  readonly description?: string;
  readonly badge?: ReactNode;
  /** Corresponde à LOCALIZAÇÃO atual (aria-current=page). */
  readonly current?: boolean;
  /** Ativo por interação (pressionado/aberto). */
  readonly active?: boolean;
  readonly disabled?: boolean;
  /** Temporariamente indisponível (ex.: offline) — aria-disabled. */
  readonly unavailable?: boolean;
  readonly pending?: boolean;
  /** Link neutro (href + navigate opcional). Ausente ⇒ botão. */
  readonly link?: NavigationLinkAdapter;
  readonly onSelect?: (event: MouseEvent<HTMLElement>) => void;
  /** Conteúdo final (atalho, chevron etc. — decorativo). */
  readonly endContent?: ReactNode;
  readonly className?: string;
}

export const NavigationItem = forwardRef<HTMLLIElement, NavigationItemProps>(
  function NavigationItem(
    {
      label,
      icon,
      description,
      badge,
      current = false,
      active = false,
      disabled = false,
      unavailable = false,
      pending = false,
      link,
      onSelect,
      endContent,
      className,
    },
    ref,
  ) {
    if (label.trim() === '') throw new MissingAccessibleNameError('NavigationItem');
    const sidebar = useContext(SidebarContext);
    const collapsed = sidebar?.collapsed === true;
    const blocked = disabled || unavailable || pending;

    const inner = (
      <>
        {icon !== undefined && (
          <span className="t-navitem-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className={cx('t-navitem-text', collapsed && 't-visually-hidden')}>
          <span className="t-navitem-label">{label}</span>
          {description !== undefined && <span className="t-navitem-desc">{description}</span>}
        </span>
        {pending && <Spinner size="sm" decorative />}
        {badge !== undefined && !collapsed && <span className="t-navitem-badge">{badge}</span>}
        {endContent !== undefined && !collapsed && (
          <span className="t-navitem-end" aria-hidden="true">
            {endContent}
          </span>
        )}
      </>
    );

    const shared = {
      className: cx('t-navitem', 't-focusable', className),
      'data-current': current ? 'true' : undefined,
      'data-active': active ? 'true' : undefined,
      'data-unavailable': unavailable ? 'true' : undefined,
      'data-pending': pending ? 'true' : undefined,
      'data-collapsed': collapsed ? 'true' : undefined,
    } as const;

    return (
      <li ref={ref} className="t-navitem-li">
        {link !== undefined ? (
          <a
            {...shared}
            href={link.href}
            aria-current={current ? 'page' : undefined}
            aria-disabled={blocked ? true : undefined}
            onClick={(event) => {
              if (blocked) {
                event.preventDefault();
                return;
              }
              onSelect?.(event);
              handleAdapterClick(event, link);
            }}
          >
            {inner}
          </a>
        ) : (
          <button
            {...shared}
            type="button"
            aria-current={current ? 'page' : undefined}
            disabled={disabled}
            aria-disabled={unavailable || pending ? true : undefined}
            onClick={(event) => {
              if (blocked) return;
              onSelect?.(event);
            }}
          >
            {inner}
          </button>
        )}
      </li>
    );
  },
);
