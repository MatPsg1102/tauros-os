// Rota /encarregado — Área do Encarregado (gestão e acompanhamento de
// tarefas da equipe).

'use client';

import type { ReactElement } from 'react';

import { useSupervisorDashboard } from '../../controllers/use-supervisor-dashboard.js';
import { useTeamManagement } from '../../controllers/use-team-management.js';
import { AppChrome } from '../../ui/app-chrome.js';
import { SupervisorDashboardScreen } from '../../ui/supervisor-dashboard-screen.js';
import { useAppContainer } from '../providers.js';

export default function EncarregadoPage(): ReactElement {
  const container = useAppContainer();
  const [view, actions] = useSupervisorDashboard(container);
  // cadastro novo reflete nos seletores de tarefa: recarrega o dashboard
  const [teamView, teamActions] = useTeamManagement(container, {
    onWorkforceChanged: () => void actions.reload(),
  });
  return (
    <AppChrome current="gestao" connected={view.readyToSync}>
      <SupervisorDashboardScreen
        view={view}
        actions={actions}
        teamView={teamView}
        teamActions={teamActions}
      />
    </AppChrome>
  );
}
