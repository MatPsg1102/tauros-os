// FAB (catálogo 5.3) — ação flutuante primária. Composição sobre Button
// (sem duplicar estados/loading); nome acessível obrigatório; posição
// declarativa tokenizada (z-sticky, offsets por spacing tokens).

'use client';

import { forwardRef, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Button, type ButtonProps } from '../../primitives/button/button.js';

export interface FabProps extends Omit<ButtonProps, 'variant' | 'size' | 'fullWidth'> {
  /** Nome acessível obrigatório (ícone sozinho não basta). */
  readonly label: string;
  readonly icon: ReactNode;
  /** Estendido mostra o rótulo visível ao lado do ícone. */
  readonly extended?: boolean;
}

export const Fab = forwardRef<HTMLButtonElement, FabProps>(function Fab(
  { label, icon, extended = false, className, ...rest },
  ref,
) {
  return (
    <Button
      {...rest}
      ref={ref}
      variant="primary"
      size="lg"
      aria-label={extended ? undefined : label}
      className={cx('t-fab', className)}
      data-extended={extended ? 'true' : undefined}
      startIcon={icon}
    >
      {extended ? label : null}
    </Button>
  );
});
