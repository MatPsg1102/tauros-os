// Progress (6.3.5 §10) — variantes oficiais: LINEAR determinado e
// indeterminado (a variante circular indeterminada é o Spinner da 6.3.3;
// circular determinado não consta do congelamento — pendência registrada).
// Valores inválidos tratados de forma PREVISÍVEL: clamp documentado a
// [min, max]; min >= max é erro orientado. Nunca só cor: barra + texto de
// valor opcional + label.

'use client';

import { forwardRef, type HTMLAttributes } from 'react';

export class InvalidProgressRangeError extends Error {
  constructor(min: number, max: number) {
    super(`Progress: min (${String(min)}) deve ser menor que max (${String(max)}).`);
    this.name = 'InvalidProgressRangeError';
  }
}

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** Ausente ⇒ indeterminado. Inválido/fora de faixa ⇒ clamp documentado. */
  readonly value?: number;
  readonly min?: number;
  readonly max?: number;
  /** Nome acessível da barra (obrigatório sem aria-labelledby). */
  readonly label: string;
  /** Texto de valor legível (ex.: "3 de 8"). */
  readonly valueText?: string;
  /** Exibe o texto de valor visualmente ao lado da barra. */
  readonly showValueText?: boolean;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { value, min = 0, max = 100, label, valueText, showValueText = false, className, ...rest },
  ref,
) {
  if (min >= max) throw new InvalidProgressRangeError(min, max);
  const indeterminate = value === undefined || Number.isNaN(value);
  const clamped = indeterminate ? undefined : Math.min(max, Math.max(min, value));
  const percent = clamped === undefined ? 0 : ((clamped - min) / (max - min)) * 100;

  return (
    <div className="t-progress-row" data-indeterminate={indeterminate ? 'true' : undefined}>
      <div
        {...rest}
        ref={ref}
        role="progressbar"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={valueText}
        className={className === undefined ? 't-progress' : `t-progress ${className}`}
        data-indeterminate={indeterminate ? 'true' : undefined}
      >
        <div
          className="t-progress-fill"
          style={indeterminate ? undefined : { width: `${String(percent)}%` }}
        />
      </div>
      {showValueText && valueText !== undefined && (
        <span className="t-progress-valuetext">{valueText}</span>
      )}
    </div>
  );
});
