// Text — tipografia semântica por papel (5.2-B type.role); polimórfico.
// Papel/tono são variantes semânticas — nunca props de token arbitrário (§3).

import { createElement, type ElementType, type ReactElement } from 'react';

import { cx } from '../../shared/class-names.js';
import type { PolymorphicProps } from '../../shared/polymorphic.js';

export type TextRole = 'body' | 'label' | 'data' | 'caption';
export type TextTone = 'primary' | 'secondary' | 'tertiary';

export interface TextOwnProps {
  readonly role?: TextRole;
  readonly tone?: TextTone;
  readonly className?: string;
}

export type TextProps<E extends ElementType = 'span'> = PolymorphicProps<E, TextOwnProps>;

export function Text<E extends ElementType = 'span'>({
  as,
  role = 'body',
  tone = 'primary',
  className,
  children,
  ...rest
}: TextProps<E>): ReactElement {
  const Tag: ElementType = as ?? 'span';
  return createElement(
    Tag,
    {
      ...rest,
      className: cx('t-text', className),
      'data-role': role,
      'data-tone': tone,
    },
    children,
  );
}
