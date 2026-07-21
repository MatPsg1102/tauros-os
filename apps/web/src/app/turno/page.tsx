// Rota /turno — jornada de abertura de turno (vertical slice 7.1).

'use client';

import type { ReactElement } from 'react';

import { AppShell, TopBar } from '@tauros/ui-primitives';

import { useShiftOpening } from '../../controllers/use-shift-opening.js';
import { ShiftOpeningScreen } from '../../ui/shift-opening-screen.js';
import { useAppContainer } from '../providers.js';

export default function TurnoPage(): ReactElement {
  const container = useAppContainer();
  const [view, actions] = useShiftOpening(container);
  return (
    <AppShell
      skipLink={{ label: 'Ir para o conteúdo', targetId: 'conteudo' }}
      topBar={<TopBar title="Tauros OS" />}
    >
      <ShiftOpeningScreen view={view} actions={actions} />
    </AppShell>
  );
}
