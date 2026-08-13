// Rota /encarregado — Área do Encarregado (gestão e acompanhamento de
// tarefas da equipe).

'use client';

import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';

import { AppShell, TopBar } from '@tauros/ui-primitives';

import { useSupervisorDashboard } from '../../controllers/use-supervisor-dashboard.js';
import { appLink } from '../../navigation/links.js';
import { SupervisorDashboardScreen } from '../../ui/supervisor-dashboard-screen.js';
import { useAppContainer } from '../providers.js';

export default function EncarregadoPage(): ReactElement {
  const container = useAppContainer();
  const router = useRouter();
  const [view, actions] = useSupervisorDashboard(container);
  return (
    <AppShell
      skipLink={{ label: 'Ir para o conteúdo', targetId: 'conteudo' }}
      topBar={<TopBar title="Tauros OS" />}
    >
      <SupervisorDashboardScreen
        view={view}
        actions={actions}
        turnoLink={appLink(router, '/turno')}
      />
    </AppShell>
  );
}
