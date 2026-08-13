// Testes de UI da jornada (7.1 §37) — página real com container REAL em
// memória (fakes apenas na fronteira do transporte). Texto acessível e
// comportamento, nunca classes.

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import TurnoPage from '../src/app/turno/page.js';
import { AppProviders } from '../src/app/providers.js';
import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { navigations, resetNavigations } from './setup-router.js';

const NOW = new Date('2026-07-21T12:00:00.000Z');

interface World {
  container: AppContainer;
  transport: FakeSessionSyncTransport;
  online: boolean;
  offlineStore: MemoryLocalStore;
  appStore: MemoryLocalStore;
}

let world: World;

function makeWorld(): World {
  const offlineStore = new MemoryLocalStore(OFFLINE_SCHEMA);
  const appStore = new MemoryLocalStore(APP_STATE_SCHEMA);
  const transport = new FakeSessionSyncTransport();
  const w: World = {
    offlineStore,
    appStore,
    transport,
    online: true,
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

function page(): ReactElement {
  return (
    <AppProviders container={world.container}>
      <TurnoPage />
    </AppProviders>
  );
}

async function identifyAs(name: string, pin: readonly string[]): Promise<void> {
  await screen.findByRole('heading', { name: 'Abertura de turno' });
  const select = await screen.findByRole('combobox');
  const option = (screen.getByText(name) as HTMLOptionElement).value;
  fireEvent.change(select, { target: { value: option } });
  const cells = screen.getAllByLabelText(/Dígito \d de 4/);
  pin.forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar identificação' }));
}

beforeEach(() => {
  world = makeWorld();
  resetNavigations();
});

describe('jornada de abertura de turno', () => {
  it('boot → identificação → pronto → abertura ONLINE sincronizada', async () => {
    const { container } = render(page());
    await identifyAs('Marina Álvares', ['2', '4', '6', '8']);
    await screen.findByRole('button', { name: 'Abrir turno' });
    expect(screen.getByText(/Conectado/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir turno' }));
    await screen.findByRole('heading', { name: 'Turno aberto' });
    await waitFor(() => expect(screen.getByText('Turno sincronizado')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toContain('Turno aberto para Marina Álvares');
    expect(screen.getByText(/Confirmado pelo servidor/)).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('OFFLINE: abre localmente, mostra pendência; reconectar sincroniza', async () => {
    world.online = false;
    world.transport.available = false;
    render(page());
    await identifyAs('Marina Álvares', ['2', '4', '6', '8']);
    expect(await screen.findByText(/Sem conexão com o servidor/)).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByRole('heading', { name: 'Turno aberto' });
    expect(screen.getByText('Aguardando sincronização')).toBeTruthy();
    expect(screen.getByText(/Salvo neste aparelho/)).toBeTruthy();

    // reconexão + ação explícita de sincronizar
    world.online = true;
    world.transport.available = true;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar sincronizar agora' }));
    await waitFor(() => expect(screen.getByText('Turno sincronizado')).toBeTruthy());
  });

  it('duplo clique não duplica (uma submissão, um turno)', async () => {
    render(page());
    await identifyAs('Marina Álvares', ['2', '4', '6', '8']);
    const open = await screen.findByRole('button', { name: 'Abrir turno' });
    fireEvent.click(open);
    fireEvent.click(open);
    await screen.findByRole('heading', { name: 'Turno aberto' });
    await waitFor(() => expect(world.transport.submissions).toBe(1));
    expect(await world.container.queue.all()).toHaveLength(1);
  });

  it('SEM PERMISSÃO: estado seguro e orientativo, sem ação de abrir', async () => {
    render(page());
    await identifyAs('Carlos Nunes', ['1', '3', '5', '7']);
    await screen.findByText('Sem permissão para abrir turno');
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).toBeNull();
  });

  it('ENCARREGADO: entrada "Área do Encarregado" aparece pela DECISÃO do view model e navega', async () => {
    render(page());
    await identifyAs('Elber', ['1', '2', '3', '4']);
    // visível já na identificação, antes mesmo de abrir o turno
    const entry = await screen.findByRole('button', { name: 'Ir para a Área do Encarregado' });
    expect(screen.getByText('Gestão da equipe')).toBeTruthy();
    fireEvent.click(entry);
    expect(navigations()).toContain('/encarregado');

    // continua disponível com o turno aberto
    fireEvent.click(screen.getByRole('button', { name: 'Abrir turno' }));
    await screen.findByRole('heading', { name: 'Turno aberto' });
    expect(screen.getByRole('button', { name: 'Ir para a Área do Encarregado' })).toBeTruthy();

    // e permanece após o fechamento — a entrada independe do estado do turno
    fireEvent.click(screen.getByRole('button', { name: 'Fechar turno' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar turno' }));
    await screen.findByRole('heading', { name: 'Turno fechado' });
    expect(screen.getByRole('button', { name: 'Ir para a Área do Encarregado' })).toBeTruthy();
  });

  it('OPERADOR COMUM: sem config.write não vê a entrada da Área do Encarregado', async () => {
    render(page());
    await identifyAs('Marina Álvares', ['2', '4', '6', '8']);
    await screen.findByRole('button', { name: 'Abrir turno' });
    expect(screen.queryByRole('button', { name: 'Ir para a Área do Encarregado' })).toBeNull();
    expect(screen.queryByText('Gestão da equipe')).toBeNull();
  });

  it('SEM ABERTURA: negado para abrir também não ganha a entrada de gestão', async () => {
    render(page());
    await identifyAs('Carlos Nunes', ['1', '3', '5', '7']);
    await screen.findByText('Sem permissão para abrir turno');
    expect(screen.queryByRole('button', { name: 'Ir para a Área do Encarregado' })).toBeNull();
  });

  it('ENCARREGADO: Elber (session.open efetiva) abre o próprio turno na tela genérica', async () => {
    render(page());
    await identifyAs('Elber', ['1', '2', '3', '4']);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByRole('heading', { name: 'Turno aberto' });
    expect(screen.queryByText('Sem permissão para abrir turno')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Turno aberto para Elber');
    await waitFor(() => expect(world.transport.submissions).toBe(1));
    expect(await world.container.queue.all()).toHaveLength(1);
  });

  it('PIN incorreto: mensagem neutra (não revela existência) e PIN limpo', async () => {
    render(page());
    await identifyAs('Marina Álvares', ['9', '9', '9', '9']);
    await screen.findByText(/Não foi possível confirmar a identificação/);
    expect(screen.queryByText(/Marina/)).not.toBeNull(); // segue na identificação
    const cells = screen.getAllByLabelText(/Dígito \d de 4/) as HTMLInputElement[];
    for (const cell of cells) expect(cell.value).toBe('');
  });

  it('JÁ ABERTO: reload restaura o estado aberto após nova identificação', async () => {
    const first = render(page());
    await identifyAs('Marina Álvares', ['2', '4', '6', '8']);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByRole('heading', { name: 'Turno aberto' });
    first.unmount();

    // "reload": nova árvore sobre os MESMOS stores
    render(page());
    await identifyAs('Marina Álvares', ['2', '4', '6', '8']);
    await screen.findByRole('heading', { name: 'Turno aberto' });
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).toBeNull();
  });

  it('CONFLITO: outro aparelho abriu antes — estado persistente e claro', async () => {
    world.online = false;
    world.transport.available = false;
    world.transport.seedRemoteSession({
      storeId: 'store-centro-0001',
      actorEmployeeId: 'emp-0001',
      idempotencyKey: 'session-open:store-centro-0001:emp-0001:2026-07-21:device-B',
      sessionId: 'sess-device-B',
    });
    render(page());
    await identifyAs('Marina Álvares', ['2', '4', '6', '8']);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByRole('heading', { name: 'Turno aberto' });

    world.online = true;
    world.transport.available = true;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar sincronizar agora' }));
    await screen.findByText('Turno já aberto em outro aparelho');
    expect(screen.getByText(/nada foi perdido nem duplicado/)).toBeTruthy();
  });

  it('acessibilidade da identificação (axe) + um único main/skip link', async () => {
    const { container } = render(page());
    await screen.findByRole('button', { name: 'Confirmar identificação' });
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Ir para o conteúdo' })).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe('segurança da identificação (§8/§43)', () => {
  it('PIN não aparece em storage, fila ou auditoria', async () => {
    render(page());
    await identifyAs('Marina Álvares', ['2', '4', '6', '8']);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByRole('heading', { name: 'Turno aberto' });
    await act(async () => {
      const queue = JSON.stringify(await world.container.queue.all());
      const outbox = JSON.stringify(
        await world.offlineStore.transaction(['audit_outbox'], 'read', (tx) =>
          tx.getAll('audit_outbox'),
        ),
      );
      const sessions = JSON.stringify(
        await world.appStore.transaction(['operator_sessions'], 'read', (tx) =>
          tx.getAll('operator_sessions'),
        ),
      );
      for (const blob of [queue, outbox, sessions]) {
        expect(blob).not.toContain('2468');
        expect(blob).not.toMatch(/"pin"/i);
      }
    });
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});
