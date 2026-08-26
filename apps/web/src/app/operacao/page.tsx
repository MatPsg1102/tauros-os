// Rota /operacao — OPERAÇÃO DE HOJE: quadro compartilhado da loja (tablet no
// chão de operação). Visualizar não exige identidade; cada ação crítica pede
// PIN just-in-time. A gestão (criar tarefas, equipe, escala) segue em
// /encarregado — a rota lá se protege por PIN + capability.

'use client';

import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';

import { useSharedOperations } from '../../controllers/use-shared-operations.js';
import { appLink } from '../../navigation/links.js';
import { AppChrome } from '../../ui/app-chrome.js';
import { OperationsSidebar } from '../../ui/operations-sidebar.js';
import { SharedOperationsScreen } from '../../ui/shared-operations-screen.js';
import { useAppContainer } from '../providers.js';

export default function OperacaoPage(): ReactElement {
  const container = useAppContainer();
  const router = useRouter();
  const [view, actions] = useSharedOperations(container);
  return (
    <AppChrome
      current="operacao"
      connected={view.readyToSync}
      // triagem persistente no tablet/desktop; some no mobile via CSS do DS
      // (o quadro oferece o Drawer "Filtros e equipe" nesse caso)
      {...(view.phase === 'ready'
        ? { sidebar: <OperationsSidebar view={view} actions={actions} /> }
        : {})}
    >
      <SharedOperationsScreen
        view={view}
        actions={actions}
        managementLink={appLink(router, '/encarregado')}
      />
    </AppChrome>
  );
}
