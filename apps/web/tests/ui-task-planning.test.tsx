// Testes de UI do PLANEJAMENTO de tarefas (recorrência, sem responsável,
// atribuição situacional) e a REGRESSÃO CRÍTICA do foco no drawer: digitar não
// pode roubar o foco do campo de título (bug do Dialog corrigido na raiz).

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import EncarregadoPage from '../src/app/encarregado/page.js';
import { AppProviders } from '../src/app/providers.js';
import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 11:00 na loja

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

async function identifyElber(): Promise<void> {
  await screen.findByText('Digite seu PIN');
  const cells = screen.getAllByLabelText(/Dígito \d de 4/);
  ['1', '2', '3', '4'].forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByRole('heading', { name: /Bom dia, Elber/ });
}

async function openDrawer(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: '+ Nova tarefa' }));
  return screen.findByRole('dialog');
}

beforeEach(() => {
  world = makeWorld();
});

describe('regressão do foco no drawer (bug crítico)', () => {
  it('digitar a frase inteira mantém o foco no título e não vai para o X', async () => {
    const user = userEvent.setup();
    render(app());
    await identifyElber();
    const drawer = await openDrawer();

    const titleInput = within(drawer).getByLabelText('Título da tarefa') as HTMLInputElement;
    titleInput.focus();
    const frase = 'Organizar balcão antes do fechamento';
    await user.type(titleInput, frase);

    expect(titleInput.value).toBe(frase);
    expect(document.activeElement).toBe(titleInput);
    // o Drawer NÃO remonta: o campo de título é o MESMO nó
    expect(within(drawer).getByLabelText('Título da tarefa')).toBe(titleInput);
    // o X não recebeu o foco
    expect(document.activeElement).not.toBe(within(drawer).getByRole('button', { name: 'Fechar' }));
  });

  it('Backspace, seleção e alterar responsável/recorrência não destroem o título', async () => {
    const user = userEvent.setup();
    render(app());
    await identifyElber();
    const drawer = await openDrawer();
    const titleInput = within(drawer).getByLabelText('Título da tarefa') as HTMLInputElement;

    await user.type(titleInput, 'Tarefa X!');
    await user.type(titleInput, '{Backspace}');
    expect(titleInput.value).toBe('Tarefa X');

    // trocar responsável não apaga o título nem remove o foco possível de digitar
    fireEvent.click(within(drawer).getByRole('radio', { name: 'Definir no dia' }));
    expect((within(drawer).getByLabelText('Título da tarefa') as HTMLInputElement).value).toBe(
      'Tarefa X',
    );

    // ativar recorrência e escolher dias não desmonta o input nem apaga dados
    fireEvent.click(within(drawer).getByRole('switch', { name: 'Repetir' }));
    fireEvent.click(within(drawer).getByRole('checkbox', { name: 'Qua' }));
    const stillThere = within(drawer).getByLabelText('Título da tarefa') as HTMLInputElement;
    expect(stillThere.value).toBe('Tarefa X');
    await user.type(stillThere, 'Y');
    expect((within(drawer).getByLabelText('Título da tarefa') as HTMLInputElement).value).toBe(
      'Tarefa XY',
    );
  });
});

describe('recorrência — progressive disclosure', () => {
  it('sem "Repetir" não mostra opções de recorrência; ligar revela dias da semana', async () => {
    render(app());
    await identifyElber();
    const drawer = await openDrawer();

    expect(within(drawer).queryByRole('radio', { name: 'Dias da semana' })).toBeNull();
    fireEvent.click(within(drawer).getByRole('switch', { name: 'Repetir' }));
    expect(await within(drawer).findByRole('radio', { name: 'Dias da semana' })).toBeTruthy();
    // seleção de dias visível
    expect(await within(drawer).findByRole('button', { name: 'Selecionar todos' })).toBeTruthy();
    expect(within(drawer).getByRole('checkbox', { name: 'Seg' })).toBeTruthy();
  });

  it('"Definir no dia" torna "Quando estiver escalado" indisponível', async () => {
    render(app());
    await identifyElber();
    const drawer = await openDrawer();

    fireEvent.click(within(drawer).getByRole('switch', { name: 'Repetir' }));
    // por padrão (Definir agora) a opção escalado está habilitada
    expect(
      (within(drawer).getByRole('radio', { name: 'Quando estiver escalado' }) as HTMLInputElement)
        .disabled,
    ).toBe(false);
    // ao "Definir no dia" ela fica desabilitada (sem posição não há como perguntar à escala)
    fireEvent.click(within(drawer).getByRole('radio', { name: 'Definir no dia' }));
    expect(
      (within(drawer).getByRole('radio', { name: 'Quando estiver escalado' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });
});

describe('fila do encarregado — sem responsável e atribuição situacional', () => {
  async function createUnassigned(title: string): Promise<void> {
    const drawer = await openDrawer();
    fireEvent.change(within(drawer).getByLabelText('Título da tarefa'), {
      target: { value: title },
    });
    fireEvent.click(within(drawer).getByRole('radio', { name: 'Definir no dia' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar tarefa' }));
    await screen.findByRole('heading', { name: title });
  }

  it('filtra por "Sem responsável" e atribui a ocorrência a uma posição', async () => {
    render(app());
    await identifyElber();
    await createUnassigned('Conferir estoque da ilha');

    // filtro "Sem responsável" mantém a tarefa e esconde as que têm responsável
    fireEvent.click(screen.getByRole('radio', { name: 'Sem responsável' }));
    expect(screen.getByRole('heading', { name: 'Conferir estoque da ilha' })).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Registrar temperatura da câmara fria' }),
      ).toBeNull();
    });

    // atribui a ocorrência de hoje a Atendimento
    const assign = screen.getByLabelText('Atribuir a') as HTMLSelectElement;
    const atendimento = [...assign.querySelectorAll('option')].find((o) =>
      o.textContent?.includes('Atendimento'),
    );
    fireEvent.change(assign, { target: { value: atendimento?.value ?? '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atribuir' }));

    // deixa de estar "sem responsável" — some do filtro atual
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Conferir estoque da ilha' })).toBeNull();
    });
    // e aparece com o responsável ao ver "Todas"
    fireEvent.click(screen.getByRole('radio', { name: 'Todas' }));
    await screen.findByRole('heading', { name: 'Conferir estoque da ilha' });
    expect(screen.getAllByText(/Atendimento — Marina Álvares/).length).toBeGreaterThan(0);
  });
});
