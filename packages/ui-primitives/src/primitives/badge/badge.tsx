// Badge (6.3.3 §12) — status NÃO interativo, multidimensional (P5):
// cor (fg/bg) + FORMA (marker) + rótulo textual — nunca só cor.
// Forma vem do StatusToken congelado (circle/triangle/square por status).

import { forwardRef, type HTMLAttributes } from 'react';

import { STATUS_PRECEDENCE, type StatusShape } from '@tauros/tokens';

import { cx } from '../../shared/class-names.js';

export type BadgeStatus = 'success' | 'info' | 'warn' | 'error' | 'critical' | 'neutral';

/** Forma congelada por status (lightTheme define a dimensão P5; estável entre temas). */
const STATUS_SHAPE: Record<BadgeStatus, StatusShape> = {
  success: 'circle',
  info: 'circle',
  warn: 'triangle',
  error: 'square',
  critical: 'triangle',
  neutral: 'square',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly status?: BadgeStatus;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { status = 'neutral', className, children, ...rest },
  ref,
) {
  return (
    <span {...rest} ref={ref} className={cx('t-badge', className)} data-status={status}>
      <span className="t-badge-marker" data-shape={STATUS_SHAPE[status]} aria-hidden="true" />
      {children}
    </span>
  );
});

// Reexporta a precedência congelada para consumidores que ordenam status.
export const BADGE_STATUS_PRECEDENCE = STATUS_PRECEDENCE;
