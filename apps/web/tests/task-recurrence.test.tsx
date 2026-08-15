// Recorrência de Tarefas V1 — integração REAL: a materialização
// WHEN_SCHEDULED consulta o resolver oficial da Escala Operacional (via
// container default), nunca a antiga fixture "dia ímpar". Cobre: presença/
// ausência por rotação, prova anti-fixture (dia PAR materializa), troca de
// ocupante preservando a ocorrência, escala mudada não apaga ocorrência,
// atribuição situacional não altera o template e a ocorrência seguinte
// nasce novamente SEM responsável.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import EncarregadoPage from '../src/app/encarregado/page.js';
import { AppProviders } from '../src/app/providers.js';
import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FIXTURE_STORE } from '../src/wiring/fixtures.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { resetNavigations } from './setup-router.js';

// Âncora da loja: 17/08 ⇒ rotação 13/08=A, 14/08=B, 15/08=A (dado, não regra)
const DAY_13 = new Date('2026-08-13T14:00:00.000Z');
const DAY_14 = new Date('2026-08-14T14:00:00.000Z');
const DAY_15 = new Date('2026-08-15T14:00:00.000Z');

interface World {
  container: AppContainer;
  transport: FakeSessionSyncTransport;
  online: boolean;
  offlineStore: MemoryLocalStore;
  appStore: MemoryLocalStore;
  now: Date;
}

let world: World;

function makeWorld(
  now: Date,
  previous?: Pick<World, 'offlineStore' | 'appStore' | 'transport'>,
): World {
  const transport = previous?.transport ?? new FakeSessionSyncTransport();
  const offlineStore = previous?.offlineStore ?? new MemoryLocalStore(OFFLINE_SCHEMA);
  const appStore = previous?.appStore ?? new MemoryLocalStore(APP_STATE_SCHEMA);
  const w: World = {
    transport,
    online: true,
    offlineStore,
    appStore,
    now,
    container: undefined as unknown as AppContainer,
  };
  w.container = buildContainer({
    clock: () => w.now,
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

async function identifyElber(greeting = /Bom dia, Elber/): Promise<void> {
  await screen.findByText('Digite seu PIN');
  fireEvent.change(screen.getByRole('combobox'), {
    target: {
      value: (screen.getByRole('option', { name: 'Elber' }) as HTMLOptionElement).value,
    },
  });
  const cells = screen.getAllByLabelText(/Dígito \d de 6/);
  ['1', '2', '3', '4', '5', '6'].forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByRole('heading', { name: greeting });
}

async function registerMember(name: string, position: string, team: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: '+ Novo colaborador' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: name } });
  for (const [label, wanted] of [
    ['Função/posição', position],
    ['Equipe', team],
  ] as const) {
    const select = within(dialog).getByLabelText(label);
    const option = [...select.querySelectorAll('option')].find((candidate) =>
      candidate.textContent?.includes(wanted),
    );
    fireEvent.change(select, { target: { value: option?.value ?? '' } });
  }
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar colaborador' }));
  await screen.findByRole('heading', { name });
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
}

