// Jornada vertical da Escala Operacional — página real com container REAL em
// memória (fake só na fronteira do transporte). Cobre: jornada ≠ equipe
// (mesma equipe, horários diferentes), novo horário editável reutilizável,
// aba Escala com presença planejada do dia e rotação dos próximos dias,
// offline→sincronização da jornada, a11y.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
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

// 13/08 com âncora 17/08 (dado da LOJA): rotação resolve 13=A, 14=B, 15=A…
const NOW = new Date('2026-08-13T14:00:00.000Z');

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

function app(): ReactElement {
  return (
    <AppProviders container={world.container}>
      <EncarregadoPage />
    </AppProviders>
  );
}

async function identifyElber(): Promise<void> {
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
  await screen.findByRole('heading', { name: /Bom dia, Elber/ });
}

async function registerMember(
  name: string,
  position: string,
  team: string,
  window: string,
): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: '+ Novo colaborador' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: name } });
  for (const [label, wanted] of [
    ['Função/posição', position],
    ['Equipe', team],
    ['Horário de trabalho', window],
  ] as const) {
    const select = within(dialog).getByLabelText(label);
    const option = [...select.querySelectorAll('option')].find((candidate) =>
      candidate.textContent?.includes(wanted),
    );
    fireEvent.change(select, { target: { value: option?.value ?? '' } });
  }
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar colaborador' }));
  await screen.findByRole('heading', { name });
}

beforeEach(() => {
  world = makeWorld();
  resetNavigations();
});

describe('jornada ≠ equipe (contrato central)', () => {
  it('dois colaboradores da MESMA equipe com horários DIFERENTES', async () => {
    render(app());
    await identifyElber();
    await registerMember('João da Silva', 'Açougueiro 1', 'Equipe A', '07:30–19:30');
    await registerMember('Paula Gomes', 'Operador de caixa', 'Equipe A', '08:30–20:30');

    expect(screen.getByText(/Açougueiro 1 · Equipe A · 07:30–19:30/)).toBeTruthy();
    expect(screen.getByText(/Operador de caixa · Equipe A · 08:30–20:30/)).toBeTruthy();

    // persistência oficial: jornada vive no VÍNCULO, referenciada por id
    const assignments = await world.container.workforce.assignments(FIXTURE_STORE.id);
    const definitions = await world.container.scheduleData.definitions(FIXTURE_STORE.id);
    const windows = assignments
      .map(
        (assignment) =>
          definitions.find((definition) => definition.id === assignment.shiftDefinitionId)
            ?.startTime,
      )
      .sort();
    expect(windows).toEqual(['07:30', '08:30']);
    // e a equipe é a MESMA nos dois vínculos
    expect(new Set(assignments.map((assignment) => assignment.teamId))).toEqual(
      new Set(['team-a']),
    );
  });
});

