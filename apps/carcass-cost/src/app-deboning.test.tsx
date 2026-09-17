// Jornada da Desossa — estatística de pesos, edição compacta e identificação
// da análise (nome + data automática), histórico e compatibilidade com
// registros antigos. Fórmulas não mudam: os números da planilha continuam.
import { ThemeProvider } from '@tauros/theme';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './app.js';
import { DEFAULT_DEBONING_PRODUCTS } from './domain/deboning.js';
import { DEBONING_HISTORY_STORAGE_KEY } from './state/storage.js';
import { formatDate } from './ui/format.js';

type User = ReturnType<typeof userEvent.setup>;

const NBSP = String.fromCharCode(160);
const plain = (text: string): string => text.split(NBSP).join(' ');

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

async function openDeboning(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Desossa' }));
  expect(screen.getByRole('heading', { name: 'Desossa' })).toBeDefined();
}

const product = (name: string) => within(screen.getByRole('group', { name }));
const statisticSelect = () => screen.getByLabelText('Selecionar estatística') as HTMLSelectElement;
const selectedStatisticText = () =>
  statisticSelect().options[statisticSelect().selectedIndex]?.textContent ?? '';

async function saveStatistic(user: User, supplier: string, kind: 'Porco Mineiro' | 'Carcaça') {
  await user.click(screen.getByRole('button', { name: 'Salvar pesos atuais como estatística' }));
  const form = within(screen.getByRole('form', { name: 'Nova estatística de pesos' }));
  await user.type(form.getByLabelText(/^Fornecedor/), supplier);
  await user.selectOptions(form.getByLabelText(/^Tipo/), kind);
  await user.click(form.getByRole('button', { name: 'Salvar estatística' }));
}

async function chooseStatistic(user: User, label: string): Promise<void> {
  await user.selectOptions(statisticSelect(), label);
}

const weightOf = (name: string) => (product(name).getByLabelText('Peso') as HTMLInputElement).value;

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

