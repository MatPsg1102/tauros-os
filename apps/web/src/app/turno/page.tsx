// Rota /turno — abertura (7.1) + fechamento e acesso ao quadro (7.2).

'use client';

import { useCallback, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';

import { AppShell, TopBar } from '@tauros/ui-primitives';
import type { OperatorSessionRecord } from '@tauros/contracts';

import { useShiftClosing } from '../../controllers/use-shift-closing.js';
import { useShiftOpening } from '../../controllers/use-shift-opening.js';
import { appLink } from '../../navigation/links.js';
import { ShiftOpeningScreen } from '../../ui/shift-opening-screen.js';
import { useAppContainer } from '../providers.js';

export default function TurnoPage(): ReactElement {
  const container = useAppContainer();
  const router = useRouter();
  const [view, actions] = useShiftOpening(container);
  // o fechamento age sobre a MESMA sessão que a abertura expõe
  const [override, setOverride] = useState<OperatorSessionRecord | null>(null);
  const session = override ?? view.session;
  const onSessionChanged = useCallback((record: OperatorSessionRecord | null) => {
    setOverride(record);
  }, []);
  const [closing, closingActions] = useShiftClosing(container, session, onSessionChanged);

  return (
    <AppShell
      skipLink={{ label: 'Ir para o conteúdo', targetId: 'conteudo' }}
      topBar={<TopBar title="Tauros OS" />}
    >
      <ShiftOpeningScreen
        view={view}
        actions={actions}
        closing={closing}
        closingActions={closingActions}
        tasksLink={appLink(router, '/turno/tarefas')}
        supervisorLink={appLink(router, '/encarregado')}
      />
    </AppShell>
  );
}
