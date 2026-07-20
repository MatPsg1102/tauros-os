// Switch (6.3.4 §11) — DECISÃO: checkbox nativo estilizado com role="switch".
// Preserva participação em formulário (name/value/reset) e expõe a semântica
// correta de ativação imediata. Estado indicado por POSIÇÃO do polegar +
// cor (P5). Nome acessível obrigatório via label inline, Field ou aria-label.

'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'children'
> {
  readonly label?: ReactNode;
  readonly invalid?: boolean;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    label,
    invalid,
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
  const input = (
    <input
      {...rest}
      ref={ref}
      id={wiring.id}
      type="checkbox"
      role="switch"
      className={cx('t-switch-input', className)}
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
