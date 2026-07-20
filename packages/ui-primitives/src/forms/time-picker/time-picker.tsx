// TimePicker (6.3.4 §14) — núcleo sobre input[type=time] nativo.
// Contrato de valor = HORÁRIO LOCAL canônico 'HH:mm' (string) — sem
// timezone/instante. Mesma decisão e pendência do DatePicker (6.3.5).

'use client';

import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';
import { ControlFrame } from '../shared/control-frame.js';

/** Horário local canônico (ex.: '06:30') ou '' (vazio). */
export type LocalTimeString = string;

const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidLocalTime(text: string): boolean {
  return LOCAL_TIME_PATTERN.test(text);
}

export interface TimePickerProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'value' | 'defaultValue' | 'min' | 'max' | 'onChange'
> {
  /** Valor controlado: 'HH:mm' ou '' (vazio). */
  readonly value?: LocalTimeString;
  readonly defaultValue?: LocalTimeString;
  readonly onValueChange?: (value: LocalTimeString, event: ChangeEvent<HTMLInputElement>) => void;
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly min?: LocalTimeString;
  readonly max?: LocalTimeString;
  readonly invalid?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(function TimePicker(
  {
    value,
    defaultValue,
    onValueChange,
    onChange,
    min,
    max,
    invalid,
    size = 'md',
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
    >
      <input
        {...rest}
        ref={ref}
        id={wiring.id}
        type="time"
        className={cx('t-control', className)}
        value={value}
        defaultValue={defaultValue}
        min={min}
        max={max}
        onChange={(event) => {
          onValueChange?.(event.target.value, event);
          onChange?.(event);
        }}
        required={wiring.required}
        disabled={wiring.disabled}
        readOnly={readOnly}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid ? true : undefined}
      />
    </ControlFrame>
  );
});
