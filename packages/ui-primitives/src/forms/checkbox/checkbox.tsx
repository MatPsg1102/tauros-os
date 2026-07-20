// Checkbox (6.3.4 §9) — input nativo (nunca div role=checkbox). Estado
// indeterminate aplicado por ref (única via DOM). Linha rotulada inteira é
// o alvo glove-first; glifo de forma (check/barra) além da cor (P5).

'use client';

import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'children'
> {
  /** Estado indeterminado (aplicável apenas via DOM — gerido por ref). */
  readonly indeterminate?: boolean;
  readonly invalid?: boolean;
  /** Rótulo inline (linha clicável). Alternativa: usar Field/aria-label. */
  readonly label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    indeterminate = false,
    invalid,
    label,
    className,
    id,
    required,
    disabled,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const wiring = resolveControlWiring(
    { id, 'aria-describedby': ariaDescribedBy, required, disabled, invalid },
    useFieldContext(),
  );
  const innerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (innerRef.current !== null) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const input = (
    <input
      {...rest}
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref !== null) ref.current = node;
      }}
      id={wiring.id}
      type="checkbox"
      className={cx('t-check', className)}
      data-indeterminate={indeterminate ? 'true' : undefined}
      data-invalid={wiring.invalid ? 'true' : undefined}
      required={wiring.required}
      disabled={wiring.disabled}
      aria-describedby={wiring.describedBy}
      aria-invalid={wiring.invalid ? true : undefined}
    />
  );

  if (label === undefined) return input;
  return (
    <label className="t-choice-row" data-disabled={wiring.disabled ? 'true' : undefined}>
      {input}
      <span>{label}</span>
    </label>
  );
});
