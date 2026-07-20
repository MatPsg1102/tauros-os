// DatePicker (6.3.4 §14) — DECISÃO: núcleo sobre input[type=date] nativo.
// Contrato de valor = DATA CIVIL canônica 'YYYY-MM-DD' (string) — nunca
// Date/timezone/instante. O nativo entrega teclado, leitor de tela, mobile
// e locale de EXIBIÇÃO pelo próprio navegador. Calendário visual customizado
// depende de Dialog/Popover (6.3.5) — dependência registrada, sem improviso.

'use client';

import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';
import { ControlFrame } from '../shared/control-frame.js';

/** Data civil canônica (ex.: '2026-07-20') ou '' (vazio). */
export type CivilDateString = string;

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Valida forma E existência no calendário (sem Date local ambíguo). */
export function isValidCivilDate(text: string): boolean {
  if (!CIVIL_DATE_PATTERN.test(text)) return false;
  const [y = 0, m = 0, d = 0] = text.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = [
    31,
    (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return d <= (daysInMonth[m - 1] ?? 0);
}

export interface DatePickerProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'value' | 'defaultValue' | 'min' | 'max' | 'onChange'
> {
  /** Valor controlado: 'YYYY-MM-DD' ou '' (vazio). */
  readonly value?: CivilDateString;
  readonly defaultValue?: CivilDateString;
  readonly onValueChange?: (value: CivilDateString, event: ChangeEvent<HTMLInputElement>) => void;
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly min?: CivilDateString;
  readonly max?: CivilDateString;
  readonly invalid?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
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
        type="date"
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
