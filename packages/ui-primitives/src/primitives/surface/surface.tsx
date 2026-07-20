// Surface — superfície elevada (elevation tokens); polimórfica (§11).

import { createElement, type ElementType, type ReactElement } from 'react';

import { cx } from '../../shared/class-names.js';
import type { PolymorphicProps } from '../../shared/polymorphic.js';

export type SurfaceElevation = 'flat' | 'card' | 'sheet' | 'dialog';

export interface SurfaceOwnProps {
  readonly elevation?: SurfaceElevation;
  readonly className?: string;
}

export type SurfaceProps<E extends ElementType = 'div'> = PolymorphicProps<E, SurfaceOwnProps>;

export function Surface<E extends ElementType = 'div'>({
  as,
  elevation = 'flat',
  className,
  children,
  ...rest
}: SurfaceProps<E>): ReactElement {
  const Tag: ElementType = as ?? 'div';
  return createElement(
    Tag,
    {
      ...rest,
      className: cx('t-surface', className),
      'data-elevation': elevation,
    },
    children,
  );
}
