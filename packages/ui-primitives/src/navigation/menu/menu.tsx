// Menu (6.3.6 §13) — padrão SEMÂNTICO de menu (não é Popover com role=menu):
// contrato comportamental próprio: roving focus por setas, Home/End,
// typeahead (janela = token motion.deliberate), Enter/Space ativa,
// Escape/clique-fora fecham com restauração de foco, fechamento após
// seleção (configurável; checkbox/radio permanecem abertos por default).
// Submenu (MenuSub): fora do catálogo congelado — pendência registrada.
// Fundação de overlay 6.3.5 reutilizada (Portal, pilha, posicionamento).

'use client';

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

import { core } from '@tauros/tokens';

import { MissingAccessibleNameError } from '../../shared/accessibility.js';
import { cx } from '../../shared/class-names.js';
import { captureFocusRestore } from '../../feedback/overlay/focus-scope.js';
import { isTopOverlay, pushOverlay, removeOverlay } from '../../feedback/overlay/overlay-stack.js';
import { Portal } from '../../feedback/overlay/portal.js';
import {
  positionOverlay,
  positionOverlayAtPoint,
  type OverlayPlacement,
  type PositionController,
} from '../../feedback/overlay/positioning.js';

const TYPEAHEAD_WINDOW_MS = Number.parseInt(core.motion.duration.deliberate, 10);

// ===== contexto raiz =====

export interface MenuContextValue {
  readonly open: boolean;
  readonly setOpen: (open: boolean, focus?: 'first' | 'last') => void;
  readonly baseId: string;
  readonly triggerRef: { current: HTMLButtonElement | null };
  readonly pendingFocus: { current: 'first' | 'last' };
  /** Ponto de ativação (ContextMenu); null ⇒ posiciona pelo trigger. */
  readonly point: { current: { x: number; y: number } | null };
}

export const MenuContext = createContext<MenuContextValue | null>(null);

export class MenuContextMissingError extends Error {
  constructor(part: string) {
    super(`${part} deve ser usado dentro de <Menu> (ou <ContextMenu>).`);
    this.name = 'MenuContextMissingError';
  }
}

export function useMenuContext(part: string): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (ctx === null) throw new MenuContextMissingError(part);
  return ctx;
}

export interface MenuProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly children: ReactNode;
}

export function Menu({ open, defaultOpen = false, onOpenChange, children }: MenuProps): ReactNode {
  const controlled = open !== undefined;
  const [internal, setInternal] = useState(defaultOpen);
  const isOpen = controlled ? open : internal;
  const baseId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<'first' | 'last'>('first');
  const point = useRef<{ x: number; y: number } | null>(null);

  const setOpen = useCallback(
    (next: boolean, focus: 'first' | 'last' = 'first'): void => {
      pendingFocus.current = focus;
      if (!controlled) setInternal(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  return (
    <MenuContext.Provider
      value={{ open: isOpen, setOpen, baseId, triggerRef, pendingFocus, point }}
    >
      {children}
    </MenuContext.Provider>
  );
}

// ===== trigger =====

export interface MenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
}

export const MenuTrigger = forwardRef<HTMLButtonElement, MenuTriggerProps>(function MenuTrigger(
  { className, children, onClick, onKeyDown, ...rest },
  ref,
) {
  const menu = useMenuContext('MenuTrigger');
  return (
    <button
      {...rest}
      ref={(node) => {
        menu.triggerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref !== null) ref.current = node;
      }}
      type="button"
      className={cx('t-btn', 't-focusable', className)}
      data-variant="secondary"
      data-size="md"
      aria-haspopup="menu"
      aria-expanded={menu.open}
      aria-controls={menu.open ? `${menu.baseId}-menu` : undefined}
      onClick={(event) => {
        menu.setOpen(!menu.open);
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          menu.setOpen(true, 'first');
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          menu.setOpen(true, 'last');
        }
        onKeyDown?.(event);
      }}
    >
      {children}
    </button>
  );
});

// ===== superfície compartilhada (Menu e ContextMenu) =====

function menuItems(surface: HTMLElement): HTMLElement[] {
  return Array.from(
    surface.querySelectorAll<HTMLElement>(
      '[role^="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
    ),
  );
}

export interface MenuContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly placement?: OverlayPlacement;
  readonly children: ReactNode;
}

