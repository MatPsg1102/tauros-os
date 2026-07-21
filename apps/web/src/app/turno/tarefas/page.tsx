// Rota /turno/tarefas — Quadro de Tarefas do Dia (7.2).

'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';

import { AppShell, TopBar } from '@tauros/ui-primitives';
import type { OperatorSessionRecord } from '@tauros/contracts';

import { useDailyTasks } from '../../../controllers/use-daily-tasks.js';
import { useOperatorSession } from '../../../controllers/operator-session-context.js';
import { appLink } from '../../../navigation/links.js';
import { DailyTasksScreen } from '../../../ui/daily-tasks-screen.js';
import { FIXTURE_STORE } from '../../../wiring/fixtures.js';
import { useAppContainer } from '../../providers.js';

export default function TarefasPage(): ReactElement {
  const container = useAppContainer();
  const router = useRouter();
  const identity = useOperatorSession();
  const [session, setSession] = useState<OperatorSessionRecord | null>(null);

  // o turno ativo vem do armazenamento local (sobrevive à navegação)
  const employeeId = identity.operator?.employeeId ?? null;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (employeeId === null) {
        setSession(null);
        return;
      }
      const active = await container.sessions.findActive(FIXTURE_STORE.id, employeeId);
      if (!cancelled) setSession(active);
    })();
    return () => {
      cancelled = true;
    };
  }, [container, employeeId]);

  const [view, actions] = useDailyTasks(container, session);

  return (
    <AppShell
      skipLink={{ label: 'Ir para o conteúdo', targetId: 'conteudo' }}
      topBar={<TopBar title="Tauros OS" />}
    >
      <DailyTasksScreen view={view} actions={actions} shiftLink={appLink(router, '/turno')} />
    </AppShell>
  );
}
