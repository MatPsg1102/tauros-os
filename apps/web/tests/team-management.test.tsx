// Jornada vertical da Gestão de Equipe — página real com container REAL em
// memória (fake só na fronteira do transporte). Cobre capability, cadastro de
// colaborador (posição + Equipe A/B como conceitos separados), dupla
// submissão, reload, offline→sincronização, nova posição refletindo nos
// seletores de tarefa, composição por equipe, a11y e segurança do PIN.

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
import { FIXTURE_STORE } from '../src/wiring/fixtures.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { resetNavigations } from './setup-router.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 11:00 na loja — "Bom dia"

interface World {
  container: AppContainer;
  transport: FakeSessionSyncTransport;
  online: boolean;
  offlineStore: MemoryLocalStore;
  appStore: MemoryLocalStore;
}

let world: World;

function makeWorld(previous?: Pick<World, 'offlineStore' | 'appStore' | 'transport'>): World {
  const transport = previous?.transport ?? new FakeSessionSyncTransport();
  const offlineStore = previous?.offlineStore ?? new MemoryLocalStore(OFFLINE_SCHEMA);
  const appStore = previous?.appStore ?? new MemoryLocalStore(APP_STATE_SCHEMA);
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

async function identifyElber(): Promise<void> {
  await screen.findByText('Digite seu PIN');
  // V2 glove-first: identificação por RadioGroup (alvos 64px), não Select
  fireEvent.click(screen.getByRole('radio', { name: 'Elber' }));
  const cells = screen.getAllByLabelText(/Dígito \d de 6/);
  ['1', '2', '3', '4', '5', '6'].forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByRole('heading', { name: /Bom dia, Elber/ });
}

async function openRegisterDrawer(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: '+ Novo colaborador' }));
  return await screen.findByRole('dialog');
}

function fillRegisterForm(
  dialog: HTMLElement,
  {
    name,
    startDate,
    position,
    team,
  }: { name?: string; startDate?: string; position?: string; team?: string },
): void {
  if (name !== undefined) {
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: name } });
  }
  if (startDate !== undefined) {
    fireEvent.change(within(dialog).getByLabelText('Data de início'), {
      target: { value: startDate },
    });
  }
  if (position !== undefined) {
    const select = within(dialog).getByLabelText('Função/posição');
    const option = [...select.querySelectorAll('option')].find((candidate) =>
      candidate.textContent?.includes(position),
    );
    fireEvent.change(select, { target: { value: option?.value ?? '' } });
  }
  if (team !== undefined) {
    const select = within(dialog).getByLabelText('Equipe');
    const option = [...select.querySelectorAll('option')].find((candidate) =>
      candidate.textContent?.includes(team),
    );
    fireEvent.change(select, { target: { value: option?.value ?? '' } });
  }
}

