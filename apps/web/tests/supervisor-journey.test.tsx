// Teste VERTICAL da jornada completa do encarregado: PIN → abrir o próprio
// turno → criar tarefa atribuída a OUTRA posição/operador → tarefa visível no
// quadro da equipe → fechar turno. Atravessa UI → controller → application →
// domain → persistência local → auditoria → fila → transporte, com
// implementações REAIS internas (fake apenas na fronteira do transporte).
// Prova também que a autorização flui por permissões efetivas (ADR-018):
// o snapshot enfileirado carrega o perfil COMPLETO do encarregado.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  CAPABILITY_CONFIG_WRITE,
  CAPABILITY_SESSION_CLOSE,
  CAPABILITY_SESSION_OPEN,
} from '@tauros/contracts';
import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import EncarregadoPage from '../src/app/encarregado/page.js';
import { AppProviders } from '../src/app/providers.js';
import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 11:00 na loja — "Bom dia"

interface World {
  container: AppContainer;
  transport: FakeSessionSyncTransport;
  online: boolean;
  offlineStore: MemoryLocalStore;
  appStore: MemoryLocalStore;
}

let world: World;

function makeWorld(): World {
  const transport = new FakeSessionSyncTransport();
  const offlineStore = new MemoryLocalStore(OFFLINE_SCHEMA);
  const appStore = new MemoryLocalStore(APP_STATE_SCHEMA);
  const w: World = {
    transport,
    online: true,
    offlineStore,
    appStore,
    container: undefined as unknown as AppContainer,
  };
  w.container = buildContainer({
    clock: () => NOW,
    deviceId: 'device-A',
    offlineStore,
    appStore,
    transport,
    deviceOnline: () => w.online,
  });
  return w;
}

function app(): ReactElement {
  return (
    <AppProviders container={world.container}>
      <EncarregadoPage />
    </AppProviders>
  );
}

beforeEach(() => {
  world = makeWorld();
});

describe('jornada vertical do encarregado', () => {
  it('PIN → abrir turno → criar e atribuir tarefa → quadro da equipe → fechar turno', async () => {
    render(app());

    // 1) identificação por PIN (fixture dev — descartado após comparação)
    await screen.findByText('Digite seu PIN');
    // V2 glove-first: identificação por RadioGroup (alvos 64px), não Select
    fireEvent.click(screen.getByRole('radio', { name: 'Elber' }));
    const cells = screen.getAllByLabelText(/Dígito \d de 6/);
    ['1', '2', '3', '4', '5', '6'].forEach((digit, index) => {
      fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: /Bom dia, Elber/ });

    // 2) abre o PRÓPRIO turno pelo painel
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno aberto em \d{2}\/\d{2}/);

    // snapshot que atravessou a aplicação carrega o perfil COMPLETO —
    // autorização veio das permissões efetivas, não de nome/cargo
    const queuedOpen = (await world.container.queue.all()).find((item) =>
      item.idempotencyKey.startsWith('session-open:'),
    );
    expect(queuedOpen).toBeDefined();
    for (const capability of [
      CAPABILITY_SESSION_OPEN,
      CAPABILITY_SESSION_CLOSE,
      CAPABILITY_CONFIG_WRITE,
      'audit.read',
    ]) {
      expect(queuedOpen!.authorization.permissions).toContain(capability);
    }

    // 3) cria tarefa atribuída a OUTRA posição (Apoio — Rita Belmonte)
    fireEvent.click(screen.getByRole('button', { name: '+ Nova tarefa' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Título da tarefa'), {
      target: { value: 'Conferir estoque de embalagens' },
    });
    const responsavel = within(drawer).getByLabelText('Posição responsável') as HTMLSelectElement;
    const apoio = [...responsavel.querySelectorAll('option')].find((option) =>
      option.textContent?.includes('Apoio'),
    );
    fireEvent.change(responsavel, { target: { value: apoio?.value ?? '' } });
    fireEvent.change(within(drawer).getByLabelText('Início'), { target: { value: '14:00' } });
    fireEvent.change(within(drawer).getByLabelText('Fim máximo'), { target: { value: '15:30' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar tarefa' }));

    // 4) tarefa aparece imediatamente no quadro da equipe, com responsável e horário
    await screen.findByRole('heading', { name: 'Conferir estoque de embalagens' });
    expect(screen.getAllByText(/Apoio — Rita Belmonte/).length).toBeGreaterThan(0);
    // V2: janela vira legenda "14:00 →" + hora âncora "15:30" (nós próprios)
    expect(screen.getAllByText('14:00 →').length).toBeGreaterThan(0);
    expect(screen.getAllByText('15:30').length).toBeGreaterThan(0);

    // persistência real (repositório local) + domínio validado
    const templates = await world.container.templates.byStore('store-centro-0001');
    expect(templates).toHaveLength(1);
    expect(templates[0]?.targetPositionId).toBe('pos-apoio');
    expect(templates[0]?.title).toBe('Conferir estoque de embalagens');

    // 5) fecha o turno com confirmação explícita
    fireEvent.click(screen.getByRole('button', { name: 'Fechar turno' }));
    const confirm = await screen.findByRole('dialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Fechar turno' }));
    await screen.findByText('Turno fechado. Nada foi perdido.');
    await waitFor(() => expect(screen.getByText('Confirmado pelo servidor.')).toBeTruthy());

    // 6) a fila oficial carregou as TRÊS operações da jornada (ator original)
    const keys = (await world.container.queue.all()).map((item) => item.idempotencyKey);
    expect(keys.some((key) => key.startsWith('session-open:'))).toBe(true);
    expect(keys.some((key) => key.startsWith('task-template-create:'))).toBe(true);
    expect(keys.some((key) => key.startsWith('session-close:'))).toBe(true);
    for (const item of await world.container.queue.all()) {
      expect(item.authorization.operatorEmployeeId).toBe('emp-0004');
    }

    // 7) auditoria de negócio no outbox durável
    const outbox = JSON.stringify(
      await world.offlineStore.transaction(['audit_outbox'], 'read', (tx) =>
        tx.getAll('audit_outbox'),
      ),
    );
    expect(outbox).toContain('auth.login.success');
    expect(outbox).toContain('config.changed');
  });
});
