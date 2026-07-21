// Page (6.3.7 §9) — estrutura semântica de uma tela operacional: landmark
// (main por default; section/div para composição), fluxo vertical e
// espaçamento tokenizados. Largura/centralização são do Container (conceitos
// distintos, não fundidos). Dois <main> ⇒ MultipleMainLandmarksError.
// TopBar/Breadcrumb/título/ações NÃO são embutidos — compostos via
// PageHeader/Section.

'use client';

import { createElement, forwardRef, type ElementType, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';
import { MainLandmarkContext, useMainLandmarkGuard } from '../shared/landmark-context.js';

export interface PageProps extends HTMLAttributes<HTMLElement> {
  /** Elemento raiz. 'main' (default) participa da guarda de landmark único. */
  readonly as?: 'main' | 'section' | 'div';
  /** Densidade estrutural do fluxo vertical. */
  readonly density?: 'compact' | 'default' | 'comfortable';
}

export const Page = forwardRef<HTMLElement, PageProps>(function Page(
  { as = 'main', density = 'default', className, children, ...rest },
  ref,
) {
  const isMain = as === 'main';
  useMainLandmarkGuard(isMain);
  const Tag: ElementType = as;
  const element = createElement(
    Tag,
    { ...rest, ref, className: cx('t-page', className), 'data-density': density },
    children,
  );
  return isMain ? (
    <MainLandmarkContext.Provider value>{element}</MainLandmarkContext.Provider>
  ) : (
    element
  );
});
