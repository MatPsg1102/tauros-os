// CurrencyInput (6.3.4 §7) — contrato em unidade mínima (valueInMinorUnits).
// Foco: texto de edição sem símbolo; blur: formatação oficial da moeda.
// Defaults oficiais documentados: locale pt-BR, moeda BRL (Baseline do
// produto); reutilizável por props para outras moedas/locales.

'use client';

import {
  forwardRef,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
} from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';
import { ControlFrame } from '../shared/control-frame.js';
import {
  editTextFromMinorUnits,
  formatMinorUnits,
  parseToMinorUnits,
  type CurrencyParseResult,
} from './currency-format.js';

export interface CurrencyChange extends CurrencyParseResult {
  readonly text: string;
}

export interface CurrencyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'value' | 'defaultValue' | 'onChange'
> {
  /** Valor controlado em UNIDADE MÍNIMA inteira (centavos); null = vazio. */
  readonly valueInMinorUnits?: number | null;
  readonly defaultValueInMinorUnits?: number | null;
  readonly onValueChange?: (change: CurrencyChange) => void;
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly currency?: string;
  readonly locale?: string;
  readonly invalid?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    {
      valueInMinorUnits,
      defaultValueInMinorUnits,
      onValueChange,
      onChange,
      currency = 'BRL',
      locale = 'pt-BR',
      invalid,
      size = 'md',
      className,
      id,
      required,
      disabled,
      readOnly,
      onFocus,
      onBlur,
      'aria-describedby': ariaDescribedBy,
      ...rest
    },
    ref,
  ) {
    const ctx = { locale, currency };
    const controlled = valueInMinorUnits !== undefined;
    const initial = controlled ? (valueInMinorUnits ?? null) : (defaultValueInMinorUnits ?? null);
    const [text, setText] = useState<string>(() => formatMinorUnits(initial, ctx));
    const [focused, setFocused] = useState(false);
    const [parseInvalid, setParseInvalid] = useState(false);

    // ressincronização de mudança externa do valor controlado
    const lastExternal = useRef<number | null>(controlled ? (valueInMinorUnits ?? null) : null);
    if (controlled) {
      const external = valueInMinorUnits ?? null;
      if (external !== lastExternal.current) {
        lastExternal.current = external;
        const parsed = parseToMinorUnits(text, ctx);
        if (parsed.valueInMinorUnits !== external) {
          setText(
            focused ? editTextFromMinorUnits(external, ctx) : formatMinorUnits(external, ctx),
          );
          setParseInvalid(false);
        }
      }
    }

    const wiring = resolveControlWiring(
      {
        id,
        'aria-describedby': ariaDescribedBy,
        required,
        disabled,
        invalid: invalid ?? parseInvalid,
      },
      useFieldContext(),
    );

    function handleChange(event: ChangeEvent<HTMLInputElement>): void {
      const nextText = event.target.value;
      setText(nextText);
      const result = parseToMinorUnits(nextText, ctx);
      setParseInvalid(result.invalid);
      onValueChange?.({ ...result, text: nextText });
      onChange?.(event);
    }

    function handleFocus(event: FocusEvent<HTMLInputElement>): void {
      setFocused(true);
      const parsed = parseToMinorUnits(text, ctx);
      if (!parsed.invalid) setText(editTextFromMinorUnits(parsed.valueInMinorUnits, ctx));
      onFocus?.(event);
    }

    function handleBlur(event: FocusEvent<HTMLInputElement>): void {
      setFocused(false);
      const parsed = parseToMinorUnits(text, ctx);
      if (!parsed.invalid) setText(formatMinorUnits(parsed.valueInMinorUnits, ctx));
      onBlur?.(event);
    }

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
          type="text"
          inputMode="decimal"
          data-numeric="true"
          className={cx('t-control', className)}
          value={text}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={wiring.required}
          disabled={wiring.disabled}
          readOnly={readOnly}
          aria-describedby={wiring.describedBy}
          aria-invalid={wiring.invalid ? true : undefined}
        />
      </ControlFrame>
    );
  },
);
