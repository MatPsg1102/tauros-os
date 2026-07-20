// Card — composição de Surface com elevação `card` e inset padrão (§11).
// Alinha-se ao contrato de Card da 5.3: contêiner de conteúdo agrupado.

import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import { Surface } from '../surface/surface.js';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Elemento semântico do agrupamento. */
  readonly as?: 'div' | 'section' | 'article';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { as = 'div', className, children, ...rest },
  ref,
) {
  return (
    <Surface {...rest} as={as} ref={ref} elevation="card" className={cx('t-card', className)}>
      {children}
    </Surface>
  );
});
