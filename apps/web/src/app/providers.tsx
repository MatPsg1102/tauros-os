// Providers do app (7.1 §19) — ThemeProvider oficial + injeção EXPLÍCITA da
// folha (uma vez, no cliente) + container do vertical slice via contexto.

'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { ThemeProvider } from '@tauros/theme';
import { injectUiStyles } from '@tauros/ui-primitives';

import { buildContainer, type AppContainer } from '../wiring/container.js';

const ContainerContext = createContext<AppContainer | null>(null);

export function useAppContainer(): AppContainer {
  const container = useContext(ContainerContext);
  if (container === null) throw new Error('AppProviders ausente');
  return container;
}

export function AppProviders({
  children,
  container,
}: {
  readonly children: ReactNode;
  readonly container?: AppContainer;
}): ReactNode {
  const value = useMemo(() => container ?? buildContainer(), [container]);
  useEffect(() => {
    injectUiStyles(document);
  }, []);
  return (
    <ThemeProvider>
      <ContainerContext.Provider value={value}>{children}</ContainerContext.Provider>
    </ThemeProvider>
  );
}
