// Spinner (6.3.3 §14) — indicador indeterminado. Animação 100% CSS com
// duração vinda de token de motion (reducedMotion ⇒ vars zeram/param a
// animação — sem condicional React). Acessível por padrão via role=status.

import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  readonly size?: 'sm' | 'md' | 'lg';
  /** Anúncio para leitores de tela (default acessível em pt-BR). */
  readonly label?: string;
  /** `true` quando outro elemento já anuncia o carregamento. */
  readonly decorative?: boolean;
}

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = 'md', label = 'Carregando', decorative = false, className, ...rest },
  ref,
) {
  if (decorative) {
    return (
      <span
        {...rest}
        ref={ref}
        className={cx('t-spinner', className)}
        data-size={size}
        aria-hidden="true"
      />
    );
  }
  return (
    <span {...rest} ref={ref} role="status" style={{ display: 'inline-flex' }}>
      <span className={cx('t-spinner', className)} data-size={size} aria-hidden="true" />
      <span className="t-visually-hidden">{label}</span>
    </span>
  );
});
