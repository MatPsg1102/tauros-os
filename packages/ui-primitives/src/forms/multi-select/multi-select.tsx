// MultiSelect (6.3.4 §13) — núcleo estruturalmente correto sobre
// <select multiple> nativo (aria-multiselectable intrínseco, teclado nativo)
// + resumo acessível com Chips removíveis (reuso do Chip 6.3.3, sem duplicar
// comportamento). DEPENDÊNCIA REGISTRADA: a variante com trigger + listbox
// suspensa exige Popover (6.3.5) — API preparada, sem versão improvisada.
// Opções via prop tipada (o resumo precisa dos rótulos).

'use client';

import { forwardRef, useState, type ChangeEvent, type SelectHTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import { Chip } from '../../primitives/chip/chip.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';
import { ControlFrame } from '../shared/control-frame.js';

export interface MultiSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface MultiSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'multiple' | 'value' | 'defaultValue' | 'onChange' | 'size' | 'children'
> {
  readonly options: readonly MultiSelectOption[];
  /** Valores selecionados (controlado). */
  readonly value?: readonly string[];
  readonly defaultValue?: readonly string[];
  readonly onValueChange?: (values: readonly string[]) => void;
  readonly onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly invalid?: boolean;
  /** Texto do resumo vazio. Default oficial pt-BR documentado. */
  readonly emptyLabel?: string;
  /** Rótulo do botão de remoção por item: recebe o label do item. */
  readonly removeItemLabel?: (itemLabel: string) => string;
}

export const MultiSelect = forwardRef<HTMLSelectElement, MultiSelectProps>(function MultiSelect(
  {
    options,
    value,
    defaultValue,
    onValueChange,
    onChange,
    invalid,
    emptyLabel = 'Nenhum item selecionado',
    removeItemLabel = (itemLabel) => `Remover ${itemLabel}`,
    className,
    id,
    required,
    disabled,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<readonly string[]>(defaultValue ?? []);
  const selected = controlled ? value : internal;

  const wiring = resolveControlWiring(
    { id, 'aria-describedby': ariaDescribedBy, required, disabled, invalid },
    useFieldContext(),
  );

  function commit(next: readonly string[]): void {
    if (!controlled) setInternal(next);
    onValueChange?.(next);
  }

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const next = Array.from(event.target.selectedOptions, (option) => option.value);
    commit(next);
    onChange?.(event);
  }

  const selectedOptions = options.filter((option) => selected.includes(option.value));

  return (
    <div className="t-ms">
      <ControlFrame invalid={wiring.invalid} disabled={wiring.disabled}>
        <select
          {...rest}
          ref={ref}
          id={wiring.id}
          multiple
          className={cx('t-control', className)}
          value={[...selected]}
          onChange={handleChange}
          required={wiring.required}
          disabled={wiring.disabled}
          aria-describedby={wiring.describedBy}
          aria-invalid={wiring.invalid ? true : undefined}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </ControlFrame>
      <div className="t-ms-summary">
        {selectedOptions.length === 0 ? (
          <span className="t-ms-empty">{emptyLabel}</span>
        ) : (
          selectedOptions.map((option) => (
            <Chip
              key={option.value}
              selected
              disabled={wiring.disabled}
              removeLabel={removeItemLabel(option.label)}
              onRemove={() => commit(selected.filter((v) => v !== option.value))}
            >
              {option.label}
            </Chip>
          ))
        )}
      </div>
    </div>
  );
});
