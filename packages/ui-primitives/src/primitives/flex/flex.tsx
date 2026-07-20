// Flex — alinhamento horizontal/flexível com gap tokenizado (6.3.3 §8).

import { createElement, type ElementType, type ReactElement } from 'react';

import { cssVar } from '@tauros/tokens';

import { cx } from '../../shared/class-names.js';
import type { PolymorphicProps } from '../../shared/polymorphic.js';
import type { GapToken } from '../stack/stack.js';

export interface FlexOwnProps {
  readonly direction?: 'row' | 'column';
  readonly gap?: GapToken;
  readonly align?: 'stretch' | 'start' | 'center' | 'end' | 'baseline';
  readonly justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  readonly wrap?: boolean;
  readonly className?: string;
}

export type FlexProps<E extends ElementType = 'div'> = PolymorphicProps<E, FlexOwnProps>;

const ALIGN = {
  stretch: 'stretch',
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  baseline: 'baseline',
} as const;

const JUSTIFY = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
} as const;

export function Flex<E extends ElementType = 'div'>({
  as,
  direction = 'row',
  gap = 200,
  align = 'center',
  justify = 'start',
  wrap = false,
  className,
  style,
  children,
  ...rest
}: FlexProps<E>): ReactElement {
  const Tag: ElementType = as ?? 'div';
  return createElement(
    Tag,
    {
      ...rest,
      className: cx('t-flex', className),
      style: {
        display: 'flex',
        flexDirection: direction,
        gap: cssVar(`space-gap-${gap}`),
        alignItems: ALIGN[align],
        justifyContent: JUSTIFY[justify],
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      },
    },
    children,
  );
}
