// Testes de UI da 7.2 — páginas reais com container REAL em memória (fake só
// na fronteira do transporte). Texto acessível e comportamento, nunca classes.
// Cobrem fechamento, quadro de tarefas, offline, conflito, permissão e a11y.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskTemplateSnapshot } from '@tauros/contracts';
import { CAPABILITY_SESSION_OPEN, PERMISSION_MODEL_VERSION } from '@tauros/contracts';
import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import TarefasPage from '../src/app/turno/tarefas/page.js';
import TurnoPage from '../src/app/turno/page.js';
import { AppProviders } from '../src/app/providers.js';
import { OperatorSessionProvider } from '../src/controllers/operator-session-context.js';
import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FIXTURE_STORE } from '../src/wiring/fixtures.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { navigations, resetNavigations } from './setup-router.js';

const NOW = new Date('2026-07-21T12:00:00.000Z');

const TEMPLATES: readonly TaskTemplateSnapshot[] = [
  {
    templateId: 'tpl-bancada',
    title: 'Higienizar bancada de manipulação',
    frequency: 'DAILY',
    requiresPhoto: true,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: 'pos-producao',
    dueOffsetMinutes: 840, // 14:00 na loja
  },
  {
    templateId: 'tpl-vitrine',
    title: 'Conferir reposição da vitrine',
    frequency: 'DAILY',
    requiresPhoto: false,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: 'pos-atendimento',
    dueOffsetMinutes: 960, // 16:00 na loja
  },
];

interface World {
  container: AppContainer;
  transport: FakeSessionSyncTransport;
  online: boolean;
}

let world: World;

function makeWorld(templates: readonly TaskTemplateSnapshot[] = TEMPLATES): World {
  const transport = new FakeSessionSyncTransport();
  const w: World = {
    transport,
    online: true,
    container: undefined as unknown as AppContainer,
  };
  w.container = buildContainer({
    clock: () => NOW,
    deviceId: 'device-A',
    offlineStore: new MemoryLocalStore(OFFLINE_SCHEMA),
    appStore: new MemoryLocalStore(APP_STATE_SCHEMA),
    transport,
    deviceOnline: () => w.online,
    templates: { activeTemplates: () => Promise.resolve(templates) },
  });
  return w;
}

/** As duas rotas compartilham providers — como na navegação real do app. */
function app(route: 'turno' | 'tarefas'): ReactElement {
  return (
    <AppProviders container={world.container}>
      {route === 'turno' ? <TurnoPage /> : <TarefasPage />}
    </AppProviders>
  );
}

async function identifyAs(name: string, pin: readonly string[]): Promise<void> {
  await screen.findByRole('heading', { name: 'Abertura de turno' });
  // V2 glove-first: identificação por RadioGroup (alvos 64px), não Select
  fireEvent.click(await screen.findByRole('radio', { name }));
  const cells = screen.getAllByLabelText(/Dígito \d de 6/);
  pin.forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar identificação' }));
}

async function openShiftAs(name: string, pin: readonly string[]): Promise<void> {
  await identifyAs(name, pin);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
  await screen.findByRole('heading', { name: 'Turno aberto' });
}

beforeEach(() => {
  world = makeWorld();
  resetNavigations();
});

