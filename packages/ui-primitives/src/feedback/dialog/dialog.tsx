// Dialog (6.3.5 §11/§12) — superfície sobreposta com semântica de diálogo.
// DECISÃO FORMAL: Modal É a variante modal de Dialog (mesma implementação;
// `modal` default true — no Tauros OS diálogos interrompem a operação).
// `Modal` é exportado como composição nomeada, sem lógica duplicada.
// Nome acessível OBRIGATÓRIO: title (aria-labelledby) ou aria-label — caso
// contrário, erro orientado (P7).

'use client';

import { useCallback, useEffect, useId, useState, type MouseEvent, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Heading } from '../../primitives/heading/heading.js';
import { IconButton } from '../../primitives/icon-button/icon-button.js';
import { captureFocusRestore, containTabKey, focusInitial } from '../overlay/focus-scope.js';
import { isTopOverlay, pushOverlay, removeOverlay } from '../overlay/overlay-stack.js';
import { Portal } from '../overlay/portal.js';
import { acquireScrollLock } from '../overlay/scroll-lock.js';

export class DialogAccessibleNameError extends Error {
  constructor() {
    super(
      'Dialog exige nome acessível: forneça `title` ou `aria-label`. ' +
        'Sem ele, leitores de tela anunciam um diálogo sem contexto.',
    );
    this.name = 'DialogAccessibleNameError';
  }
}

export interface DialogProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Título acessível (aria-labelledby). Alternativa: aria-label. */
  readonly title?: string;
  readonly 'aria-label'?: string;
  readonly description?: string;
  /** Modal (default): contém foco, bloqueia scroll, backdrop. */
  readonly modal?: boolean;
  /** Fechamento por clique no backdrop (default true). */
  readonly dismissable?: boolean;
  /** Elemento a receber o foco inicial (default: primeiro focável). */
  readonly initialFocusRef?: { readonly current: HTMLElement | null };
  /** Rótulo do botão fechar; ausente ⇒ sem botão fechar embutido. */
  readonly closeLabel?: string;
  /**
   * Posição da superfície na camada (base de Drawer/BottomSheet — 6.3.6).
   * 'center' (default) | 'left' | 'right' | 'bottom'.
   */
  readonly position?: 'center' | 'left' | 'right' | 'bottom';
  readonly className?: string;
  readonly children: ReactNode;
}

export function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  title,
  'aria-label': ariaLabel,
  description,
  modal = true,
  dismissable = true,
  initialFocusRef,
  closeLabel,
  position = 'center',
  className,
  children,
}: DialogProps): ReactNode {
  if (title === undefined && (ariaLabel === undefined || ariaLabel.trim() === '')) {
    throw new DialogAccessibleNameError();
  }

  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlled ? open : internalOpen;

  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = description === undefined ? undefined : `${baseId}-desc`;
  // nó da superfície como ESTADO: o Portal monta os filhos um commit após o
  // open — o ciclo de vida só pode iniciar quando o nó existe de fato.
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);

  const setOpen = useCallback(
    (next: boolean): void => {
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  // ciclo de vida do overlay: pilha, foco, scroll lock, Escape — com cleanup
  useEffect(() => {
    if (!isOpen || surface === null) return undefined;
    const doc = surface.ownerDocument;

    pushOverlay(baseId);
    const restoreFocus = captureFocusRestore(doc);
    const releaseScroll = modal ? acquireScrollLock(doc) : undefined;
    focusInitial(surface, initialFocusRef?.current);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isTopOverlay(baseId)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (modal) containTabKey(surface, event);
    };
    doc.addEventListener('keydown', onKeyDown, true);

    return () => {
      doc.removeEventListener('keydown', onKeyDown, true);
      removeOverlay(baseId);
      releaseScroll?.();
      restoreFocus();
    };
  }, [isOpen, surface, modal, baseId, setOpen, initialFocusRef]);

  if (!isOpen) return null;

  function onBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (!dismissable) return;
    if (event.target === event.currentTarget && isTopOverlay(baseId)) setOpen(false);
  }

  return (
    <Portal>
      <div
        className={cx('t-dialog-layer', modal && 't-dialog-layer-modal')}
        data-modal={modal ? 'true' : undefined}
        data-position={position}
        onClick={onBackdropClick}
      >
        <div
          ref={setSurface}
          role="dialog"
          aria-modal={modal ? true : undefined}
          aria-labelledby={title !== undefined ? titleId : undefined}
          aria-label={title === undefined ? ariaLabel : undefined}
          aria-describedby={descriptionId}
          className={cx('t-dialog', className)}
        >
          {(title !== undefined || closeLabel !== undefined) && (
            <div className="t-dialog-header">
              {title !== undefined && (
                <Heading level={2} visualLevel={3} id={titleId}>
                  {title}
                </Heading>
              )}
              {closeLabel !== undefined && (
                <IconButton aria-label={closeLabel} onClick={() => setOpen(false)}>
                  <span aria-hidden="true">&times;</span>
                </IconButton>
              )}
            </div>
          )}
          {descriptionId !== undefined && (
            <p id={descriptionId} className="t-dialog-desc">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </Portal>
  );
}

/** Modal = Dialog com semântica modal garantida (composição, sem duplicação). */
export function Modal(props: Omit<DialogProps, 'modal'>): ReactNode {
  return <Dialog {...props} modal />;
}
