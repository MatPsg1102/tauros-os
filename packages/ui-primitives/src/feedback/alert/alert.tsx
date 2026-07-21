// Alert (6.3.5 §7) — feedback PERSISTENTE no fluxo da página.
// Status multidimensional (P5): cor + forma + rótulo. Live region é
// OPCIONAL e explícita (`live`): conteúdo presente desde a primeira
// renderização não deve ser anunciado — default sem live region.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { IconButton } from '../../primitives/icon-button/icon-button.js';

export type AlertStatus = 'info' | 'success' | 'warning' | 'error';

const STATUS_SHAPE: Record<AlertStatus, 'circle' | 'triangle' | 'square'> = {
  info: 'circle',
  success: 'circle',
  warning: 'triangle',
  error: 'square',
};

// warning (5.3) mapeia para o token de status 'warn' congelado nos tokens
const STATUS_TOKEN: Record<AlertStatus, string> = {
  info: 'info',
  success: 'success',
  warning: 'warn',
  error: 'error',
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  readonly status?: AlertStatus;
  readonly title?: string;
  /** Live region explícita; default: nenhuma (conteúdo presente no render). */
  readonly live?: 'polite' | 'assertive';
  /** Ação opcional (ReactNode seguro — sem HTML injetado). */
  readonly action?: ReactNode;
  /** Presente ⇒ Alert dispensável com botão rotulado. */
  readonly onDismiss?: () => void;
  readonly dismissLabel?: string;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    status = 'info',
    title,
    live,
    action,
    onDismiss,
    dismissLabel = 'Fechar aviso',
    className,
    children,
    ...rest
  },
  ref,
) {
  const liveProps =
    live === undefined
      ? {}
      : live === 'assertive'
        ? ({ role: 'alert' } as const)
        : ({ role: 'status' } as const);
  return (
    <div
      {...rest}
      {...liveProps}
      ref={ref}
      className={cx('t-alert', className)}
      data-status={STATUS_TOKEN[status]}
    >
      <span className="t-alert-marker" data-shape={STATUS_SHAPE[status]} aria-hidden="true" />
      <div className="t-alert-body">
        {title !== undefined && <p className="t-alert-title">{title}</p>}
        <div className="t-alert-desc">{children}</div>
        {action !== undefined && <div className="t-alert-action">{action}</div>}
      </div>
      {onDismiss !== undefined && (
        <IconButton aria-label={dismissLabel} onClick={onDismiss}>
          <span aria-hidden="true">&times;</span>
        </IconButton>
      )}
    </div>
  );
});
