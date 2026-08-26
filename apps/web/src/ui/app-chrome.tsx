// Chrome GLOBAL da aplicação (Frontend Experience V2) — sensação de produto
// único: as quatro rotas compartilham o MESMO shell, a MESMA navegação e o
// MESMO status de conexão, no MESMO lugar. Antes, cada page montava
// AppShell+TopBar próprios e navegava por botões ad-hoc nos cabeçalhos.
//
// Composição pura da API pública do DS (AppShell/TopBar/NavigationBar/
// NavigationItem) + adapter de rota da aplicação. Responsividade é do DS:
// a NavigationBar inferior só existe no mobile (o shell a oculta ≥tablet);
// a navegação do TopBar se oculta no mobile (useIsMobile — mesmo limiar).
// Navegar é LEITURA: nada aqui toca fila, auditoria ou autorização.

'use client';

import type { ReactElement, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import {
  AppShell,
  Badge,
  Button,
  NavigationBar,
  NavigationItem,
  TopBar,
} from '@tauros/ui-primitives';

import { useIsMobile } from '../controllers/use-is-mobile.js';
import { appLink } from '../navigation/links.js';

/** Destinos principais — apresentação das rotas existentes (nenhuma nova). */
export type AppArea = 'operacao' | 'turno' | 'gestao';

const AREAS: readonly { readonly key: AppArea; readonly label: string; readonly href: string }[] = [
  { key: 'operacao', label: 'Operação', href: '/operacao' },
  { key: 'turno', label: 'Turno', href: '/turno' },
  { key: 'gestao', label: 'Gestão', href: '/encarregado' },
];

export function AppChrome({
  current,
  connected,
  sidebar,
  children,
}: {
  /** Rota atual — marca aria-current na navegação (onde estou?). */
  readonly current: AppArea;
  /** Estado de conexão da tela — exibido UMA vez, sempre no mesmo lugar. */
  readonly connected: boolean;
  readonly sidebar?: ReactNode;
  readonly children: ReactNode;
}): ReactElement {
  const router = useRouter();
  const isMobile = useIsMobile();

  const connection = connected ? (
    <Badge status="success">Conectado</Badge>
  ) : (
    <Badge status="warn">Sem conexão</Badge>
  );

  return (
    <AppShell
      skipLink={{ label: 'Ir para o conteúdo', targetId: 'conteudo' }}
      topBar={
        <TopBar
          sticky
          title="Tauros OS"
          navigation={
            isMobile ? undefined : (
              <nav aria-label="Áreas do sistema" style={{ display: 'flex' }}>
                {AREAS.map((area) => (
                  <Button
                    key={area.key}
                    variant={current === area.key ? 'secondary' : 'ghost'}
                    aria-current={current === area.key ? 'page' : undefined}
                    onClick={() => {
                      if (current !== area.key) appLink(router, area.href).navigate?.();
                    }}
                  >
                    {area.label}
                  </Button>
                ))}
              </nav>
            )
          }
          trailing={connection}
        />
      }
      {...(sidebar !== undefined ? { sidebar } : {})}
      navigationBar={
        <NavigationBar>
          {AREAS.map((area) => (
            <NavigationItem
              key={area.key}
              label={area.label}
              current={current === area.key}
              link={appLink(router, area.href)}
            />
          ))}
        </NavigationBar>
      }
    >
      {children}
    </AppShell>
  );
}
