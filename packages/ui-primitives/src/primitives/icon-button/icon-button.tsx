// IconButton (6.3.3 §7) — botão exclusivamente icônico. Nome acessível é
// OBRIGATÓRIO (erro orientado em desenvolvimento). Área quadrada glove-first.

import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { assertAccessibleName } from '../../shared/accessibility.js';
import { cx } from '../../shared/class-names.js';
import type { ButtonVariant } from '../button/button.js';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', className, children, type, ...rest },
  ref,
) {
  assertAccessibleName('IconButton', rest);
  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      className={cx('t-btn', 't-iconbtn', 't-focusable', className)}
      data-variant={variant}
      data-size="md"
    >
      {children}
    </button>
  );
});
