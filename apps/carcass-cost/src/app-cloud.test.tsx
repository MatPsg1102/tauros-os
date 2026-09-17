// Jornada da nuvem (P-0001) com CloudApi falso em memória: login, histórico da
// nuvem, salvar/abrir/excluir, sair (volta ao aparelho), novo login recupera,
// falha de rede sem tela branca e acessibilidade da tela Conta.
import { ThemeProvider } from '@tauros/theme';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './app.js';
import { CLOUD_UNAVAILABLE_MESSAGE, type CloudApi, type CloudSession } from './state/cloud.js';
import type { HistoryEntry } from './state/model.js';

const PASSWORD = 'senha-piloto';
const EMAIL = 'piloto-a@example.com';

// Lote pré-existente na nuvem (77 suínos: valor que nenhum lote local tem).
const SEED: HistoryEntry = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  savedAt: '2026-09-17T10:00:00.000Z',
  mode: 'quick',
  quick: {
    animals: 77,
    avgLiveWeightKg: 100,
    livePricePerKg: 5,
    slaughterLossPct: 17,
    coolingLossPct: 2.5,
  },
  real: {
    animals: 77,
    scaleWeightKg: null,
    discountsKg: 0,
    slaughteredWeightKg: null,
    chilledWeightKg: null,
    livePricePerKg: 5,
  },
  costs: { slaughterFeePerHead: 50, servicePerHead: 3, driverDailyRate: 150, fuelCost: 0 },
  summary: {
    animals: 77,
    referenceWeightKg: 7700,
    finalWeightKg: 6231.2,
    livePricePerKg: 5,
    costPerKg: 7.01,
  },
};

interface FakeState {
  rows: HistoryEntry[];
  email: string | null;
  failList: boolean;
}

function fakeCloud(seed: readonly HistoryEntry[] = []): { api: CloudApi; state: FakeState } {
  const state: FakeState = { rows: [...seed], email: null, failList: false };
  const listeners = new Set<(session: CloudSession | null) => void>();
  const session = (): CloudSession | null => (state.email === null ? null : { email: state.email });
  const notify = (): void => {
    for (const listener of listeners) listener(session());
  };
  const api: CloudApi = {
    auth: {
      getSession: () => Promise.resolve(session()),
      onChange: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      signIn: (email, password) => {
        if (password !== PASSWORD) return Promise.resolve('E-mail ou senha inválidos.');
        state.email = email;
        notify();
        return Promise.resolve(null);
      },
      signOut: () => {
        state.email = null;
        notify();
        return Promise.resolve();
      },
    },
    history: {
      list: () =>
        state.failList
          ? Promise.reject(new Error('fetch failed'))
          : Promise.resolve([...state.rows]),
      save: (entry) => {
        state.rows.unshift(entry);
        return Promise.resolve();
      },
      remove: (id) => {
        const index = state.rows.findIndex((row) => row.id === id);
        if (index >= 0) state.rows.splice(index, 1);
        return Promise.resolve();
      },
    },
  };
  return { api, state };
}

function renderApp(cloud: CloudApi | null) {
  return render(
    <ThemeProvider>
      <App cloud={cloud} />
    </ThemeProvider>,
  );
}