async function registerJoao(): Promise<void> {
  const dialog = await openRegisterDrawer();
  fillRegisterForm(dialog, {
    name: 'João da Silva',
    startDate: '2026-08-17',
    position: 'Açougueiro 1',
    team: 'Equipe A',
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar colaborador' }));
  await screen.findByRole('heading', { name: 'João da Silva' });
}

beforeEach(() => {
  world = makeWorld();
  resetNavigations();
});

describe('acesso à Gestão de Equipe (capability)', () => {
  it('encarregado autorizado vê a seção com abas, catálogo inicial e a11y limpa', async () => {
    const { container } = render(app());
    await identifyElber();

    expect(screen.getByRole('heading', { name: 'Equipe' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Novo colaborador' })).toBeTruthy();

    // o time DEMO do piloto já vem como cadastro real (ensureDemoWorkforce):
    // a mesma pessoa que os cards da operação nomeiam é gerível aqui
    for (const name of ['Marina Álvares', 'Carlos Nunes', 'Rita Belmonte']) {
      expect(await screen.findByRole('heading', { name })).toBeTruthy();
    }

    // catálogo inicial: posições reais da operação + posições demo na aba
    fireEvent.click(screen.getByRole('radio', { name: 'Posições' }));
    for (const name of [
      'Açougueiro 1',
      'Açougueiro 2',
      'Açougueiro 3',
      'Auxiliar de açougue',
      'Operador de caixa',
      'Faxineira',
      'Atendimento',
      'Produção',
      'Apoio',
    ]) {
      expect(await screen.findByRole('heading', { name })).toBeTruthy();
    }

    expect((await axe(container)).violations).toEqual([]);
  });

  it('operador sem workforce.write não recebe nenhuma ação de gestão', async () => {
    // Marina identifica-se no /turno (session.open, SEM gestão de equipe)
    const { rerender } = render(app('turno'));
    await screen.findByRole('heading', { name: 'Abertura de turno' });
    const select = await screen.findByRole('combobox');
    const option = (screen.getByText('Marina Álvares') as HTMLOptionElement).value;
    fireEvent.change(select, { target: { value: option } });
    const cells = screen.getAllByLabelText(/Dígito \d de 6/);
    ['2', '2', '4', '4', '6', '6'].forEach((digit, index) => {
      fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar identificação' }));
    await screen.findByRole('button', { name: 'Abrir turno' });

    rerender(app('encarregado'));
    // sem config.write o painel nega o acesso — e NADA de gestão aparece
    await screen.findByText('Acesso restrito');
    expect(screen.queryByRole('heading', { name: 'Equipe' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Novo colaborador' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Nova posição' })).toBeNull();
  });
});

describe('cadastro de colaborador', () => {
  it('cadastra João com posição e Equipe A separadas e confirma pelo servidor', async () => {
    render(app());
    await identifyElber();
    await registerJoao();

    // lista operacional: posição + equipe + jornada como CONCEITOS separados
    expect(screen.getByText(/Açougueiro 1 · Equipe A/)).toBeTruthy();
    expect(screen.getByText('Ativo desde 17/08/2026')).toBeTruthy();
    // João confirma pelo servidor ALÉM do time demo (3 seeds já 'synced')
    await waitFor(() => {
      expect(screen.getAllByText('Confirmado pelo servidor').length).toBeGreaterThanOrEqual(4);
    });

    // persistência oficial: vínculo referencia posição e equipe por ID
    const employees = await world.container.workforce.employees(FIXTURE_STORE.id);
    const assignments = await world.container.workforce.assignments(FIXTURE_STORE.id);
    expect(employees).toHaveLength(4); // João + time demo semeado
    const joao = employees.find((employee) => employee.fullName === 'João da Silva');
    expect(joao).toMatchObject({ active: true, syncStatus: 'synced' });
    expect(assignments).toHaveLength(4);
    expect(assignments.find((assignment) => assignment.employeeId === joao?.id)).toMatchObject({
      operationalPositionId: 'pos-acougueiro-1',
      teamId: 'team-a',
      validFrom: '2026-08-17',
      validUntil: null,
    });
    // a posição NUNCA embute a equipe no nome
    const positions = await world.container.workforce.positions(FIXTURE_STORE.id);
    expect(positions.find((p) => p.id === 'pos-acougueiro-1')?.name).toBe('Açougueiro 1');
  });

  it('valida nome e referências obrigatórias sem fechar o drawer', async () => {
    render(app());
    await identifyElber();
    const dialog = await openRegisterDrawer();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar colaborador' }));
    await within(dialog).findByText('Escolha a função/posição.');

    fillRegisterForm(dialog, { position: 'Açougueiro 2', team: 'Equipe B' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar colaborador' }));
    await within(dialog).findByText('Informe o nome do colaborador.');

    fillRegisterForm(dialog, { name: '   ' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar colaborador' }));
    await within(dialog).findByText('Informe o nome do colaborador.');
  });

  it('dupla submissão não duplica o colaborador (idempotência)', async () => {
    render(app());
    await identifyElber();
    const dialog = await openRegisterDrawer();
    fillRegisterForm(dialog, {
      name: 'João da Silva',
      startDate: '2026-08-17',
      position: 'Açougueiro 1',
      team: 'Equipe A',
    });
    const button = within(dialog).getByRole('button', { name: 'Cadastrar colaborador' });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'João da Silva' });

    await waitFor(async () => {
      const employees = await world.container.workforce.employees(FIXTURE_STORE.id);
      expect(employees.filter((e) => e.fullName === 'João da Silva')).toHaveLength(1);
    });
    expect(screen.getAllByRole('heading', { name: 'João da Silva' })).toHaveLength(1);
  });

  it('reload do aparelho preserva o cadastro (MESMO banco local)', async () => {
    const first = render(app());
    await identifyElber();
    await registerJoao();
    first.unmount();

    // "reabrir o app": novo container sobre os MESMOS stores persistidos
    world = makeWorld(world);
    render(app());
    await identifyElber();
    expect(await screen.findByRole('heading', { name: 'João da Silva' })).toBeTruthy();
    expect(screen.getByText(/Açougueiro 1 · Equipe A/)).toBeTruthy();
  });
});

describe('offline-first', () => {
  it('offline cadastra localmente, sinaliza pendência e converge na reconexão', async () => {
    world.online = false;
    world.transport.available = false;
    const first = render(app());
    await identifyElber();
    await registerJoao();

    // não mente "sucesso": o estado é explícito sobre a pendência (o time
    // demo semeado não passa pela fila — só o João aguarda o servidor)
    await screen.findByText('Salvo neste aparelho — aguardando sincronização');
    const queued = await world.container.workforce.employees(FIXTURE_STORE.id);
    expect(queued.find((e) => e.fullName === 'João da Silva')?.syncStatus).toBe('queued');

    // conexão volta: a fila drena (motor de sync) e o app reflete no reboot
    world.online = true;
    world.transport.available = true;
    await world.container.drainAndReflect();
    first.unmount();
    world = makeWorld(world);
    render(app());
    await identifyElber();
    await waitFor(() => {
      expect(screen.getAllByText('Confirmado pelo servidor').length).toBeGreaterThanOrEqual(4);
    });

    const employees = await world.container.workforce.employees(FIXTURE_STORE.id);
    expect(employees).toHaveLength(4);
    expect(employees.find((e) => e.fullName === 'João da Silva')?.syncStatus).toBe('synced');
    expect(world.transport.submissions).toBeGreaterThan(0);
  });
});

describe('posições e integração com tarefas', () => {
  it('nova posição fica disponível na aba, no cadastro de colaborador e na nova tarefa', async () => {
    render(app());
    await identifyElber();

    fireEvent.click(screen.getByRole('radio', { name: 'Posições' }));
    fireEvent.click(await screen.findByRole('button', { name: '+ Nova posição' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Nome da posição'), {
      target: { value: 'Balconista de Frios' },
    });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar posição' }));
    expect(await screen.findByRole('heading', { name: 'Balconista de Frios' })).toBeTruthy();

    // disponível no cadastro de colaborador
    fireEvent.click(screen.getByRole('radio', { name: 'Colaboradores' }));
    const registerDialog = await openRegisterDrawer();
    const positionSelect = within(registerDialog).getByLabelText('Função/posição');
    expect(
      [...positionSelect.querySelectorAll('option')].some((option) =>
        option.textContent?.includes('Balconista de Frios'),
      ),
    ).toBe(true);
    fireEvent.keyDown(registerDialog, { key: 'Escape' });

    // disponível no seletor da NOVA TAREFA (diretório composto — mesma loja)
    fireEvent.click(screen.getByRole('button', { name: '+ Nova tarefa' }));
    const taskDialog = await screen.findByRole('dialog');
    const taskSelect = within(taskDialog).getByLabelText('Posição responsável');
    expect(
      [...taskSelect.querySelectorAll('option')].some((option) =>
        option.textContent?.includes('Balconista de Frios'),
      ),
    ).toBe(true);
  });

  it('nome de posição repetido converge sem duplicar (unique congelado)', async () => {
    render(app());
    await identifyElber();
    fireEvent.click(screen.getByRole('radio', { name: 'Posições' }));
    fireEvent.click(await screen.findByRole('button', { name: '+ Nova posição' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Nome da posição'), {
      target: { value: 'Açougueiro 1' },
    });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar posição' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    const positions = await world.container.workforce.positions(FIXTURE_STORE.id);
    expect(positions.filter((position) => position.name === 'Açougueiro 1')).toHaveLength(1);
  });
});

describe('composição das equipes', () => {
  it('colaborador cadastrado aparece na equipe correta e as equipes seguem separadas', async () => {
    render(app());
    await identifyElber();
    await registerJoao();

    fireEvent.click(screen.getByRole('radio', { name: 'Equipes' }));
    const teamA = (await screen.findByRole('heading', { name: 'Equipe A' })).closest(
      'div[class]',
    ) as HTMLElement;
    expect(within(teamA).getByText(/João da Silva — Açougueiro 1/)).toBeTruthy();
    expect(within(teamA).getByText(/Marina Álvares — Atendimento/)).toBeTruthy();

    // Equipe B tem o Carlos do time demo — e NUNCA os membros da A
    const teamB = screen
      .getByRole('heading', { name: 'Equipe B' })
      .closest('div[class]') as HTMLElement;
    expect(within(teamB).getByText(/Carlos Nunes — Produção/)).toBeTruthy();
    expect(within(teamB).queryByText(/João da Silva/)).toBeNull();

    // filtro por equipe na lista de colaboradores
    fireEvent.click(screen.getByRole('radio', { name: 'Colaboradores' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Equipe B' }));
    expect(screen.queryByRole('heading', { name: 'João da Silva' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Carlos Nunes' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Equipe A' }));
    expect(await screen.findByRole('heading', { name: 'João da Silva' })).toBeTruthy();
  });
});

describe('segurança do PIN de desenvolvimento', () => {
  it('o PIN não entra em fila, auditoria nem storage após a jornada completa', async () => {
    render(app());
    await identifyElber();
    await registerJoao();

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
    expect(serialized.includes('"1234"')).toBe(false);
    expect(serialized.toLowerCase().includes('pin')).toBe(false);
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('123456');
  });
});
