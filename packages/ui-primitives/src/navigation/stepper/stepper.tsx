// Stepper (6.3.6 §9) — progresso entre etapas CONHECIDAS. Distinto de
// Progress (contínuo), Breadcrumb (localização) e Tabs (conteúdo).
// Estados multidimensionais: número/check/erro no marcador (forma+glifo),
// não só cor. aria-current="step". Navegável apenas quando explicitamente
// habilitado — validação/avanço são do aplicativo.

'use client';

import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';

export type StepStatus = 'upcoming' | 'current' | 'completed' | 'error' | 'disabled';

export interface StepDefinition {
  readonly label: string;
  readonly description?: string;
  readonly status: StepStatus;
}

export interface StepperProps extends HTMLAttributes<HTMLOListElement> {
  readonly steps: readonly StepDefinition[];
  readonly orientation?: 'horizontal' | 'vertical';
  /** Habilita seleção de etapas (o app decide quais via status). */
  readonly navigable?: boolean;
  readonly onStepSelect?: (index: number) => void;
  /** Nome acessível (default oficial pt-BR). */
  readonly 'aria-label'?: string;
}

const STATUS_GLYPH: Record<StepStatus, 'number' | 'check' | 'error'> = {
  upcoming: 'number',
  current: 'number',
  completed: 'check',
  error: 'error',
  disabled: 'number',
};

export const Stepper = forwardRef<HTMLOListElement, StepperProps>(function Stepper(
  {
    steps,
    orientation = 'horizontal',
    navigable = false,
    onStepSelect,
    'aria-label': ariaLabel = 'Etapas',
    className,
    ...rest
  },
  ref,
) {
  return (
    <ol
      {...rest}
      ref={ref}
      aria-label={ariaLabel}
      className={cx('t-stepper', className)}
      data-orientation={orientation}
    >
      {steps.map((step, index) => {
        const selectable = navigable && step.status !== 'disabled' && step.status !== 'upcoming';
        const marker = (
          <span className="t-step-marker" data-glyph={STATUS_GLYPH[step.status]} aria-hidden="true">
            {STATUS_GLYPH[step.status] === 'number' ? String(index + 1) : ''}
          </span>
        );
        const text = (
          <span className="t-step-text">
            <span className="t-step-label">{step.label}</span>
            {step.description !== undefined && (
              <span className="t-step-desc">{step.description}</span>
            )}
          </span>
        );
        return (
          <li
            key={`${String(index)}-${step.label}`}
            className="t-step"
            data-status={step.status}
            aria-current={step.status === 'current' ? 'step' : undefined}
          >
            {selectable ? (
              <button
                type="button"
                className="t-step-content t-focusable"
                onClick={() => onStepSelect?.(index)}
              >
                {marker}
                {text}
              </button>
            ) : (
              <span
                className="t-step-content"
                {...(step.status === 'disabled' ? { 'aria-disabled': true } : {})}
              >
                {marker}
                {text}
              </span>
            )}
            {index < steps.length - 1 && <span className="t-step-connector" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
});
