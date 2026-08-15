// Rota /operacao — OPERAÇÃO DE HOJE: quadro compartilhado da loja (tablet no
// chão de operação). Visualizar não exige identidade; cada ação crítica pede
// PIN just-in-time. A gestão (criar tarefas, equipe, escala) segue em
// /encarregado — a rota lá se protege por PIN + capability.

'use client';

import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';

import { AppShell, TopBar } from '@tauros/ui-primitives';

import { useSharedOperations } from '../../controllers/use-shared-operations.js';
import { appLink } from '../../navigation/links.js';
import { SharedOperationsScreen } from '../../ui/shared-operations-screen.js';
import { useAppContainer } from '../providers.js';

export default function OperacaoPage(): ReactElement {
  const container = useAppContainer();
  const router = useRouter();
  const [view, actions] = useSharedOperations(container);
  return (
    <AppShell
      skipLink={{ label: 'Ir para o conteúdo', targetId: 'conteudo' }}
      topBar={<TopBar title="Tauros OS" />}
    >
      <SharedOperationsScreen
        view={view}
        actions={actions}
        managementLink={appLink(router, '/encarregado')}
      />
    </AppShell>
  );
}
