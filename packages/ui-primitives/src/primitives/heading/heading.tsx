// Heading — hierarquia semântica (h1–h5) SEPARADA da hierarquia visual
// (emphasis level1–5 dos tokens), conforme Information Hierarchy do
// Design Language. `level` define o elemento; `visualLevel` o peso visual.

import { createElement, forwardRef, type ComponentPropsWithoutRef, type ReactElement } from 'react';

import { cx } from '../../shared/class-names.js';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5;

export interface HeadingProps extends ComponentPropsWithoutRef<'h1'> {
  /** Nível semântico do documento (h1–h5). */
  readonly level: HeadingLevel;
  /** Nível VISUAL (emphasis level1–5); default = level semântico. */
  readonly visualLevel?: HeadingLevel;
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { level, visualLevel, className, children, ...rest },
  ref,
): ReactElement {
  return createElement(
    `h${level}`,
    {
      ...rest,
      ref,
      className: cx('t-heading', className),
      'data-visual': String(visualLevel ?? level),
    },
    children,
  );
});
