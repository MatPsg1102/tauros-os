// Guarda de landmark principal (6.3.7 §27/§32) — uma composição nunca pode
// produzir dois <main>. Page com as="main" registra-se no contexto; um
// segundo main aninhado gera erro orientado (TypeScript não impede isso).

'use client';

import { createContext, useContext } from 'react';

export const MainLandmarkContext = createContext(false);

export class MultipleMainLandmarksError extends Error {
  constructor() {
    super(
      'Composição de layout produziria dois landmarks <main>. ' +
        'Use `as="section"` (ou `as="div"`) na Page interna — apenas uma ' +
        'Page por composição pode ser o main da tela.',
    );
    this.name = 'MultipleMainLandmarksError';
  }
}

export function useMainLandmarkGuard(isMain: boolean): void {
  const hasMainAncestor = useContext(MainLandmarkContext);
  if (isMain && hasMainAncestor) throw new MultipleMainLandmarksError();
}
