// LoadingState (6.3.5 §19) — carregamento de uma REGIÃO (nunca bloqueia a
// aplicação inteira). Compõe Spinner/Skeleton/Text existentes — sem
// duplicação. Anúncio acessível único via Spinner (role=status); variante
// skeleton preserva layout com aria-hidden e rótulo oculto próprio.
// Sem timers (atraso de exibição não consta do congelamento — pendência).

'use client';

import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import { Skeleton } from '../../primitives/skeleton/skeleton.js';
import { Spinner } from '../../primitives/spinner/spinner.js';
import { Text } from '../../primitives/text/text.js';

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Texto anunciado e exibido (default oficial pt-BR). */
  readonly label?: string;
  /** 'spinner' (default) ou 'skeleton' (preserva layout de listas). */
  readonly variant?: 'spinner' | 'skeleton';
  /** Linhas do skeleton (variante skeleton). */
  readonly lines?: number;
}

export const LoadingState = forwardRef<HTMLDivElement, LoadingStateProps>(function LoadingState(
  { label = 'Carregando conteúdo', variant = 'spinner', lines = 3, className, ...rest },
  ref,
) {
  if (variant === 'skeleton') {
    return (
      <div
        {...rest}
        ref={ref}
        role="status"
        className={cx('t-state', 't-loading-state', className)}
      >
        <span className="t-visually-hidden">{label}</span>
        <div className="t-loading-skeletons" aria-hidden="true">
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton key={index} variant="text" width="100%" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div {...rest} ref={ref} className={cx('t-state', 't-loading-state', className)}>
      <Spinner size="lg" label={label} />
      <Text as="p" tone="secondary" aria-hidden="true">
        {label}
      </Text>
    </div>
  );
});
