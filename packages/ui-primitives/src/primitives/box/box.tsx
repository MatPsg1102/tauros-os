// Box — primitivo estrutural base (6.3.3 §3/§4). Polimórfico; sem semântica
// visual própria: apenas contêiner + espaçamento interno tokenizado.

import { createElement, type ElementType, type ReactElement } from 'react';

import { cssVar } from '@tauros/tokens';

import { cx } from '../../shared/class-names.js';
import type { PolymorphicProps } from '../../shared/polymorphic.js';

export type InsetToken = 'sm' | 'md' | 'lg';

export interface BoxOwnProps {
  /** Espaçamento interno via token semântico (`space.inset.*`). */
  readonly padding?: InsetToken;
  readonly className?: string;
}

export type BoxProps<E extends ElementType = 'div'> = PolymorphicProps<E, BoxOwnProps>;

export function Box<E extends ElementType = 'div'>({
  as,
  padding,
  className,
  style,
  children,
  ...rest
}: BoxProps<E>): ReactElement {
  const Tag: ElementType = as ?? 'div';
  return createElement(
    Tag,
    {
      ...rest,
      className: cx('t-box', className),
      style:
        padding === undefined ? style : { padding: cssVar(`space-inset-${padding}`), ...style },
    },
    children,
  );
}
