// SplitView (6.3.7 §16/§17) — duas regiões relacionadas (lista+detalhe,
// principal+auxiliar). Split ESTÁTICO e responsivo: proporções tokenizadas
// por preset, colapso para pilha abaixo do breakpoint tablet (CSS puro,
// valor vindo do token no gerador da folha). Redimensionamento manual NÃO
// está congelado — não implementado (sem lib de resizable panels).
// Master–Detail = este componente com ratio adequado; a alternância
// lista/detalhe no mobile pertence à aplicação/rota (documentado).
// Headings/landmarks das regiões são do consumidor; overflow independente.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';

export type SplitRatio = '1:1' | '2:1' | '1:2';

export interface SplitViewProps extends HTMLAttributes<HTMLDivElement> {
  readonly primary: ReactNode;
  readonly secondary: ReactNode;
  readonly orientation?: 'horizontal' | 'vertical';
  /** Proporção primária:secundária (presets tokenizados — sem frações livres). */
  readonly ratio?: SplitRatio;
}

export const SplitView = forwardRef<HTMLDivElement, SplitViewProps>(function SplitView(
  { primary, secondary, orientation = 'horizontal', ratio = '2:1', className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={cx('t-split', className)}
      data-orientation={orientation}
      data-ratio={ratio}
    >
      <div className="t-split-primary">{primary}</div>
      <div className="t-split-secondary">{secondary}</div>
    </div>
  );
});
