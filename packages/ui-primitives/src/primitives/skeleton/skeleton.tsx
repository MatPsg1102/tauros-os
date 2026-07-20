// Skeleton (6.3.3 §14) — placeholder de carregamento; invisível para
// leitores de tela (o anúncio pertence ao contêiner que carrega).

import { forwardRef, type HTMLAttributes } from 'react';

import { cssVar } from '@tauros/tokens';

import { cx } from '../../shared/class-names.js';
import type { GapToken } from '../stack/stack.js';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: 'text' | 'rect' | 'circle';
  /** Largura estrutural ('100%') ou token de espaço. */
  readonly width?: '100%' | GapToken;
  /** Altura via token de espaço (rect/circle). */
  readonly height?: GapToken;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { variant = 'text', width, height, className, style, ...rest },
  ref,
) {
  const w =
    width === undefined ? undefined : width === '100%' ? '100%' : cssVar(`space-gap-${width}`);
  const h = height === undefined ? undefined : cssVar(`space-gap-${height}`);
  return (
    <div
      {...rest}
      ref={ref}
      aria-hidden="true"
      className={cx('t-skeleton', className)}
      data-variant={variant}
      style={{
        ...(w !== undefined ? { width: w } : {}),
        ...(h !== undefined ? { height: h } : {}),
        ...(variant === 'circle' && h !== undefined ? { width: w ?? h } : {}),
        ...style,
      }}
    />
  );
});