async function signIn(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Conta' }));
  await user.type(screen.getByLabelText(/^E-mail/), EMAIL);
  await user.type(screen.getByLabelText(/^Senha/), PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByText(`Conectado como ${EMAIL}`);
  await user.click(screen.getByRole('button', { name: 'Voltar' }));
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

describe('Conta e histórico na nuvem', () => {
  it('sem nuvem configurada não há botão Conta e o histórico é deste aparelho', async () => {
    const user = userEvent.setup();
    renderApp(null);
    expect(screen.queryByRole('button', { name: /^Conta/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(screen.getByText('NESTE APARELHO')).toBeDefined();
    expect(screen.queryByText('NA NUVEM')).toBeNull();
  });

  it('login errado avisa; login certo conecta e lista os lotes da nuvem', async () => {
    const user = userEvent.setup();
    renderApp(fakeCloud([SEED]).api);
    await user.click(screen.getByRole('button', { name: 'Conta' }));
    await user.type(screen.getByLabelText(/^E-mail/), EMAIL);
    await user.type(screen.getByLabelText(/^Senha/), 'errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(
      await within(screen.getByRole('alert')).findByText('E-mail ou senha inválidos.'),
    ).toBeDefined();

    await user.clear(screen.getByLabelText(/^Senha/));
    await user.type(screen.getByLabelText(/^Senha/), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(`Conectado como ${EMAIL}`)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Conta (conectado)' }));
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText('NA NUVEM')).toBeDefined();
    expect(await screen.findByText(/77 suínos/)).toBeDefined();
  });

  it('salvar vai para a nuvem; abrir restaura; sair volta ao aparelho; novo login recupera', async () => {
    const user = userEvent.setup();
    const fake = fakeCloud();
    renderApp(fake.api);
    await signIn(user);

    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    await screen.findAllByText(/6,92\/kg/);
    await user.click(screen.getByRole('button', { name: 'Salvar lote no histórico' }));
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText(/110 suínos/)).toBeDefined();
    expect(screen.getByText('NA NUVEM')).toBeDefined();
    expect(fake.state.rows).toHaveLength(1);
    // Nada foi copiado para o aparelho: o envelope local continua vazio.
    expect(JSON.parse(localStorage.getItem('tauros.carcass-cost.history.v1') ?? '{}')).toEqual({
      version: 4,
      data: [],
    });

    // Muda o lote atual e reabre o salvo: os valores voltam.
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.clear(screen.getByLabelText('Peso vivo médio'));
    await user.type(screen.getByLabelText('Peso vivo médio'), '130');
    expect(screen.queryAllByText(/6,92\/kg/)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    await user.click(await screen.findByRole('button', { name: 'Abrir este lote' }));
    expect((await screen.findAllByText(/6,92\/kg/)).length).toBeGreaterThan(0);

    // Sair: histórico volta a ser o do aparelho (vazio — nada foi copiado).
    await user.click(screen.getByRole('button', { name: 'Conta (conectado)' }));
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText('NESTE APARELHO')).toBeDefined();
    expect(screen.getByText('Nenhum lote salvo ainda.')).toBeDefined();

    // Novo login (mesma nuvem, como outro aparelho): o lote continua lá.
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await signIn(user);
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText(/110 suínos/)).toBeDefined();
    expect(fake.state.rows).toHaveLength(1);
  });

  it('excluir lote da nuvem remove a linha após confirmação', async () => {
    const user = userEvent.setup();
    const fake = fakeCloud([SEED]);
    renderApp(fake.api);
    await signIn(user);
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    await screen.findByText(/77 suínos/);
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }),
    );
    expect(await screen.findByText('Nenhum lote salvo ainda.')).toBeDefined();
    expect(fake.state.rows).toHaveLength(0);
  });

  it('falha da nuvem mostra aviso e não derruba o app', async () => {
    const user = userEvent.setup();
    const fake = fakeCloud([SEED]);
    fake.state.failList = true;
    renderApp(fake.api);
    await signIn(user);
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText(CLOUD_UNAVAILABLE_MESSAGE)).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Histórico' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { name: 'Custo da Carcaça' })).toBeDefined();
  });

  it('tela Conta: Enter envia o formulário e não há violações de acessibilidade (axe)', async () => {
    const user = userEvent.setup();
    const { container } = renderApp(fakeCloud().api);
    await user.click(screen.getByRole('button', { name: 'Conta' }));
    expect((await axe(container)).violations).toEqual([]);
    await user.type(screen.getByLabelText(/^E-mail/), EMAIL);
    await user.type(screen.getByLabelText(/^Senha/), `${PASSWORD}{enter}`);
    expect(await screen.findByText(`Conectado como ${EMAIL}`)).toBeDefined();
    expect((await axe(container)).violations).toEqual([]);
  });
});
