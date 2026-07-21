// Container (6.3.7 §11) — largura máxima e centralização, nada mais.
// Tamanhos semânticos mapeados a fontes congeladas:
//   narrow   → medida de leitura (65ch — decisão 6.3.5, candidato a token)
//   standard → core.breakpoint.tablet
//   wide     → core.breakpoint.desktop
//   full     → sem restrição
// Nenhum pixel arbitrário exposto na API.

'use client';

import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';

export type ContainerSize = 'narrow' | 'standard' | 'wide' | 'full';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  readonly size?: ContainerSize;
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(function Container(
  { size = 'standard', className, children, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={cx('t-container', className)} data-size={size}>
      {children}
    </div>
  );
});
