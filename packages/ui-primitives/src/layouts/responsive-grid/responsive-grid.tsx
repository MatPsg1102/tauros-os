// ResponsiveGrid (6.3.7 §14) — preset seguro de grid responsivo por CSS puro
// (repeat(auto-fit, minmax(min(100%, <medida>), 1fr))) — ZERO JavaScript de
// viewport, SSR determinístico. Não é um sistema paralelo ao Grid primitive:
// Grid = colunas explícitas; ResponsiveGrid = fluxo por medida mínima de
// item. Medidas semânticas (sm/md/lg) em ch — mesma família da pendência de
// token "measure" registrada (6.3.5). maxColumns: fora do contrato (CSS puro
// não expressa cap com auto-fit sem hacks) — registrado.

'use client';

import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import type { GapToken } from '../../primitives/stack/stack.js';
import { cssVar } from '@tauros/tokens';

export type GridItemSize = 'sm' | 'md' | 'lg';

export interface ResponsiveGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Medida mínima de cada item (sm=20ch, md=30ch, lg=40ch). */
  readonly itemSize?: GridItemSize;
  readonly gap?: GapToken;
}

export const ResponsiveGrid = forwardRef<HTMLDivElement, ResponsiveGridProps>(
  function ResponsiveGrid(
    { itemSize = 'md', gap = 200, className, style, children, ...rest },
    ref,
  ) {
    return (
      <div
        {...rest}
        ref={ref}
        className={cx('t-rgrid', className)}
        data-item-size={itemSize}
        style={{ gap: cssVar(`space-gap-${gap}`), ...style }}
      >
        {children}
      </div>
    );
  },
);