async function createWhenScheduledTask(title: string, position: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: '+ Nova tarefa' }));
  const drawer = await screen.findByRole('dialog');
  fireEvent.change(within(drawer).getByLabelText('Título da tarefa'), {
    target: { value: title },
  });
  const select = within(drawer).getByLabelText('Posição responsável');
  const option = [...select.querySelectorAll('option')].find((candidate) =>
    candidate.textContent?.includes(position),
  );
  fireEvent.change(select, { target: { value: option?.value ?? '' } });
  fireEvent.change(within(drawer).getByLabelText('Início'), { target: { value: '17:00' } });
  fireEvent.change(within(drawer).getByLabelText('Fim máximo'), { target: { value: '19:00' } });
  fireEvent.click(within(drawer).getByLabelText('Repetir'));
  fireEvent.click(within(drawer).getByRole('radio', { name: 'Quando estiver escalado' }));
  fireEvent.click(within(drawer).getByRole('button', { name: 'Criar tarefa' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
}

beforeEach(() => {
  resetNavigations();
});

describe('WHEN_SCHEDULED usa o resolver REAL da Escala Operacional', () => {
  it('materializa no dia escalado, não materializa no dia de folga, volta no seguinte', async () => {
    // 13/08 (Equipe A): João ocupa Açougueiro 1 e está escalado
    world = makeWorld(DAY_13);
    const stores = world;
    let view = render(app());
    await identifyElber();
    await registerMember('João da Silva', 'Açougueiro 1', 'Equipe A');
    await createWhenScheduledTask('Organizar balcão antes do fechamento', 'Açougueiro 1');
    await screen.findByRole('heading', { name: 'Organizar balcão antes do fechamento' });
    expect(screen.getAllByText(/17:00–19:00/).length).toBeGreaterThan(0);
    view.unmount();

    // 14/08 (Equipe B): a posição NÃO está escalada — nenhuma ocorrência nova
    world = makeWorld(DAY_14, stores);
    view = render(app());
    await identifyElber();
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Organizar balcão antes do fechamento' }),
      ).toBeNull();
    });
    const day14 = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-14');
    expect(day14.some((task) => task.template.title.includes('Organizar balcão'))).toBe(false);
    view.unmount();

    // 15/08 (Equipe A de novo): a ocorrência volta a nascer
    world = makeWorld(DAY_15, stores);
    render(app());
    await identifyElber();
    await screen.findByRole('heading', { name: 'Organizar balcão antes do fechamento' });
    const day15 = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-15');
    expect(day15.filter((task) => task.template.title.includes('Organizar balcão'))).toHaveLength(
      1,
    );
  });

  it('dia PAR materializa quando a equipe do dia cobre a posição — a antiga fixture (ímpar) NÃO é a fonte', async () => {
    // Carlos ocupa Auxiliar de açougue na Equipe B ⇒ escalado em 14/08 (PAR).
    // A FixtureShiftSchedule aposentada diria "não escalado" (dia par) — se
    // ela fosse a fonte, este teste falharia.
    world = makeWorld(DAY_13);
    const stores = world;
    const view = render(app());
    await identifyElber();
    await registerMember('Carlos Prado', 'Auxiliar de açougue', 'Equipe B');
    await createWhenScheduledTask('Higienizar câmara de resfriados', 'Auxiliar de açougue');
    // hoje (13/08) a Equipe B folga: a ocorrência NÃO nasce
    const day13 = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-13');
    expect(day13.some((task) => task.template.title.includes('Higienizar câmara'))).toBe(false);
    view.unmount();

    world = makeWorld(DAY_14, stores);
    render(app());
    await identifyElber();
    await screen.findByRole('heading', { name: 'Higienizar câmara de resfriados' });
  });

  it('trocar o OCUPANTE preserva a ocorrência (recorrência é da POSIÇÃO) e escala mudada não apaga', async () => {
    world = makeWorld(DAY_13);
    const stores = world;
    let view = render(app());
    await identifyElber();
    await registerMember('João da Silva', 'Açougueiro 1', 'Equipe A');
    await createWhenScheduledTask('Organizar balcão antes do fechamento', 'Açougueiro 1');
    await screen.findByRole('heading', { name: 'Organizar balcão antes do fechamento' });
    view.unmount();

    // troca de ocupante: encerra o vínculo de João e Rita assume a MESMA posição
    const assignments = await stores.container.workforce.assignments(FIXTURE_STORE.id);
    const joao = assignments.find((assignment) => assignment.validUntil === null);
    await stores.container.workforce.saveAssignment({
      ...joao!,
      validUntil: '2026-08-13',
    });
    world = makeWorld(DAY_13, stores);
    view = render(app());
    await identifyElber();
    await registerMember('Rita Nova', 'Açougueiro 1', 'Equipe A');
    // a ocorrência de hoje CONTINUA existindo e não duplica
    const today = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-13');
    expect(today.filter((task) => task.template.title.includes('Organizar balcão'))).toHaveLength(
      1,
    );
    view.unmount();

    // escala/ocupação mudam removendo TODOS da posição: ocorrência NÃO é apagada
    const after = await stores.container.workforce.assignments(FIXTURE_STORE.id);
    for (const assignment of after) {
      if (assignment.validUntil === null) {
        await stores.container.workforce.saveAssignment({
          ...assignment,
          validUntil: '2026-08-13',
        });
      }
    }
    world = makeWorld(DAY_13, stores);
    render(app());
    await identifyElber();
    await screen.findByRole('heading', { name: 'Organizar balcão antes do fechamento' });
    const preserved = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-13');
    expect(
      preserved.filter((task) => task.template.title.includes('Organizar balcão')),
    ).toHaveLength(1);
  });
});

describe('atribuição situacional não contamina o template', () => {
  it('ocorrência seguinte nasce novamente SEM responsável após atribuição', async () => {
    // 13/08: template "definir no dia" (todos os dias) + João escalado
    world = makeWorld(DAY_13);
    const stores = world;
    const view = render(app());
    await identifyElber();
    await registerMember('João da Silva', 'Açougueiro 1', 'Equipe A');
    fireEvent.click(screen.getByRole('button', { name: '+ Nova tarefa' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Título da tarefa'), {
      target: { value: 'Conferir estoque da ilha' },
    });
    fireEvent.click(within(drawer).getByRole('radio', { name: 'Definir no dia' }));
    fireEvent.click(within(drawer).getByLabelText('Repetir'));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Selecionar todos' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // atribui a ocorrência de HOJE a João (escalado)
    fireEvent.click(screen.getByRole('radio', { name: 'Sem responsável' }));
    const assign = (await screen.findByLabelText('Atribuir a')) as HTMLSelectElement;
    const joao = [...assign.querySelectorAll('option')].find((o) =>
      o.textContent?.includes('Açougueiro 1'),
    );
    fireEvent.change(assign, { target: { value: joao?.value ?? '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atribuir' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Conferir estoque da ilha' })).toBeNull();
    });
    // template segue SEM responsável fixo (atribuição não contamina a regra)
    const templates = await world.container.templates.byStore(FIXTURE_STORE.id);
    expect(templates[0]?.targetPositionId).toBeNull();
    view.unmount();

    // 14/08: a NOVA ocorrência nasce novamente sem responsável
    world = makeWorld(DAY_14, stores);
    render(app());
    await identifyElber();
    await screen.findByRole('heading', { name: 'Conferir estoque da ilha' });
    const day14 = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-14');
    const occurrence = day14.find((task) => task.template.title === 'Conferir estoque da ilha');
    expect(occurrence?.assignedPositionId).toBeNull();
    expect(occurrence?.template.targetPositionId).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Sem responsável' }));
    expect(await screen.findByRole('heading', { name: 'Conferir estoque da ilha' })).toBeTruthy();
  });
});