export function MenuContent({
  placement = 'bottom',
  className,
  children,
  ...rest
}: MenuContentProps): ReactNode {
  const menu = useMenuContext('MenuContent');
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const typeahead = useRef<{ buffer: string; at: number }>({ buffer: '', at: 0 });

  useEffect(() => {
    if (!menu.open || surface === null) return undefined;
    const doc = surface.ownerDocument;
    pushOverlay(menu.baseId);
    const restoreCaptured = captureFocusRestore(doc);
    const restoreFocus = (): void => {
      const trigger = menu.triggerRef.current;
      if (trigger !== null && trigger.isConnected) trigger.focus();
      else restoreCaptured();
    };

    const items = menuItems(surface);
    const target = menu.pendingFocus.current === 'last' ? items[items.length - 1] : items[0];
    (target ?? surface).focus();

    let controller: PositionController;
    if (menu.point.current !== null) {
      controller = positionOverlayAtPoint(menu.point.current.x, menu.point.current.y, surface);
    } else if (menu.triggerRef.current !== null) {
      controller = positionOverlay(menu.triggerRef.current, surface, placement);
    } else {
      controller = { destroy: () => undefined };
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (!isTopOverlay(menu.baseId)) return;
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) return;
      if (surface.contains(targetNode) || menu.triggerRef.current?.contains(targetNode) === true)
        return;
      menu.setOpen(false);
    };
    doc.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      doc.removeEventListener('pointerdown', onPointerDown, true);
      controller.destroy();
      removeOverlay(menu.baseId);
      restoreFocus();
    };
  }, [menu.open, surface, placement, menu]);

  if (!menu.open) return null;

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (surface === null) return;
    const items = menuItems(surface);
    if (items.length === 0) return;
    const active = surface.ownerDocument.activeElement;
    const index = items.findIndex((item) => item === active);

    if (event.key === 'Escape') {
      event.preventDefault();
      if (isTopOverlay(menu.baseId)) menu.setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      (items[(index + 1) % items.length] as HTMLElement).focus();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      (items[(index - 1 + items.length) % items.length] as HTMLElement).focus();
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      (items[0] as HTMLElement).focus();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      (items[items.length - 1] as HTMLElement).focus();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (active instanceof HTMLElement && active.getAttribute('role')?.startsWith('menuitem')) {
        active.click();
      }
      return;
    }
    // typeahead — janela tokenizada
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      if (now - typeahead.current.at > TYPEAHEAD_WINDOW_MS) typeahead.current.buffer = '';
      typeahead.current.at = now;
      typeahead.current.buffer += event.key.toLowerCase();
      const match = items.find((item) =>
        (item.textContent ?? '').trim().toLowerCase().startsWith(typeahead.current.buffer),
      );
      match?.focus();
    }
  }

  return (
    <Portal>
      <div
        {...rest}
        ref={setSurface}
        id={`${menu.baseId}-menu`}
        role="menu"
        tabIndex={-1}
        className={cx('t-menu', className)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </Portal>
  );
}

// ===== itens =====

interface MenuItemBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  readonly onSelect?: () => void;
  readonly closeOnSelect?: boolean;
}

function useItemActivate(
  onSelect: (() => void) | undefined,
  closeOnSelect: boolean,
): (disabled: boolean) => void {
  const menu = useMenuContext('MenuItem');
  return (disabled: boolean) => {
    if (disabled) return;
    onSelect?.();
    if (closeOnSelect) menu.setOpen(false);
  };
}

function assertItemName(children: ReactNode, ariaLabel: string | undefined): void {
  const hasText =
    typeof children === 'string'
      ? children.trim() !== ''
      : children !== null && children !== undefined;
  if (!hasText && (ariaLabel === undefined || ariaLabel.trim() === '')) {
    throw new MissingAccessibleNameError('MenuItem');
  }
}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemBaseProps>(function MenuItem(
  { onSelect, closeOnSelect = true, disabled = false, className, children, ...rest },
  ref,
) {
  assertItemName(children, rest['aria-label']);
  const activate = useItemActivate(onSelect, closeOnSelect);
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      className={cx('t-menuitem', className)}
      onClick={() => activate(disabled)}
    >
      {children}
    </button>
  );
});

export interface MenuCheckboxItemProps extends MenuItemBaseProps {
  readonly checked: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
}

export const MenuCheckboxItem = forwardRef<HTMLButtonElement, MenuCheckboxItemProps>(
  function MenuCheckboxItem(
    {
      checked,
      onCheckedChange,
      onSelect,
      closeOnSelect = false,
      disabled = false,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    assertItemName(children, rest['aria-label']);
    const activate = useItemActivate(() => {
      onCheckedChange?.(!checked);
      onSelect?.();
    }, closeOnSelect);
    return (
      <button
        {...rest}
        ref={ref}
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked}
        tabIndex={-1}
        disabled={disabled}
        className={cx('t-menuitem', className)}
        onClick={() => activate(disabled)}
      >
        <span className="t-menuitem-check" data-checked={checked} aria-hidden="true" />
        {children}
      </button>
    );
  },
);

interface MenuRadioContextValue {
  readonly value: string | undefined;
  readonly onValueChange: ((value: string) => void) | undefined;
}
const MenuRadioContext = createContext<MenuRadioContextValue | null>(null);

export interface MenuRadioGroupProps {
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
  readonly children: ReactNode;
}

export function MenuRadioGroup({ value, onValueChange, children }: MenuRadioGroupProps): ReactNode {
  return (
    <MenuRadioContext.Provider value={{ value, onValueChange }}>
      <div role="group">{children}</div>
    </MenuRadioContext.Provider>
  );
}

export interface MenuRadioItemProps extends MenuItemBaseProps {
  readonly value: string;
}

export const MenuRadioItem = forwardRef<HTMLButtonElement, MenuRadioItemProps>(
  function MenuRadioItem(
    { value, onSelect, closeOnSelect = false, disabled = false, className, children, ...rest },
    ref,
  ) {
    assertItemName(children, rest['aria-label']);
    const radio = useContext(MenuRadioContext);
    const checked = radio?.value === value;
    const activate = useItemActivate(() => {
      radio?.onValueChange?.(value);
      onSelect?.();
    }, closeOnSelect);
    return (
      <button
        {...rest}
        ref={ref}
        type="button"
        role="menuitemradio"
        aria-checked={checked}
        tabIndex={-1}
        disabled={disabled}
        className={cx('t-menuitem', className)}
        onClick={() => activate(disabled)}
      >
        <span className="t-menuitem-radio" data-checked={checked} aria-hidden="true" />
        {children}
      </button>
    );
  },
);

export function MenuSeparator(): ReactNode {
  return <div role="separator" className="t-menu-separator" />;
}

export interface MenuLabelProps {
  readonly children: ReactNode;
}

export function MenuLabel({ children }: MenuLabelProps): ReactNode {
  return <div className="t-menu-label">{children}</div>;
}
