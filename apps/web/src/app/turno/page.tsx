// Rota /turno — abertura (7.1) + fechamento e acesso ao quadro (7.2).

'use client';

import { useCallback, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';

import type { OperatorSessionRecord } from '@tauros/contracts';

import { useShiftClosing } from '../../controllers/use-shift-closing.js';
import { useShiftOpening } from '../../controllers/use-shift-opening.js';
import { appLink } from '../../navigation/links.js';
import { AppChrome } from '../../ui/app-chrome.js';
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
    <AppChrome current="turno" connected={view.connectivity.readyToSync}>
      <ShiftOpeningScreen
        view={view}
        actions={actions}
        closing={closing}
        closingActions={closingActions}
        tasksLink={appLink(router, '/turno/tarefas')}
        supervisorLink={appLink(router, '/encarregado')}
      />
    </AppChrome>
  );
}
