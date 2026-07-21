// ContextMenu (6.3.6 §14) — compartilha a fundação de Menu (MenuContent e
// itens), com trigger próprio: clique secundário, Shift+F10 e tecla
// ContextMenu. Posicionado pelo PONTO de ativação (adapter). O menu nativo
// só é prevenido enquanto o componente está montado e no alvo (nunca
// globalmente); listeners removidos no cleanup. Long press: não congelado.

'use client';

import { useCallback, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Menu, MenuContext, useMenuContext } from '../menu/menu.js';

export interface ContextMenuProps {
  readonly onOpenChange?: (open: boolean) => void;
  readonly children: ReactNode;
}

/** Raiz: reutiliza a raiz de Menu (mesma máquina de abertura). */
export function ContextMenu({ onOpenChange, children }: ContextMenuProps): ReactNode {
  return <Menu {...(onOpenChange !== undefined ? { onOpenChange } : {})}>{children}</Menu>;
}

export interface ContextMenuTriggerProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
}

/** Área que responde ao clique secundário/teclado contextual. */
export function ContextMenuTrigger({
  className,
  children,
  onContextMenu,
  onKeyDown,
  ...rest
}: ContextMenuTriggerProps): ReactNode {
  const menu = useMenuContext('ContextMenuTrigger');
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [, force] = useState(0);

  const openAt = useCallback(
    (x: number, y: number): void => {
      menu.point.current = { x, y };
      menu.setOpen(true, 'first');
      force((n) => n + 1);
    },
    [menu],
  );

  return (
    <div
      {...rest}
      ref={areaRef}
      className={cx('t-contextmenu-area', className)}
      tabIndex={0}
      onContextMenu={(event) => {
        // previne o menu nativo SOMENTE aqui, enquanto montado
        event.preventDefault();
        openAt(event.clientX, event.clientY);
        onContextMenu?.(event);
      }}
      onKeyDown={(event) => {
        if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
          event.preventDefault();
          const rect = areaRef.current?.getBoundingClientRect();
          openAt(rect?.left ?? 0, rect?.bottom ?? 0);
        }
        onKeyDown?.(event);
      }}
    >
      {children}
    </div>
  );
}

/** Reexporta o conteúdo/itens da fundação de Menu para composição. */
export {
  MenuContent as ContextMenuContent,
  MenuItem as ContextMenuItem,
  MenuSeparator as ContextMenuSeparator,
} from '../menu/menu.js';

// referência interna para garantir consumo do mesmo contexto (sem duplicação)
export const CONTEXT_MENU_USES_MENU_FOUNDATION = MenuContext !== null;
