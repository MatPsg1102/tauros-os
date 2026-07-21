// Sidebar (6.3.6 §5) — composição estrutural de navegação. Colapso
// controlado/não controlado; persistência DELEGADA à aplicação (nenhum
// storage interno); sem permissões, rotas ou dados. Colapsada: labels viram
// visually-hidden nos itens (nome acessível preservado) via contexto.

'use client';

import { forwardRef, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { IconButton } from '../../primitives/icon-button/icon-button.js';
import { SidebarContext, type SidebarContextValue } from './sidebar-context.js';

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Nome acessível da navegação (default oficial pt-BR). */
  readonly label?: string;
  readonly collapsed?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
  /** Mostra o botão interno de colapso com este rótulo (opcional). */
  readonly toggleLabel?: string;
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  {
    label = 'Navegação principal',
    collapsed,
    defaultCollapsed = false,
    onCollapsedChange,
    toggleLabel,
    header,
    footer,
    className,
    children,
    ...rest
  },
  ref,
) {
  const controlled = collapsed !== undefined;
  const [internal, setInternal] = useState(defaultCollapsed);
  const isCollapsed = controlled ? collapsed : internal;

  const context = useMemo<SidebarContextValue>(() => ({ collapsed: isCollapsed }), [isCollapsed]);

  function toggle(): void {
    const next = !isCollapsed;
    if (!controlled) setInternal(next);
    onCollapsedChange?.(next);
  }

  return (
    <nav
      {...rest}
      ref={ref}
      aria-label={label}
      className={cx('t-sidebar', className)}
      data-collapsed={isCollapsed ? 'true' : undefined}
    >
      {(header !== undefined || toggleLabel !== undefined) && (
        <div className="t-sidebar-header">
          {header}
          {toggleLabel !== undefined && (
            <IconButton aria-label={toggleLabel} aria-expanded={!isCollapsed} onClick={toggle}>
              <span className="t-sidebar-toggle-glyph" aria-hidden="true" />
            </IconButton>
          )}
        </div>
      )}
      <SidebarContext.Provider value={context}>
        <ul className="t-sidebar-list">{children}</ul>
      </SidebarContext.Provider>
      {footer !== undefined && <div className="t-sidebar-footer">{footer}</div>}
    </nav>
  );
});
