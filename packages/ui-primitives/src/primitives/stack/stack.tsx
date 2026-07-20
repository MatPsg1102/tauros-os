// Stack — empilhamento vertical com gap tokenizado (6.3.3 §8).

import { createElement, type ElementType, type ReactElement } from 'react';

import { cssVar, type CoreTokens } from '@tauros/tokens';

import { cx } from '../../shared/class-names.js';
import type { PolymorphicProps } from '../../shared/polymorphic.js';

export type GapToken = keyof CoreTokens['space'];

export interface StackOwnProps {
  readonly gap?: GapToken;
  readonly align?: 'stretch' | 'start' | 'center' | 'end';
  readonly className?: string;
}

export type StackProps<E extends ElementType = 'div'> = PolymorphicProps<E, StackOwnProps>;

const ALIGN_MAP = {
  stretch: 'stretch',
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
} as const;

export function Stack<E extends ElementType = 'div'>({
  as,
  gap = 200,
  align = 'stretch',
  className,
  style,
  children,
  ...rest
}: StackProps<E>): ReactElement {
  const Tag: ElementType = as ?? 'div';
  return createElement(
    Tag,
    {
      ...rest,
      className: cx('t-stack', className),
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: cssVar(`space-gap-${gap}`),
        alignItems: ALIGN_MAP[align],
        ...style,
      },
    },
    children,
  );
}
