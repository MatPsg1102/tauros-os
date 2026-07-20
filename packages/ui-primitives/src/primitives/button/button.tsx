// Button (6.3.3 §6) — variantes semânticas; glove-first: min-height =
// var(--tauros-size-control-min) (64px default — P4). Estado loading
// preserva largura (conteúdo oculto, spinner sobreposto) e bloqueia
// acionamento sem remover o botão do fluxo de foco.

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Spinner } from '../spinner/spinner.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly fullWidth?: boolean;
  /** Ícone opcional antes do rótulo (decorativo — rótulo é o texto). */
  readonly startIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    startIcon,
    className,
    children,
    disabled,
    onClick,
    type,
    ...rest
  },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      className={cx('t-btn', 't-focusable', className)}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? 'true' : undefined}
      data-full-width={fullWidth ? 'true' : undefined}
      disabled={disabled}
      aria-disabled={loading || disabled ? true : undefined}
      aria-busy={loading ? true : undefined}
      onClick={loading ? undefined : onClick}
    >
      <span className="t-btn-content" style={{ display: 'inline-flex', alignItems: 'center' }}>
        {startIcon !== undefined && (
          <span aria-hidden="true" style={{ display: 'inline-flex' }}>
            {startIcon}
          </span>
        )}
        {children}
      </span>
      {loading && (
        <span className="t-btn-spinner">
          <Spinner size="sm" decorative />
        </span>
      )}
    </button>
  );
});
