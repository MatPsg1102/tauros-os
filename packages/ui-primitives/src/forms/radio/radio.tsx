// Radio + RadioGroup (6.3.4 §10) — contratos DISTINTOS, controles nativos.
// Navegação por setas e agrupamento vêm do name compartilhado (sem roving
// tabindex manual). RadioGroup = fieldset+legend com erro/descrição do grupo.

'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type ChangeEvent,
  type FieldsetHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { cx } from '../../shared/class-names.js';
import { composeIds } from '../field/field-context.js';

interface RadioGroupContextValue {
  readonly name: string;
  readonly selected: string | undefined;
  readonly onSelect: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly describedBy: string | undefined;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'children'
> {
  readonly value: string;
  readonly label?: ReactNode;
  readonly invalid?: boolean;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { value, label, invalid, className, name, checked, disabled, required, onChange, ...rest },
  ref,
) {
  const group = useContext(RadioGroupContext);
  const effectiveDisabled = disabled ?? group?.disabled ?? false;
  const effectiveInvalid = invalid ?? group?.invalid ?? false;

  const input = (
    <input
      {...rest}
      ref={ref}
      type="radio"
      value={value}
      name={name ?? group?.name}
      checked={group !== null ? group.selected === value : checked}
      required={required ?? group?.required}
      disabled={effectiveDisabled}
      className={cx('t-radio-input', className)}
      data-invalid={effectiveInvalid ? 'true' : undefined}
      aria-invalid={effectiveInvalid ? true : undefined}
      onChange={(event) => {
        group?.onSelect(value, event);
        onChange?.(event);
      }}
    />
  );

  if (label === undefined) return input;
  return (
    <label className="t-choice-row" data-disabled={effectiveDisabled ? 'true' : undefined}>
      {input}
      <span>{label}</span>
    </label>
  );
});

export interface RadioGroupProps extends Omit<
  FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'onChange' | 'defaultValue'
> {
  /** Rótulo do grupo (legend). */
  readonly label: string;
  readonly description?: string;
  /** Erro do GRUPO — associado e anunciado (role=alert na montagem). */
  readonly error?: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  readonly orientation?: 'vertical' | 'horizontal';
  readonly required?: boolean;
  readonly invalid?: boolean;
  /** Name compartilhado; gerado de forma estável (useId) quando omitido. */
  readonly name?: string;
}

export const RadioGroup = forwardRef<HTMLFieldSetElement, RadioGroupProps>(function RadioGroup(
  {
    label,
    description,
    error,
    value,
    defaultValue,
    onValueChange,
    orientation = 'vertical',
    required = false,
    invalid,
    name,
    disabled,
    className,
    children,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const baseId = useId();
  const generatedName = `${baseId}-radio`;
  const descriptionId = description === undefined ? undefined : `${baseId}-desc`;
  const errorId = error === undefined ? undefined : `${baseId}-error`;
  const effectiveInvalid = invalid ?? error !== undefined;

  const controlled = value !== undefined;
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const selected = controlled ? value : internal;

  const context: RadioGroupContextValue = {
    name: name ?? generatedName,
    selected,
    onSelect: (next, event) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next, event);
    },
    disabled: disabled === true,
    invalid: effectiveInvalid,
    required,
    describedBy: composeIds(ariaDescribedBy, descriptionId, errorId),
  };

  return (
    <fieldset
      {...rest}
      ref={ref}
      role="radiogroup"
      className={cx('t-radiogroup', className)}
      disabled={disabled}
      aria-describedby={context.describedBy}
      aria-invalid={effectiveInvalid ? true : undefined}
      aria-required={required ? true : undefined}
    >
      <legend className="t-radiogroup-legend">{label}</legend>
      {descriptionId !== undefined && (
        <p id={descriptionId} className="t-field-desc">
          {description}
        </p>
      )}
      <div className="t-radiogroup-items" data-orientation={orientation}>
        <RadioGroupContext.Provider value={context}>{children}</RadioGroupContext.Provider>
      </div>
      {errorId !== undefined && (
        <p id={errorId} className="t-field-error" role="alert">
          <span className="t-field-error-marker" aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  );
});