describe('novo horário editável (dado, não código)', () => {
  it('cria 06:00–18:00, reutiliza no cadastro e persiste no vínculo', async () => {
    render(app());
    await identifyElber();

    fireEvent.click(screen.getByRole('radio', { name: 'Escala' }));
    fireEvent.click(await screen.findByRole('button', { name: '+ Novo horário' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Nome (opcional)'), {
      target: { value: 'Turno abertura' },
    });
    fireEvent.change(within(drawer).getByLabelText('Hora início'), { target: { value: '06:00' } });
    fireEvent.change(within(drawer).getByLabelText('Hora fim'), { target: { value: '18:00' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar horário' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(await screen.findByText(/Turno abertura · 06:00–18:00/)).toBeTruthy();

    // reutilizável imediatamente no cadastro de colaborador
    fireEvent.click(screen.getByRole('radio', { name: 'Colaboradores' }));
    await registerMember('Carlos Prado', 'Auxiliar de açougue', 'Equipe B', '06:00–18:00');
    expect(screen.getByText(/Auxiliar de açougue · Equipe B · 06:00–18:00/)).toBeTruthy();

    // dupla criação da MESMA janela converge (chave natural congelada)
    fireEvent.click(screen.getByRole('radio', { name: 'Escala' }));
    fireEvent.click(await screen.findByRole('button', { name: '+ Novo horário' }));
    const again = await screen.findByRole('dialog');
    fireEvent.change(within(again).getByLabelText('Hora início'), { target: { value: '06:00' } });
    fireEvent.change(within(again).getByLabelText('Hora fim'), { target: { value: '18:00' } });
    fireEvent.click(within(again).getByRole('button', { name: 'Criar horário' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    const definitions = await world.container.scheduleData.definitions(FIXTURE_STORE.id);
    expect(definitions.filter((definition) => definition.startTime === '06:00')).toHaveLength(1);
  });
});

describe('aba Escala — presença planejada (fonte oficial)', () => {
  it('hoje mostra a equipe do dia com pessoas e horários; próximos dias alternam', async () => {
    render(app());
    await identifyElber();
    await registerMember('João da Silva', 'Açougueiro 1', 'Equipe A', '07:30–19:30');
    await registerMember('Paula Gomes', 'Operador de caixa', 'Equipe A', '08:30–20:30');
    await registerMember('Carlos Prado', 'Auxiliar de açougue', 'Equipe B', '07:30–19:30');

    fireEvent.click(screen.getByRole('radio', { name: 'Escala' }));
    // hoje (13/08, âncora 17/08 ⇒ Equipe A) — pessoas com jornadas PRÓPRIAS
    const today = (await screen.findByRole('heading', { name: 'Hoje — 13/08' })).closest(
      'div[class]',
    ) as HTMLElement;
    expect(within(today).getByText(/Equipe A · 12x36/)).toBeTruthy();
    expect(within(today).getByText(/João da Silva — Açougueiro 1 · 07:30–19:30/)).toBeTruthy();
    expect(within(today).getByText(/Paula Gomes — Operador de caixa · 08:30–20:30/)).toBeTruthy();
    // quem é da equipe de folga NÃO aparece hoje (planejado ≠ cadastro)
    expect(within(today).queryByText(/Carlos Prado/)).toBeNull();

    // próximos dias: rotação alterna as equipes (14=B, 15=A)
    const day14 = screen
      .getByRole('heading', { name: '14/08' })
      .closest('div[class]') as HTMLElement;
    expect(within(day14).getByText(/Equipe B/)).toBeTruthy();
    const day15 = screen
      .getByRole('heading', { name: '15/08' })
      .closest('div[class]') as HTMLElement;
    expect(within(day15).getByText(/Equipe A/)).toBeTruthy();
  });

  it('a11y da aba Escala sem violações', async () => {
    const { container } = render(app());
    await identifyElber();
    fireEvent.click(screen.getByRole('radio', { name: 'Escala' }));
    await screen.findByRole('heading', { name: 'Hoje — 13/08' });
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe('offline-first da jornada', () => {
  it('cria horário offline, sinaliza pendência e converge na reconexão', async () => {
    world.online = false;
    world.transport.available = false;
    const first = render(app());
    await identifyElber();

    fireEvent.click(screen.getByRole('radio', { name: 'Escala' }));
    fireEvent.click(await screen.findByRole('button', { name: '+ Novo horário' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Hora início'), { target: { value: '09:00' } });
    fireEvent.change(within(drawer).getByLabelText('Hora fim'), { target: { value: '21:00' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar horário' }));
    await screen.findByText(/09:00–21:00/);
    expect(screen.getByText('Aguardando sincronização')).toBeTruthy();

    const queued = await world.container.scheduleData.definitions(FIXTURE_STORE.id);
    expect(queued.find((definition) => definition.startTime === '09:00')?.syncStatus).toBe(
      'queued',
    );

    // conexão volta: a fila drena e o app reflete no reboot
    world.online = true;
    world.transport.available = true;
    await world.container.drainAndReflect();
    first.unmount();
    world = makeWorld(world);
    render(app());
    await identifyElber();
    fireEvent.click(screen.getByRole('radio', { name: 'Escala' }));
    await screen.findByText(/09:00–21:00/);
    expect(screen.queryByText('Aguardando sincronização')).toBeNull();

    const definitions = await world.container.scheduleData.definitions(FIXTURE_STORE.id);
    const created = definitions.filter((definition) => definition.startTime === '09:00');
    expect(created).toHaveLength(1);
    expect(created[0]?.syncStatus).toBe('synced');
  });
});
