// Spacer — espaço explícito tokenizado; sempre decorativo (aria-hidden).

import { forwardRef, type HTMLAttributes } from 'react';

import { cssVar } from '@tauros/tokens';

import { cx } from '../../shared/class-names.js';
import type { GapToken } from '../stack/stack.js';

export interface SpacerProps extends HTMLAttributes<HTMLDivElement> {
  readonly size?: GapToken;
  readonly axis?: 'vertical' | 'horizontal';
}

export const Spacer = forwardRef<HTMLDivElement, SpacerProps>(function Spacer(
  { size = 200, axis = 'vertical', className, style, ...rest },
  ref,
) {
  const length = cssVar(`space-gap-${size}`);
  return (
    <div
      {...rest}
      ref={ref}
      aria-hidden="true"
      className={cx('t-spacer', className)}
      style={{
        flexShrink: 0,
        ...(axis === 'vertical' ? { height: length } : { width: length }),
        ...style,
      }}
    />
  );
});
