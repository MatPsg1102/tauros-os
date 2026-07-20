// Chip (6.3.3 §12) — INTERATIVO (filtro/seleção), distinto de Badge (status
// passivo). Seleção exposta via aria-pressed; remoção acessível opcional.

import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';

import { cx } from '../../shared/class-names.js';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly selected?: boolean;
  /** Habilita remoção acessível; rótulo do botão de remover é obrigatório. */
  readonly onRemove?: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly removeLabel?: string;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, onRemove, removeLabel, className, children, type, ...rest },
  ref,
) {
  const chip = (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      className={cx('t-chip', 't-focusable', className)}
      aria-pressed={selected}
    >
      {children}
    </button>
  );

  if (onRemove === undefined) return chip;

  return (
    <span className="t-chip-group" style={{ display: 'inline-flex', alignItems: 'center' }}>
      {chip}
      <button
        type="button"
        className="t-chip-remove t-focusable"
        aria-label={removeLabel ?? 'Remover'}
        onClick={onRemove}
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </span>
  );
});
