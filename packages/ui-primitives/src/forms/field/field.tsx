// Field (6.3.4 §1) — composição oficial rótulo/descrição/erro em torno de UM
// controle. IDs estáveis via useId (SSR-safe); erro associado por
// aria-describedby e anunciado por role=alert apenas quando montado (§17).
// A biblioteca não inventa textos de validação — recebe conteúdo pronto.

'use client';

import { useId, useMemo, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Label } from '../../primitives/label/label.js';
import { FieldContext, type FieldContextValue } from './field-context.js';

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  readonly label: string;
  readonly description?: string;
  /** Mensagem de erro pronta (conteúdo do consumidor). Presença ⇒ invalid. */
  readonly error?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  /** O controle único do campo (consome o contexto automaticamente). */
  readonly children: ReactNode;
}

export function Field({
  label,
  description,
  error,
  required = false,
  disabled = false,
  className,
  children,
  ...rest
}: FieldProps): ReactNode {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const labelId = `${baseId}-label`;
  const descriptionId = description === undefined ? undefined : `${baseId}-desc`;
  const errorId = error === undefined ? undefined : `${baseId}-error`;
  const invalid = error !== undefined;

  const context = useMemo<FieldContextValue>(
    () => ({ controlId, labelId, descriptionId, errorId, required, invalid, disabled }),
    [controlId, labelId, descriptionId, errorId, required, invalid, disabled],
  );

  return (
    <div
      {...rest}
      className={cx('t-field', className)}
      data-invalid={invalid ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
    >
      <Label id={labelId} htmlFor={controlId}>
        {label}
        {required && (
          <span className="t-field-required" aria-hidden="true">
            {' *'}
          </span>
        )}
      </Label>
      {descriptionId !== undefined && (
        <p id={descriptionId} className="t-field-desc">
          {description}
        </p>
      )}
      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
      {errorId !== undefined && (
        <p id={errorId} className="t-field-error" role="alert">
          <span className="t-field-error-marker" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
