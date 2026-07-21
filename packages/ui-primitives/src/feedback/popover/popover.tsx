// Popover (6.3.5 §15) — conteúdo contextual NÃO modal e interativo.
// Decisões formais documentadas:
// - o foco ENTRA automaticamente no conteúdo ao abrir (primeiro focável →
//   fallback container) e é restaurado ao trigger no fechamento;
// - clique externo FECHA (topo da pilha apenas); Escape FECHA;
// - seleção interna NÃO fecha automaticamente (o consumidor decide via
//   onOpenChange) — Popover não é menu/listbox/combobox;
// - trigger mantém aria-expanded e aria-controls (id do conteúdo);
// - sem scroll lock (não modal); posicionamento compartilhado com Tooltip.

'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { captureFocusRestore, focusInitial } from '../overlay/focus-scope.js';
import { isTopOverlay, pushOverlay, removeOverlay } from '../overlay/overlay-stack.js';
import { Portal } from '../overlay/portal.js';
import { positionOverlay, type OverlayPlacement } from '../overlay/positioning.js';

export interface PopoverProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Rótulo do trigger padrão (botão). */
  readonly triggerLabel: string;
  readonly placement?: OverlayPlacement;
  /** Nome acessível do conteúdo. */
  readonly 'aria-label'?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Popover({
  open,
  defaultOpen = false,
  onOpenChange,
  triggerLabel,
  placement = 'bottom',
  'aria-label': ariaLabel,
  className,
  children,
}: PopoverProps): ReactNode {
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlled ? open : internalOpen;

  const baseId = useId();
  const contentId = `${baseId}-content`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);

  const setOpen = useCallback(
    (next: boolean): void => {
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const trigger = triggerRef.current;
    if (trigger === null || content === null) return undefined;
    const doc = trigger.ownerDocument;

    pushOverlay(baseId);
    // contrato: restauração explícita ao TRIGGER (com fallback tolerante)
    const restoreCaptured = captureFocusRestore(doc);
    const restoreFocus = (): void => {
      if (trigger.isConnected) trigger.focus();
      else restoreCaptured();
    };
    focusInitial(content);
    const controller = positionOverlay(trigger, content, placement);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isTopOverlay(baseId)) {
        event.preventDefault();
        setOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (!isTopOverlay(baseId)) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (content.contains(target) || trigger.contains(target)) return;
      setOpen(false);
    };
    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('pointerdown', onPointerDown, true);
      controller.destroy();
      removeOverlay(baseId);
      restoreFocus();
    };
  }, [isOpen, content, baseId, placement, setOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="t-btn t-focusable"
        data-variant="secondary"
        data-size="md"
        aria-expanded={isOpen}
        aria-controls={isOpen ? contentId : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen(!isOpen)}
      >
        {triggerLabel}
      </button>
      {isOpen && (
        <Portal>
          <div
            ref={setContent}
            id={contentId}
            role="dialog"
            aria-label={ariaLabel ?? triggerLabel}
            className={cx('t-popover', className)}
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}
