// Banner (6.3.5 §8) — comunicação persistente de ALTA visibilidade, distinta
// de Alert: ocupa a largura do fluxo (não fixa na viewport), prioridade
// visual maior, pensada para estado global (conectividade, manutenção) —
// mas SEM conhecer esses domínios: conteúdo e status vêm por props.
// Touch targets glove-first nas ações.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { IconButton } from '../../primitives/icon-button/icon-button.js';

export type BannerStatus = 'info' | 'success' | 'warning' | 'error' | 'critical' | 'neutral';

const STATUS_SHAPE: Record<BannerStatus, 'circle' | 'triangle' | 'square'> = {
  info: 'circle',
  success: 'circle',
  warning: 'triangle',
  error: 'square',
  critical: 'triangle',
  neutral: 'square',
};

const STATUS_TOKEN: Record<BannerStatus, string> = {
  info: 'info',
  success: 'success',
  warning: 'warn',
  error: 'error',
  critical: 'critical',
  neutral: 'neutral',
};

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  readonly status?: BannerStatus;
  readonly action?: ReactNode;
  readonly onDismiss?: () => void;
  readonly dismissLabel?: string;
  /** Live region explícita (ex.: banner de conectividade que surge depois). */
  readonly live?: 'polite' | 'assertive';
}

export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  {
    status = 'neutral',
    action,
    onDismiss,
    dismissLabel = 'Fechar comunicado',
    live,
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
      className={cx('t-banner', className)}
      data-status={STATUS_TOKEN[status]}
    >
      <span className="t-banner-marker" data-shape={STATUS_SHAPE[status]} aria-hidden="true" />
      <div className="t-banner-content">{children}</div>
      {action !== undefined && <div className="t-banner-action">{action}</div>}
      {onDismiss !== undefined && (
        <IconButton aria-label={dismissLabel} onClick={onDismiss}>
          <span aria-hidden="true">&times;</span>
        </IconButton>
      )}
    </div>
  );
});
