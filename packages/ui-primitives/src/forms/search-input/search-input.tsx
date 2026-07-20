// SearchInput (6.3.4 §8) — campo de busca visual/semântico. SEM requisição,
// debounce, resultados ou histórico (responsabilidade do consumidor).
// Textos auxiliares via props com defaults oficiais pt-BR documentados.

'use client';

import { forwardRef, useRef, type InputHTMLAttributes, type MouseEvent } from 'react';

import { cx } from '../../shared/class-names.js';
import { Spinner } from '../../primitives/spinner/spinner.js';
import { resolveControlWiring, useFieldContext } from '../field/field-context.js';
import { ControlFrame } from '../shared/control-frame.js';

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly invalid?: boolean;
  /** Mostra botão de limpar quando há conteúdo e chama este callback. */
  readonly onClear?: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly clearLabel?: string;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    size = 'md',
    invalid,
    onClear,
    clearLabel = 'Limpar busca',
    loading = false,
    loadingLabel = 'Buscando',
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
  const innerRef = useRef<HTMLInputElement | null>(null);

  return (
    <ControlFrame
      invalid={wiring.invalid}
      disabled={wiring.disabled}
      readOnly={readOnly === true}
      size={size}
      startAdornment={<span className="t-search-glyph" />}
      trailing={
        <>
          {loading && <Spinner size="sm" label={loadingLabel} />}
          {onClear !== undefined && !loading && (
            <button
              type="button"
              className="t-clear t-focusable"
              aria-label={clearLabel}
              disabled={wiring.disabled}
              onClick={(event) => {
                onClear(event);
                innerRef.current?.focus();
              }}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          )}
        </>
      }
    >
      <input
        {...rest}
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref !== null) ref.current = node;
        }}
        id={wiring.id}
        type="search"
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
