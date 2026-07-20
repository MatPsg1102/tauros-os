// Label — rótulo de controle; associação explícita via htmlFor.

import { forwardRef, type LabelHTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  readonly tone?: 'primary' | 'secondary';
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { tone = 'primary', className, children, ...rest },
  ref,
) {
  return (
    <label
      {...rest}
      ref={ref}
      className={cx('t-text', 't-label', className)}
      data-role="label"
      data-tone={tone}
    >
      {children}
    </label>
  );
});
