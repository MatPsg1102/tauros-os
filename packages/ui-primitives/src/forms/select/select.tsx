// Select (6.3.4 §12) — DECISÃO: elemento <select> nativo. Cumpre o contrato
// congelado (seleção única, teclado, leitor de tela, mobile) sem os riscos de
// um listbox customizado incompleto. Variante customizada (typeahead visual,
// posicionamento) depende de Popover (6.3.5) — registrada como pendência.
// Opções via <option>/<optgroup> nativos (semântica preservada).

'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';
import { ControlFrame } from '../shared/control-frame.js';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  readonly invalid?: boolean;
  readonly frameSize?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    invalid,
    frameSize = 'md',
    className,
    id,
    required,
    disabled,
    children,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const wiring = resolveControlWiring(
    { id, 'aria-describedby': ariaDescribedBy, required, disabled, invalid },
    useFieldContext(),
  );
  return (
    <ControlFrame
      invalid={wiring.invalid}
      disabled={wiring.disabled}
      size={frameSize}
      endAdornment={<span className="t-select-arrow" />}
    >
      <select
        {...rest}
        ref={ref}
        id={wiring.id}
        className={cx('t-control', className)}
        required={wiring.required}
        disabled={wiring.disabled}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid ? true : undefined}
      >
        {children}
      </select>
    </ControlFrame>
  );
});
