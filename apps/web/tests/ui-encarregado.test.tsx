// Testes de UI da Área do Encarregado — página real com container REAL em
// memória (fake só na fronteira do transporte). Texto acessível e
// comportamento, nunca classes. Cobrem acesso por PIN, capability, painel,
// filtros, criação (validações, dupla submissão, offline), a11y e segurança
// do PIN de desenvolvimento.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import EncarregadoPage from '../src/app/encarregado/page.js';
import TurnoPage from '../src/app/turno/page.js';
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

function app(route: 'encarregado' | 'turno' = 'encarregado'): ReactElement {
  return (
    <AppProviders container={world.container}>
      {route === 'encarregado' ? <EncarregadoPage /> : <TurnoPage />}
    </AppProviders>
  );
}

async function enterPin(pin: readonly string[]): Promise<void> {
  await screen.findByText('Digite seu PIN');
  const cells = screen.getAllByLabelText(/Dígito \d de 4/);
  pin.forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
}

async function identifyElber(): Promise<void> {
  await enterPin(['1', '2', '3', '4']);
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByRole('heading', { name: /Bom dia, Elber/ });
}

async function openCreateDrawer(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: '+ Nova tarefa' }));
  const dialog = await screen.findByRole('dialog');
  return dialog;
}

function fillCreateForm(
  dialog: HTMLElement,
  { title, position }: { title?: string; position?: string },
): void {
  if (title !== undefined) {
    fireEvent.change(within(dialog).getByLabelText('Título da tarefa'), {
      target: { value: title },
    });
  }
  if (position !== undefined) {
    const select = within(dialog).getByLabelText('Responsável');
    const option = [...select.querySelectorAll('option')].find((candidate) =>
      candidate.textContent?.includes(position),
    );
    fireEvent.change(select, { target: { value: option?.value ?? '' } });
  }
}

beforeEach(() => {
  world = makeWorld();
});

