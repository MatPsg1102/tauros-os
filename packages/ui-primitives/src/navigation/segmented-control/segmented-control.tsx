// SegmentedControl (catálogo 5.3) — seleção única entre poucas opções
// visíveis (filtro/modo). Radios nativos estilizados (mesma decisão da
// 6.3.4): semântica, teclado e formulário grátis. Nome acessível obrigatório.

'use client';

import { forwardRef, useId, useState, type ChangeEvent } from 'react';

import { assertAccessibleName } from '../../shared/accessibility.js';
import { cx } from '../../shared/class-names.js';

export interface SegmentedControlOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SegmentedControlProps {
  readonly options: readonly SegmentedControlOption[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly className?: string;
}

export const SegmentedControl = forwardRef<HTMLFieldSetElement, SegmentedControlProps>(
  function SegmentedControl(
    {
      options,
      value,
      defaultValue,
      onValueChange,
      disabled,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      className,
    },
    ref,
  ) {
    assertAccessibleName('SegmentedControl', {
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
    });
    const name = useId();
    const controlled = value !== undefined;
    const [internal, setInternal] = useState<string | undefined>(defaultValue);
    const selected = controlled ? value : internal;

    return (
      <fieldset
        ref={ref}
        role="radiogroup"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cx('t-segmented', className)}
        disabled={disabled}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="t-segment"
            data-selected={selected === option.value ? 'true' : undefined}
            data-disabled={option.disabled === true || disabled === true ? 'true' : undefined}
          >
            <input
              type="radio"
              className="t-segment-input t-visually-hidden"
              name={name}
              value={option.value}
              checked={selected === option.value}
              disabled={option.disabled ?? disabled}
              onChange={(event) => {
                if (!controlled) setInternal(option.value);
                onValueChange?.(option.value, event);
              }}
            />
            <span className="t-segment-label">{option.label}</span>
          </label>
        ))}
      </fieldset>
    );
  },
);