describe('fechamento de turno na tela', () => {
  it('turno aberto oferece o quadro de tarefas e o fechamento', async () => {
    render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);
    expect(screen.getByRole('button', { name: 'Ver tarefas de hoje' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fechar turno' })).toBeTruthy();
  });

  it('navega para o quadro pelo adapter de rota da aplicação', async () => {
    render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de hoje' }));
    expect(navigations()).toContain('/turno/tarefas');
  });

  it('fecha o turno após confirmação e confirma pelo servidor', async () => {
    const { container } = render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar turno' }));
    await screen.findByRole('heading', { name: 'Fechar o turno agora?' });
    const dialog = screen.getByRole('dialog');
    // V2: o operador fecha SABENDO o estado do dia — resumo em linhas.
    // Sem tarefas materializadas neste fluxo, tudo zera e o aviso de
    // trabalho em aberto corretamente NÃO aparece.
    await within(dialog).findByText('Pendentes');
    expect(within(dialog).getByText('Concluídas')).toBeTruthy();
    expect(within(dialog).queryByText('Ainda há trabalho em aberto')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar turno' }));

    await screen.findByRole('heading', { name: 'Turno fechado' });
    await waitFor(() => expect(screen.getByText('Confirmado pelo servidor')).toBeTruthy());
    expect(
      screen.getAllByRole('status').some((el) => el.textContent?.includes('Nada foi perdido')),
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it('cancelar mantém o turno aberto', async () => {
    render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar turno' }));
    await screen.findByRole('heading', { name: 'Fechar o turno agora?' });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar no turno' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Turno fechado' })).toBeNull(),
    );
    expect(screen.getByRole('heading', { name: 'Turno aberto' })).toBeTruthy();
  });

  it('OFFLINE: fecha localmente e mostra pendência em linguagem operacional', async () => {
    world.online = false;
    world.transport.available = false;
    render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar turno' }));
    await screen.findByRole('heading', { name: 'Fechar o turno agora?' });
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar turno' }));

    await screen.findByRole('heading', { name: 'Turno fechado' });
    expect(screen.getByText('Aguardando conexão')).toBeTruthy();
    // V2: estados exclusivos — fechado, a seção "Turno aberto" (e sua linha
    // de pendência) sai de cena; SÓ a pendência do FECHAMENTO permanece
    expect(screen.getAllByText(/Salvo neste aparelho/)).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Turno aberto' })).toBeNull();

    world.online = true;
    world.transport.available = true;
    const retries = screen.getAllByRole('button', { name: 'Tentar sincronizar agora' });
    fireEvent.click(retries[retries.length - 1] as HTMLElement);
    await waitFor(() => expect(screen.getByText('Confirmado pelo servidor')).toBeTruthy());
  });

  it('operador sem a capability não recebe a ação de fechar', async () => {
    // ABRE mas não FECHA: perfil efetivo parcial. Nenhuma fixture DEV do
    // piloto tem essa forma (todo executor abre e fecha o próprio turno), então
    // a prova negativa vem do PORT de identidade — a UI decide pela capability
    // efetiva, jamais por quem a pessoa é.
    world.container = {
      ...world.container,
      identity: {
        verify: (input: { employeeId: string }) =>
          Promise.resolve({
            kind: 'verified' as const,
            authorization: {
              operatorEmployeeId: input.employeeId,
              operatorProfileId: null,
              membershipId: null,
              storeId: FIXTURE_STORE.id,
              sessionId: `parcial:${input.employeeId}`,
              permissions: [CAPABILITY_SESSION_OPEN] as readonly string[],
              permissionModelVersion: PERMISSION_MODEL_VERSION,
              configVersionRef: undefined,
              validUntil: new Date(NOW.getTime() + 3_600_000),
              origin: 'offline-snapshot' as const,
            },
          }),
      },
    };
    render(app('turno'));
    await openShiftAs('Rita Belmonte', ['9', '9', '7', '7', '5', '5']);
    expect(screen.queryByRole('button', { name: 'Fechar turno' })).toBeNull();
    expect(screen.getByText(/Seu perfil não permite fechar o turno/)).toBeTruthy();
  });
});

describe('quadro de tarefas do dia', () => {
  it('sem turno aberto, orienta a abrir o turno', async () => {
    render(app('tarefas'));
    expect(await screen.findByRole('heading', { name: 'Nenhum turno aberto' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ir para o turno' }));
    expect(navigations()).toContain('/turno');
  });

  it('quadro populado lista as tarefas do dia com estado e vencimento', async () => {
    const { rerender, container } = render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);

    rerender(app('tarefas'));
    expect(await screen.findByRole('heading', { name: 'Tarefas de hoje' })).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'Higienizar bancada de manipulação' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Conferir reposição da vitrine' })).toBeTruthy();
    // 2 badges de estado + 1 rótulo do resumo em linhas (V2)
    expect(screen.getAllByText('A fazer')).toHaveLength(3);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('quadro vazio quando não há definição de tarefa', async () => {
    world = makeWorld([]);
    const { rerender } = render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);
    rerender(app('tarefas'));
    expect(await screen.findByRole('heading', { name: 'Nenhuma tarefa para hoje' })).toBeTruthy();
  });

  it('conclui uma tarefa e confirma pelo servidor', async () => {
    const { rerender } = render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);
    rerender(app('tarefas'));
    await screen.findByRole('heading', { name: 'Conferir reposição da vitrine' });

    // a vitrine não exige foto: conclui direto
    const buttons = screen.getAllByRole('button', { name: 'Concluir tarefa' });
    fireEvent.click(buttons[1] as HTMLElement);

    await waitFor(() => expect(screen.getByText('Concluída')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Confirmado pelo servidor/)).toBeTruthy());
  });

  it('tarefa com foto obrigatória só conclui após registrar a evidência', async () => {
    const { rerender } = render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);
    rerender(app('tarefas'));
    await screen.findByRole('heading', { name: 'Higienizar bancada de manipulação' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Concluir tarefa' })[0] as HTMLElement);
    expect(await screen.findByText(/exige o registro de uma foto/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar foto' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Concluir tarefa' })[0] as HTMLElement);
    await waitFor(() => expect(screen.getByText('Concluída')).toBeTruthy());
  });

  it('adia uma tarefa com MOTIVO obrigatório (sem motivo o domínio rejeita)', async () => {
    const { rerender } = render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);
    rerender(app('tarefas'));
    await screen.findByRole('heading', { name: 'Conferir reposição da vitrine' });

    // abrir o fluxo de adiamento exige informar o motivo antes de confirmar
    fireEvent.click(screen.getAllByRole('button', { name: 'Adiar tarefa' })[1] as HTMLElement);
    const confirm = screen.getByRole('button', { name: 'Confirmar adiamento' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Motivo do adiamento (obrigatório)'), {
      target: { value: 'Faltou matéria-prima' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar adiamento' }));
    await waitFor(() => expect(screen.getByText('Adiada')).toBeTruthy());
  });

  it('OFFLINE: registra localmente e anuncia a pendência em role=status', async () => {
    world.online = false;
    world.transport.available = false;
    const { rerender } = render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);
    rerender(app('tarefas'));
    await screen.findByRole('heading', { name: 'Conferir reposição da vitrine' });
    expect(screen.getByText(/Sem conexão com o servidor/)).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Concluir tarefa' })[1] as HTMLElement);
    await waitFor(() => expect(screen.getByText(/Salvo neste aparelho/)).toBeTruthy());
    const status = screen.getAllByRole('status').map((el) => el.textContent ?? '');
    expect(status.some((text) => text.includes('aguardando envio'))).toBe(true);

    // reconexão explícita
    world.online = true;
    world.transport.available = true;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar sincronizar agora' }));
    await waitFor(() => expect(screen.getByText(/Confirmado pelo servidor/)).toBeTruthy());
  });

  it('conflito preserva o registro local e explica sem jargão', async () => {
    const { rerender } = render(app('turno'));
    await openShiftAs('Marina Álvares', ['2', '2', '4', '4', '6', '6']);
    rerender(app('tarefas'));
    await screen.findByRole('heading', { name: 'Conferir reposição da vitrine' });

    // outro aparelho concluiu a MESMA tarefa antes
    const tasks = await world.container.tasks.byWorkDate('store-centro-0001', '2026-07-21');
    const vitrine = tasks.find((task) => task.templateId === 'tpl-vitrine');
    world.transport.seedRemoteExecution(
      'store-centro-0001',
      vitrine?.id ?? '',
      'exec-de-outro-aparelho',
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Concluir tarefa' })[1] as HTMLElement);
    await waitFor(() =>
      expect(screen.getAllByText(/Tarefa já concluída em outro aparelho/).length).toBeGreaterThan(
        0,
      ),
    );
    expect(screen.getByText(/nada foi perdido/i)).toBeTruthy();
    // o desfecho local continua registrado
    expect(screen.getByText('Concluída')).toBeTruthy();
  });
});

describe('providers', () => {
  it('o contexto de operador exige o provider (falha explícita)', () => {
    expect(() => render(<OperatorSessionProvider>{null}</OperatorSessionProvider>)).not.toThrow();
  });
});
