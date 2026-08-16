// PinInput (6.3.4 §15) — SOMENTE entrada. Não valida credencial, não persiste,
// não calcula hash, não conhece lockout nem Configuration Engine.
// Segurança: valor NUNCA em data-*, logs, erros ou callbacks auxiliares;
// células type=password quando mascarado; autocomplete one-time-code.

'use client';

import {
  forwardRef,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

import { cx } from '../../shared/class-names.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';

export interface PinInputProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Quantidade de dígitos (validada: 1–12). */
  readonly length: number;
  /** Nome acessível do grupo (obrigatório sem aria-labelledby). */
  readonly label?: string;
  /** Rótulo por célula. Default oficial pt-BR documentado. */
  readonly digitLabel?: (index: number, length: number) => string;
  readonly onValueChange?: (pin: string) => void;
  readonly onComplete?: (pin: string) => void;
  readonly mask?: boolean;
  readonly numericOnly?: boolean;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
}

export class InvalidPinLengthError extends Error {
  constructor(length: number) {
    super(`PinInput: length deve estar entre 1 e 12 (recebido: ${String(length)}).`);
    this.name = 'InvalidPinLengthError';
  }
}

export const PinInput = forwardRef<HTMLDivElement, PinInputProps>(function PinInput(
  {
    length,
    label,
    digitLabel = (index, total) => `Dígito ${String(index + 1)} de ${String(total)}`,
    onValueChange,
    onComplete,
    mask = true,
    numericOnly = true,
    invalid,
    disabled,
    className,
    'aria-labelledby': ariaLabelledBy,
    ...rest
  },
  ref,
) {
  if (!Number.isInteger(length) || length < 1 || length > 12) {
    throw new InvalidPinLengthError(length);
  }
  const wiring = resolveControlWiring({ disabled, invalid }, useFieldContext());
  const [digits, setDigits] = useState<readonly string[]>(() => Array<string>(length).fill(''));
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  const acceptChar = (ch: string): boolean => (numericOnly ? /^\d$/.test(ch) : /^[\w]$/.test(ch));

  function commit(next: readonly string[]): void {
    setDigits(next);
    const pin = next.join('');
    onValueChange?.(pin);
    if (next.every((d) => d !== '')) onComplete?.(pin);
  }

  function setDigit(index: number, ch: string): void {
    const next = [...digits];
    next[index] = ch;
    commit(next);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index] !== '') setDigit(index, '');
      else if (index > 0) {
        setDigit(index - 1, '');
        cells.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      cells.current[index - 1]?.focus();
      return;
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      cells.current[index + 1]?.focus();
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      if (acceptChar(event.key)) {
        setDigit(index, event.key);
        cells.current[Math.min(index + 1, length - 1)]?.focus();
      }
    }
  }

  /**
   * Caminho PRIMÁRIO dos teclados VIRTUAIS: IMEs Android emitem keydown com
   * key 'Unidentified' (não interceptado acima) e entregam o texto pelo
   * evento de input — sem este handler o PIN é indigitável no tablet-alvo.
   * Teclado físico não chega aqui (o keydown intercepta e faz preventDefault).
   */
  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>): void {
    const raw = event.target.value;
    if (raw === '') {
      if (digits[index] !== '') setDigit(index, '');
      return;
    }
    const ch = [...raw].reverse().find(acceptChar);
    if (ch === undefined) return;
    setDigit(index, ch);
    cells.current[Math.min(index + 1, length - 1)]?.focus();
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').split('').filter(acceptChar);
    if (pasted.length === 0) return;
    const next = [...digits];
    let cursor = index;
    for (const ch of pasted) {
      if (cursor >= length) break;
      next[cursor] = ch;
      cursor += 1;
    }
    commit(next);
    cells.current[Math.min(cursor, length - 1)]?.focus();
  }

  return (
    <div
      {...rest}
      ref={ref}
      role="group"
      aria-label={ariaLabelledBy === undefined ? (label ?? 'PIN') : undefined}
      aria-labelledby={ariaLabelledBy}
      className={cx('t-pin', className)}
      data-invalid={wiring.invalid ? 'true' : undefined}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            cells.current[index] = node;
          }}
          type={mask ? 'password' : 'text'}
          inputMode={numericOnly ? 'numeric' : 'text'}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          className="t-pin-cell"
          value={digit}
          maxLength={1}
          disabled={wiring.disabled}
          aria-label={digitLabel(index, length)}
          aria-invalid={wiring.invalid ? true : undefined}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
        />
      ))}
    </div>
  );
});
