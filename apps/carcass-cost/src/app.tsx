// Shell do aplicativo — três telas, sem roteador (estado local resolve;
// nenhuma biblioteca extra). A calculadora é a tela inicial, sem menu.
// Ao trocar de tela, o scroll volta ao topo e o foco vai para o início da
// nova tela (as telas trocam dentro do MESMO container de scroll do
// AppShell — sem isso a tela nova aparece rolada no meio e a troca é
// silenciosa para leitores de tela).

import { AppShell, Container, Page } from '@tauros/ui-primitives';
import { cssVar } from '@tauros/tokens';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { useCalculator } from './state/use-calculator.js';
import { CalculatorScreen } from './ui/calculator-screen.js';
import { HistoryScreen } from './ui/history-screen.js';
import { SettingsScreen } from './ui/settings-screen.js';

type View = 'calculator' | 'settings' | 'history';

export function App(): ReactElement {
  const calc = useCalculator();
  const [view, setView] = useState<View>('calculator');
  const screenRef = useRef<HTMLDivElement | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    // Na primeira montagem o foco fica onde o navegador o deixou.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const screen = screenRef.current;
    if (screen === null) return;
    screen.focus();
    // jsdom não implementa scrollIntoView — em navegador real sempre existe.
    if (typeof screen.scrollIntoView === 'function') {
      screen.scrollIntoView({ block: 'start' });
    }
  }, [view]);

  return (
    <AppShell>
      <Page>
        <Container size="narrow" style={{ padding: cssVar('space-inset-md'), width: '100%' }}>
          <div ref={screenRef} tabIndex={-1} style={{ outline: 'none' }}>
            {view === 'calculator' ? (
              <CalculatorScreen
                calc={calc}
                onOpenSettings={() => {
                  setView('settings');
                }}
                onOpenHistory={() => {
                  setView('history');
                }}
              />
            ) : view === 'settings' ? (
              <SettingsScreen
                calc={calc}
                onBack={() => {
                  setView('calculator');
                }}
              />
            ) : (
              <HistoryScreen
                calc={calc}
                onBack={() => {
                  setView('calculator');
                }}
                onOpenEntry={() => {
                  setView('calculator');
                }}
              />
            )}
          </div>
        </Container>
      </Page>
    </AppShell>
  );
}
