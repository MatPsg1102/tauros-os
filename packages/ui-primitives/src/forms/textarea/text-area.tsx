// TextArea (6.3.4 §5) — multilinha nativo; redimensionamento controlado
// por contrato (vertical por padrão; nunca horizontal, preserva o layout).

'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';
import { ControlFrame } from '../shared/control-frame.js';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly invalid?: boolean;
  readonly resize?: 'none' | 'vertical';
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    invalid,
    resize = 'vertical',
    className,
    id,
    required,
    disabled,
    readOnly,
    rows = 3,
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
      className="t-frame-textarea"
    >
      <textarea
        {...rest}
        ref={ref}
        id={wiring.id}
        rows={rows}
        className={cx('t-control', className)}
        data-resize={resize}
        required={wiring.required}
        disabled={wiring.disabled}
        readOnly={readOnly}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid ? true : undefined}
      />
    </ControlFrame>
  );
});
