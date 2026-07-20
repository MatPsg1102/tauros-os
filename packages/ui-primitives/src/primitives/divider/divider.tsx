// Divider — separação visual; decorativo por padrão, semântico sob demanda.

import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  readonly orientation?: 'horizontal' | 'vertical';
  /** `true` (default) esconde de leitores de tela; `false` expõe role=separator. */
  readonly decorative?: boolean;
}

export const Divider = forwardRef<HTMLDivElement, DividerProps>(function Divider(
  { orientation = 'horizontal', decorative = true, className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={cx('t-divider', className)}
      data-orientation={orientation}
      {...(decorative
        ? { 'aria-hidden': 'true' as const }
        : { role: 'separator', 'aria-orientation': orientation })}
    />
  );
});
