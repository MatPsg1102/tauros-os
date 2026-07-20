// Grid — grade uniforme com colunas explícitas e gap tokenizado (6.3.3 §8).

import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';

import { cssVar } from '@tauros/tokens';

import { cx } from '../../shared/class-names.js';
import type { GapToken } from '../stack/stack.js';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** Número de colunas uniformes (1–12). */
  readonly columns?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  readonly gap?: GapToken;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(function Grid(
  { columns = 2, gap = 200, className, style, children, ...rest },
  ref,
) {
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: cssVar(`space-gap-${gap}`),
    ...style,
  };
  return (
    <div {...rest} ref={ref} className={cx('t-grid', className)} style={gridStyle}>
      {children}
    </div>
  );
});
