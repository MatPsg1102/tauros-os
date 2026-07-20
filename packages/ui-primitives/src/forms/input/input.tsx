// Input (6.3.4 §5) — semântica nativa preservada; controlled/uncontrolled
// pelo próprio elemento (sem cópia interna de valor). Tipos nativos seguros.

'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';
import { ControlFrame } from '../shared/control-frame.js';

/** Tipos nativos seguros para campo de texto (§5). */
export type InputType = 'text' | 'email' | 'tel' | 'url' | 'password' | 'search';

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'prefix'
> {
  readonly type?: InputType;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly invalid?: boolean;
  /** Adornos visuais decorativos (texto/ícone) — fora da árvore de a11y. */
  readonly startAdornment?: ReactNode;
  readonly endAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    type = 'text',
    size = 'md',
    invalid,
    startAdornment,
    endAdornment,
    className,
    id,
    required,
    disabled,
    readOnly,
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
      readOnly={readOnly === true}
      size={size}
      startAdornment={startAdornment}
      endAdornment={endAdornment}
    >
      <input
        {...rest}
        ref={ref}
        id={wiring.id}
        type={type}
        className={cx('t-control', className)}
        required={wiring.required}
        disabled={wiring.disabled}
        readOnly={readOnly}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid ? true : undefined}
      />
    </ControlFrame>
  );
});