// Jornadas longas (formulários, diálogo, reload): no CI o runner é ~3× mais lento que local.
describe('Desossa — estatística de pesos', { timeout: 30_000 }, () => {
  it('salvar pesos atuais como estatística e selecioná-la preenche os pesos; peso e preço continuam editáveis', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    expect(selectedStatisticText()).toBe('Pesos manuais');

    await saveStatistic(user, 'Frigorífico X', 'Porco Mineiro');
    expect(selectedStatisticText()).toBe('Frigorífico X · Porco Mineiro');
    expect(screen.getByText(/Pesos de Frigorífico X · Porco Mineiro/)).toBeDefined();

    // Peso alterado à mão, depois a estatística volta a preencher.
    const weight = product('Pernil').getByLabelText('Peso');
    await user.clear(weight);
    await user.type(weight, '100');
    expect(product('Pernil').getByText(plain('R$ 1.500,00'))).toBeDefined();
    await chooseStatistic(user, 'Pesos manuais');
    expect(weightOf('Pernil')).toBe('100');
    await chooseStatistic(user, 'Frigorífico X · Porco Mineiro');
    expect(weightOf('Pernil')).toBe('295,86');
    expect(product('Pernil').getByText(plain('R$ 4.437,90'))).toBeDefined();

    // Continua editável: peso (secundário) e preço (principal).
    await user.clear(product('Pernil').getByLabelText('Peso'));
    await user.type(product('Pernil').getByLabelText('Peso'), '300');
    expect(product('Pernil').getByText(plain('R$ 4.500,00'))).toBeDefined();
    const price = product('Pernil').getByLabelText('R$/Kg');
    await user.clear(price);
    await user.type(price, '16,00');
    expect(product('Pernil').getByText(plain('R$ 4.800,00'))).toBeDefined();
    // Preço tem mais destaque que o peso (tamanhos do DS).
    expect(price.closest('[data-size]')?.getAttribute('data-size') ?? 'md').not.toBe('sm');
  });

  it('trocar de estatística atualiza os pesos; "Pesos manuais" mantém os pesos atuais', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await saveStatistic(user, 'Frigorífico X', 'Porco Mineiro');

    const weight = product('Pernil').getByLabelText('Peso');
    await user.clear(weight);
    await user.type(weight, '200');
    await saveStatistic(user, 'Frigorífico Y', 'Carcaça');
    expect(selectedStatisticText()).toBe('Frigorífico Y · Carcaça');

    await chooseStatistic(user, 'Frigorífico X · Porco Mineiro');
    expect(weightOf('Pernil')).toBe('295,86');
    await chooseStatistic(user, 'Frigorífico Y · Carcaça');
    expect(weightOf('Pernil')).toBe('200');
    await chooseStatistic(user, 'Pesos manuais');
    expect(weightOf('Pernil')).toBe('200');
    expect(screen.getByText(/Pesos manuais\./)).toBeDefined();
  });

  it('cálculos comerciais permanecem iguais com a estatística selecionada', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await saveStatistic(user, 'Frigorífico X', 'Carcaça');
    await chooseStatistic(user, 'Pesos manuais');
    await chooseStatistic(user, 'Frigorífico X · Carcaça');
    expect(screen.getAllByText('22,58%').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(plain('R$ 3.800,00 ÷ R$ 16.829,56'))).toBeDefined();
    expect(product('Pernil').getByText('26,23%')).toBeDefined();
  });

  it('salvar pede nome com a data de hoje; nome, data e estatística persistem e reabrem', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await saveStatistic(user, 'Frigorífico X', 'Porco Mineiro');
    const today = formatDate(new Date().toISOString());

    await user.click(screen.getByRole('button', { name: 'Salvar análise no histórico' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Salvar análise' }));
    const name = dialog.getByLabelText('Nome da análise') as HTMLInputElement;
    expect(name.value).toBe('Frigorífico X · Porco Mineiro');
    expect(dialog.getByText('Data')).toBeDefined();
    expect(dialog.getByText(today)).toBeDefined();
    await user.clear(name);
    await user.type(name, 'Frigorífico X — Semana 38');
    await user.click(dialog.getByRole('button', { name: 'Salvar análise' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByText('Análise salva. Altere algum valor para salvar de novo.'),
    ).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    const card = within(screen.getByRole('article', { name: /Desossa de/ }));
    expect(card.getByText('Frigorífico X — Semana 38')).toBeDefined();
    expect(card.getByText(`${today} · Frigorífico X · Porco Mineiro`)).toBeDefined();

    // Persistência: o app reaberto ainda lista e reabre a análise com a estatística.
    cleanup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    const again = within(screen.getByRole('article', { name: /Desossa de/ }));
    expect(again.getByText('Frigorífico X — Semana 38')).toBeDefined();
    await user.click(again.getByRole('button', { name: 'Abrir esta desossa' }));
    expect(screen.getByRole('heading', { name: 'Desossa' })).toBeDefined();
    expect(selectedStatisticText()).toBe('Frigorífico X · Porco Mineiro');
    expect(weightOf('Pernil')).toBe('295,86');
    expect(screen.getAllByText('22,58%').length).toBeGreaterThanOrEqual(2);
  });

  it('cancelar no diálogo não salva; nome vazio usa a data como padrão', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    const today = formatDate(new Date().toISOString());

    await user.click(screen.getByRole('button', { name: 'Salvar análise no histórico' }));
    let dialog = within(await screen.findByRole('dialog', { name: 'Salvar análise' }));
    expect((dialog.getByLabelText('Nome da análise') as HTMLInputElement).value).toBe(
      `Desossa ${today}`,
    );
    await user.click(dialog.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Salvar análise no histórico' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Salvar análise no histórico' }));
    dialog = within(await screen.findByRole('dialog', { name: 'Salvar análise' }));
    await user.clear(dialog.getByLabelText('Nome da análise'));
    await user.click(dialog.getByRole('button', { name: 'Salvar análise' }));
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    const card = within(screen.getByRole('article', { name: /Desossa de/ }));
    expect(card.getByText(`Desossa ${today}`)).toBeDefined();
    expect(card.getByText(today)).toBeDefined();
  });

  it('registros antigos (sem nome nem estatística) continuam listados e abrindo', async () => {
    localStorage.setItem(
      DEBONING_HISTORY_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        data: [
          {
            id: 'antiga',
            savedAt: '2026-09-10T09:30:00.000Z',
            deboning: {
              carcassWeightKg: 1000,
              carcassCostPerKg: 11,
              products: DEFAULT_DEBONING_PRODUCTS.slice(0, 2),
            },
            summary: {
              carcassWeightKg: 1000,
              carcassValueBRL: 11000,
              commercialValueBRL: 7251.48,
              commercialGainBRL: -3748.52,
              marginPct: -51.69,
              productCount: 2,
            },
          },
        ],
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    const card = within(screen.getByRole('article', { name: /Desossa de/ }));
    expect(card.getByText(/^Desossa de /)).toBeDefined();
    expect(card.getByText(formatDate('2026-09-10T09:30:00.000Z'))).toBeDefined();
    // A legenda de data não traz " · Fornecedor · Tipo": o texto é exatamente a data.

    await user.click(card.getByRole('button', { name: 'Abrir esta desossa' }));
    expect(screen.getByRole('heading', { name: 'Desossa' })).toBeDefined();
    expect(selectedStatisticText()).toBe('Pesos manuais');
    expect(weightOf('Pernil')).toBe('295,86');
    expect(weightOf('Lombo')).toBe('142,1');
    expect(screen.queryByRole('group', { name: 'Osso' })).toBeNull();
  });

  it('acessibilidade: formulário da estatística e diálogo de salvar sem violações (axe)', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await openDeboning(user);
    await user.click(screen.getByRole('button', { name: 'Salvar pesos atuais como estatística' }));
    expect((await axe(container)).violations).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByRole('button', { name: 'Salvar análise no histórico' }));
    await screen.findByRole('dialog', { name: 'Salvar análise' });
    expect((await axe(document.body)).violations).toEqual([]);
  });
});
