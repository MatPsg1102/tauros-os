// Tooltip (6.3.5 §14) — informação SUPLEMENTAR, nunca substituto de label/
// erro/nome acessível. Abre por hover (com atraso tokenizado via motion
// deliberate) e por foco (imediato); fecha por blur/leave/Escape. Associado
// ao trigger por aria-describedby; conteúdo não interativo (children: string).
// Toque: abre no foco do trigger e fecha por Escape/blur — nunca inescapável.

'use client';

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { core } from '@tauros/tokens';

import { cx } from '../../shared/class-names.js';
import { Portal } from '../overlay/portal.js';
import { positionOverlay, type OverlayPlacement } from '../overlay/positioning.js';

// atraso de abertura = token de motion (parâmetro semântico, não literal)
const OPEN_DELAY_MS = Number.parseInt(core.motion.duration.deliberate, 10);

export interface TooltipProps {
  /** Trigger único que recebe os handlers e aria-describedby. */
  readonly children: ReactElement<Record<string, unknown>>;
  /** Conteúdo curto, não interativo. */
  readonly content: string;
  readonly placement?: OverlayPlacement;
  readonly className?: string;
}

export function Tooltip({
  children,
  content,
  placement = 'top',
  className,
}: TooltipProps): ReactNode {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [floating, setFloating] = useState<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer(): void {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function show(withDelay: boolean): void {
    clearTimer();
    if (withDelay) {
      timerRef.current = setTimeout(() => setVisible(true), OPEN_DELAY_MS);
    } else {
      setVisible(true);
    }
  }

  function hide(): void {
    clearTimer();
    setVisible(false);
  }

  useEffect(() => clearTimer, []);

  // posicionamento compartilhado (adapter) enquanto visível
  useEffect(() => {
    if (!visible) return undefined;
    const trigger = triggerRef.current;
    if (trigger === null || floating === null) return undefined;
    const controller = positionOverlay(trigger, floating, placement);
    const doc = trigger.ownerDocument;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide();
    };
    doc.addEventListener('keydown', onKeyDown, true);
    return () => {
      controller.destroy();
      doc.removeEventListener('keydown', onKeyDown, true);
    };
  }, [visible, floating, placement]);

  if (!isValidElement(children)) return children;

  const childProps = children.props;
  const trigger = cloneElement(children, {
    ref: triggerRef,
    'aria-describedby': visible
      ? [childProps['aria-describedby'], id].filter(Boolean).join(' ')
      : childProps['aria-describedby'],
    onMouseEnter: (event: unknown) => {
      show(true);
      (childProps.onMouseEnter as ((e: unknown) => void) | undefined)?.(event);
    },
    onMouseLeave: (event: unknown) => {
      hide();
      (childProps.onMouseLeave as ((e: unknown) => void) | undefined)?.(event);
    },
    onFocus: (event: unknown) => {
      show(false);
      (childProps.onFocus as ((e: unknown) => void) | undefined)?.(event);
    },
    onBlur: (event: unknown) => {
      hide();
      (childProps.onBlur as ((e: unknown) => void) | undefined)?.(event);
    },
  } as Record<string, unknown>);

  return (
    <>
      {trigger}
      {visible && (
        <Portal>
          <div ref={setFloating} id={id} role="tooltip" className={cx('t-tooltip', className)}>
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}
