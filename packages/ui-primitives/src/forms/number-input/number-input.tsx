// NumberInput (6.3.4 §6) — input de texto com inputmode decimal e parsing
// próprio por locale. Estado interno guarda SOMENTE o texto digitado (o texto
// não é derivável do número); o valor numérico é derivado, nunca duplicado.
// Vazio ⇒ null (nunca zero). Fora de min/max ⇒ invalid (não clampa).
// Steppers/setas não constam do contrato congelado — registrados como pendência.

'use client';

import {
  forwardRef,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';
import { ControlFrame } from '../shared/control-frame.js';
import { formatNumberText, parseNumberText, type NumberParseResult } from './number-parse.js';

export interface NumberChange extends NumberParseResult {
  readonly text: string;
}

export interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'value' | 'defaultValue' | 'min' | 'max' | 'onChange'
> {
  /** Valor numérico controlado (null = vazio). */
  readonly value?: number | null;
  readonly defaultValue?: number | null;
  readonly onValueChange?: (change: NumberChange) => void;
  /** onChange nativo continua disponível para integrações (RHF etc.). */
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly allowNegative?: boolean;
  /** Locale de parsing/formatação. Default oficial documentado: pt-BR. */
  readonly locale?: string;
  readonly invalid?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly startAdornment?: ReactNode;
  readonly endAdornment?: ReactNode;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    defaultValue,
    onValueChange,
    onChange,
    min,
    max,
    step,
    allowNegative = false,
    locale = 'pt-BR',
    invalid,
    size = 'md',
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
  const controlled = value !== undefined;
  const [text, setText] = useState<string>(() =>
    formatNumberText(controlled ? (value ?? null) : (defaultValue ?? null), locale),
  );
  const [parseInvalid, setParseInvalid] = useState(false);

  // Mudança EXTERNA do valor controlado ressincroniza o texto sem apagar
  // digitação em andamento equivalente (ex.: "1," enquanto value=1).
  const lastExternal = useRef<number | null>(controlled ? (value ?? null) : null);
  if (controlled) {
    const external = value ?? null;
    if (external !== lastExternal.current) {
      lastExternal.current = external;
      const parsed = parseNumberText(text, { locale, allowNegative, min, max });
      if (parsed.value !== external) {
        setText(formatNumberText(external, locale));
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
    const result = parseNumberText(nextText, { locale, allowNegative, min, max });
    setParseInvalid(result.invalid);
    onValueChange?.({ ...result, text: nextText });
    onChange?.(event);
  }

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
        type="text"
        inputMode="decimal"
        data-numeric="true"
        data-step={step}
        className={cx('t-control', className)}
        value={text}
        onChange={handleChange}
        required={wiring.required}
        disabled={wiring.disabled}
        readOnly={readOnly}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid ? true : undefined}
      />
    </ControlFrame>
  );
});