describe('acesso do encarregado', () => {
  it('mostra Elber e o campo de PIN; PIN correto abre o painel', async () => {
    const { container } = render(app());
    await screen.findByText('Digite seu PIN');
    expect(screen.getByText('Elber')).toBeTruthy();

    await identifyElber();
    expect(screen.getByText(/Equipe de hoje/)).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('PIN incorreto orienta sem revelar detalhes internos', async () => {
    render(app());
    await enterPin(['9', '9', '9', '9']);
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const alert = await screen.findByText(/Não foi possível confirmar a identificação/);
    expect(alert.textContent).not.toMatch(/401|snapshot|banco|senha/i);
    // continua na identificação
    expect(screen.queryByRole('heading', { name: /Bom dia/ })).toBeNull();
  });

  it('PIN vazio não habilita a entrada', async () => {
    render(app());
    await screen.findByText('Digite seu PIN');
    const button = screen.getByRole('button', { name: 'Entrar' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('operador SEM capability vindo do turno é barrado com a mensagem oficial', async () => {
    // Marina identifica-se no /turno e navega para /encarregado
    const { rerender } = render(app('turno'));
    await screen.findByRole('heading', { name: 'Abertura de turno' });
    const select = await screen.findByRole('combobox');
    const option = (screen.getByText('Marina Álvares') as HTMLOptionElement).value;
    fireEvent.change(select, { target: { value: option } });
    const cells = screen.getAllByLabelText(/Dígito \d de 4/);
    ['2', '4', '6', '8'].forEach((digit, index) => {
      fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar identificação' }));
    await screen.findByRole('button', { name: 'Abrir turno' });

    rerender(app('encarregado'));
    expect(
      await screen.findByText('Você não possui permissão para acessar esta área.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Nova tarefa' })).toBeNull();
  });
});

describe('painel do encarregado', () => {
  it('mostra resumo, tarefas da equipe com responsável e status', async () => {
    render(app());
    await identifyElber();
    expect(screen.getByText(/Pendentes: \d/)).toBeTruthy();
    // fixtures: 4 tarefas do dia, com posição — nomes visíveis
    expect((await screen.findAllByText(/Produção — Carlos Nunes/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/até \d{2}:\d{2}/).length).toBeGreaterThan(0);
  });

  it('filtra por situação', async () => {
    render(app());
    await identifyElber();
    await screen.findByRole('heading', { name: 'Registrar temperatura da câmara fria' });
    // 11:00 na loja: câmara fria (10:00) atrasada; demais pendentes
    fireEvent.click(screen.getByRole('radio', { name: 'Atrasadas' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Conferir reposição da vitrine' })).toBeNull();
    });
    expect(
      screen.getByRole('heading', { name: 'Registrar temperatura da câmara fria' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Concluídas' }));
    expect(await screen.findByText(/Nenhuma tarefa aqui/)).toBeTruthy();
  });

  it('filtra por funcionário (posição vigente)', async () => {
    render(app());
    await identifyElber();
    await screen.findByRole('heading', { name: 'Conferir reposição da vitrine' });
    fireEvent.change(screen.getByLabelText('Por funcionário'), {
      target: { value: 'pos-producao' },
    });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Conferir reposição da vitrine' })).toBeNull();
    });
    expect(screen.getByRole('heading', { name: 'Higienizar bancada de manipulação' })).toBeTruthy();
  });
});

describe('criação de tarefa', () => {
  it('cria tarefa válida e ela aparece imediatamente no quadro', async () => {
    render(app());
    await identifyElber();
    const dialog = await openCreateDrawer();
    fillCreateForm(dialog, { title: 'Organizar câmara fria', position: 'Produção' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }));

    await screen.findByRole('heading', { name: 'Organizar câmara fria' });
    expect(screen.getAllByText(/Produção — Carlos Nunes/).length).toBeGreaterThanOrEqual(2);
  });

  it('exige título', async () => {
    render(app());
    await identifyElber();
    const dialog = await openCreateDrawer();
    fillCreateForm(dialog, { position: 'Produção' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }));
    expect(await within(dialog).findByText('Dê um título para a tarefa.')).toBeTruthy();
  });

  it('exige responsável', async () => {
    render(app());
    await identifyElber();
    const dialog = await openCreateDrawer();
    fillCreateForm(dialog, { title: 'Sem responsável' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }));
    expect(await within(dialog).findByText('Escolha o responsável pela tarefa.')).toBeTruthy();
  });

  it('dupla submissão não duplica a tarefa', async () => {
    render(app());
    await identifyElber();
    const dialog = await openCreateDrawer();
    fillCreateForm(dialog, { title: 'Tarefa única', position: 'Apoio' });
    const button = within(dialog).getByRole('button', { name: 'Criar tarefa' });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'Tarefa única' });
    expect(screen.getAllByRole('heading', { name: 'Tarefa única' })).toHaveLength(1);
    expect(await world.container.templates.byStore('store-centro-0001')).toHaveLength(1);
  });

  it('OFFLINE: cria localmente, anuncia pendência e sincroniza ao reconectar', async () => {
    world.online = false;
    world.transport.available = false;
    render(app());
    await identifyElber();
    expect(screen.getByText(/Sem conexão com o servidor/)).toBeTruthy();

    const dialog = await openCreateDrawer();
    fillCreateForm(dialog, { title: 'Tarefa offline', position: 'Atendimento' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }));

    await screen.findByRole('heading', { name: 'Tarefa offline' });
    expect(screen.getByText('Aguardando sincronização')).toBeTruthy();
    const status = screen.getAllByRole('status').map((el) => el.textContent ?? '');
    expect(status.some((text) => text.includes('aguardando envio'))).toBe(true);

    world.online = true;
    world.transport.available = true;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar sincronizar agora' }));
    await waitFor(() => expect(screen.getByText('Confirmado pelo servidor')).toBeTruthy());
  });
});

describe('turno do encarregado (encarregado também é operador)', () => {
  it('ciclo completo: Abrir turno → Aberto → Fechar turno → Fechado (nunca as duas ações juntas)', async () => {
    render(app());
    await identifyElber();

    // sem sessão ativa: só a ação de abrir (progressive disclosure)
    await screen.findByText('Nenhum turno aberto agora.');
    expect(screen.getByRole('button', { name: 'Abrir turno' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fechar turno' })).toBeNull();
    expect(screen.queryByText(/Sem permissão para abrir turno/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno aberto em \d{4}-\d{2}-\d{2}/);
    await waitFor(() => expect(screen.getByText('Confirmado pelo servidor')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).toBeNull();
    expect(screen.queryByText(/Sem permissão para fechar turno/)).toBeNull();

    // fechamento exige confirmação explícita
    fireEvent.click(screen.getByRole('button', { name: 'Fechar turno' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar turno' }));

    await screen.findByText('Turno fechado. Nada foi perdido.');
    await waitFor(() => expect(screen.getByText('Confirmado pelo servidor.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fechar turno' })).toBeNull();
  });

  it('dupla submissão de abertura não duplica o turno', async () => {
    render(app());
    await identifyElber();
    const open = await screen.findByRole('button', { name: 'Abrir turno' });
    fireEvent.click(open);
    fireEvent.click(open);
    await screen.findByText(/Turno aberto em \d{4}-\d{2}-\d{2}/);
    await waitFor(() => expect(world.transport.submissions).toBe(1));
    expect(await world.container.queue.all()).toHaveLength(1);
  });

  it('OFFLINE: abre e fecha localmente; reconectar confirma pelo servidor', async () => {
    world.online = false;
    world.transport.available = false;
    render(app());
    await identifyElber();

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno aberto em \d{4}-\d{2}-\d{2}/);
    expect(screen.getByText('Aguardando sincronização')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar turno' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar turno' }));
    await screen.findByText('Turno fechado. Nada foi perdido.');
    expect(screen.getByText(/Fechado neste aparelho/)).toBeTruthy();

    world.online = true;
    world.transport.available = true;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar sincronizar agora' }));
    await waitFor(() => expect(screen.getByText('Confirmado pelo servidor.')).toBeTruthy());
  });

  it('reload restaura a sessão ativa após nova identificação', async () => {
    const first = render(app());
    await identifyElber();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno aberto em \d{4}-\d{2}-\d{2}/);
    first.unmount();

    // "reload": nova árvore sobre os MESMOS stores — identidade se refaz
    render(app());
    await identifyElber();
    await screen.findByText(/Turno aberto em \d{4}-\d{2}-\d{2}/);
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Fechar turno' })).toBeTruthy();
  });
});

describe('segurança do PIN de desenvolvimento', () => {
  it('o PIN não entra em fila, auditoria, storage nem localStorage', async () => {
    render(app());
    await identifyElber();
    const dialog = await openCreateDrawer();
    fillCreateForm(dialog, { title: 'Prova de segurança', position: 'Apoio' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }));
    await screen.findByRole('heading', { name: 'Prova de segurança' });

    const dump: unknown[] = [];
    for (const [schema, store] of [
      [OFFLINE_SCHEMA, world.offlineStore],
      [APP_STATE_SCHEMA, world.appStore],
    ] as const) {
      for (const name of schema.migrations.flatMap((m) => m.stores.map((s) => s.name))) {
        dump.push(...(await store.transaction([name], 'read', (tx) => tx.getAll(name))));
      }
    }
    const serialized = JSON.stringify(dump);
    expect(serialized.includes('1234')).toBe(false);
    expect(serialized.toLowerCase().includes('pin')).toBe(false);
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('1234');
  });
});
