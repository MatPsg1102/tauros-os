// Providers do app (7.1 §19) — ThemeProvider oficial + injeção EXPLÍCITA da
// folha (uma vez, no cliente) + container do vertical slice via contexto.

'use client';

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { ThemeProvider } from '@tauros/theme';
import { injectUiStyles } from '@tauros/ui-primitives';

import { OperatorSessionProvider } from '../controllers/operator-session-context.js';
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

  // A PROMESSA do banner offline ("será enviado quando a conexão voltar")
  // precisa ser verdade: ao reconectar, drena a fila — os payloads carregam
  // a própria autoria, nenhuma identidade é necessária aqui. Guarda de
  // reentrância evita drenos sobrepostos.
  const drainingRef = useRef(false);
  useEffect(() => {
    const drain = (): void => {
      if (drainingRef.current) return;
      drainingRef.current = true;
      void value
        .drainAndReflect()
        .catch(() => undefined)
        .finally(() => {
          drainingRef.current = false;
        });
    };
    window.addEventListener('online', drain);
    return () => {
      window.removeEventListener('online', drain);
    };
  }, [value]);
  return (
    <ThemeProvider>
      <ContainerContext.Provider value={value}>
        <OperatorSessionProvider>{children}</OperatorSessionProvider>
      </ContainerContext.Provider>
    </ThemeProvider>
  );
}
