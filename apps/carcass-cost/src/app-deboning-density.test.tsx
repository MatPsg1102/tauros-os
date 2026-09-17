// Desossa — refino de densidade visual: hierarquia Produto → Preço (peso como
// referência secundária com estatística), lista limpa (total e percentual só
// nos detalhes), resumo fechado (só a margem) com "Ver detalhes", edição da
// estatística (fornecedor/tipo) sem tocar nos pesos. Nenhum cálculo muda.
import { ThemeProvider } from '@tauros/theme';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './app.js';

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
const group = (name: string) => screen.getByRole('group', { name });
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

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

// Jornadas de UI: no CI o runner é ~3× mais lento que local.
describe('Desossa — densidade visual', { timeout: 30_000 }, () => {
  it('estatística editada para Languiru · Carcaça sem alterar os pesos', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await saveStatistic(user, 'Languiru', 'Porco Mineiro');
    expect(selectedStatisticText()).toBe('Languiru · Porco Mineiro');

    await user.click(screen.getByRole('button', { name: 'Editar estatística' }));
    const form = within(screen.getByRole('form', { name: 'Editar estatística de pesos' }));
    expect((form.getByLabelText(/^Fornecedor/) as HTMLInputElement).value).toBe('Languiru');
    await user.selectOptions(form.getByLabelText(/^Tipo/), 'Carcaça');
    await user.click(form.getByRole('button', { name: 'Salvar alterações' }));

    expect(selectedStatisticText()).toBe('Languiru · Carcaça');
    expect(screen.getByText(/Pesos de Languiru · Carcaça/)).toBeDefined();
    expect((product('Pernil').getByLabelText('Peso') as HTMLInputElement).value).toBe('295,86');
    expect((product('Osso').getByLabelText('Peso') as HTMLInputElement).value).toBe('72');
    // Persistiu: reabrir o app mantém fornecedor e tipo novos.
    cleanup();
    renderApp();
    await openDeboning(user);
    expect(selectedStatisticText()).toBe('Languiru · Carcaça');
  });

  it('com estatística o peso vira referência secundária e continua editável; preço é a entrada principal', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    expect(group('Pernil').getAttribute('data-weight-emphasis')).toBe('primary');

    await saveStatistic(user, 'Languiru', 'Carcaça');
    expect(group('Pernil').getAttribute('data-weight-emphasis')).toBe('secondary');
    const weight = product('Pernil').getByLabelText('Peso') as HTMLInputElement;
    expect(weight.value).toBe('295,86');
    expect(weight.style.fontSize).not.toBe('');
    const price = product('Pernil').getByLabelText('R$/Kg');
    expect(price.closest('[data-size]')?.getAttribute('data-size')).toBe('md');
    expect(weight.closest('[data-size]')?.getAttribute('data-size')).toBe('sm');

    await user.clear(weight);
    await user.type(weight, '300');
    await user.click(product('Pernil').getByRole('button', { name: 'Detalhes de Pernil' }));
    expect(product('Pernil').getByText(plain('R$ 4.500,00'))).toBeDefined();
    expect(screen.getAllByText('22,86%').length).toBeGreaterThanOrEqual(2);

    await user.selectOptions(statisticSelect(), 'Pesos manuais');
    expect(group('Pernil').getAttribute('data-weight-emphasis')).toBe('primary');
    expect((product('Pernil').getByLabelText('Peso') as HTMLInputElement).style.fontSize).toBe('');
  });

  it('lista fechada não mostra total nem percentual; detalhes mostram peso, participação, preço e total', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    expect(product('Pernil').queryByText(plain('R$ 4.437,90'))).toBeNull();
    expect(product('Pernil').queryByText('26,23%')).toBeNull();

    const details = product('Pernil').getByRole('button', { name: 'Detalhes de Pernil' });
    expect(details.getAttribute('aria-expanded')).toBe('false');
    await user.click(details);
    expect(details.getAttribute('aria-expanded')).toBe('true');
    expect(product('Pernil').getByText('Peso')).toBeDefined();
    expect(product('Pernil').getByText('295,86 kg')).toBeDefined();
    expect(product('Pernil').getByText('Participação no peso')).toBeDefined();
    expect(product('Pernil').getByText('26,23%')).toBeDefined();
    expect(product('Pernil').getByText('Preço')).toBeDefined();
    expect(product('Pernil').getByText(plain('R$ 15,00/kg'))).toBeDefined();
    expect(product('Pernil').getByText('Total')).toBeDefined();
    expect(product('Pernil').getByText(plain('R$ 4.437,90'))).toBeDefined();
    // Outro produto continua fechado; fechar o Pernil esconde de novo.
    expect(product('Osso').queryByText(plain('R$ 50,40'))).toBeNull();
    await user.click(details);
    expect(product('Pernil').queryByText(plain('R$ 4.437,90'))).toBeNull();
  });

  it('resumo fechado mostra só a margem; "Ver detalhes" revela a composição completa; cálculos iguais', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    expect(screen.getAllByText('22,58%').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(plain('R$ 3.800,00 ÷ R$ 16.829,56'))).toBeNull();
    expect(screen.queryByRole('group', { name: 'Formação do valor comercial' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Pesos da desossa' })).toBeNull();
    expect(screen.queryByText('1.128,81 kg')).toBeNull();

    const toggle = screen.getByRole('button', { name: 'Ver detalhes' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(
      screen.getByRole('button', { name: 'Ocultar detalhes' }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(screen.getByText(plain('R$ 3.800,00 ÷ R$ 16.829,56'))).toBeDefined();
    const formation = within(screen.getByRole('group', { name: 'Formação do valor comercial' }));
    expect(formation.getByText(plain('R$ 13.029,56'))).toBeDefined();
    expect(formation.getByText(plain('+ R$ 3.800,00'))).toBeDefined();
    expect(formation.getByText(plain('R$ 16.829,56'))).toBeDefined();
    expect(formation.getByText('12 produtos')).toBeDefined();
    const pesos = within(screen.getByRole('group', { name: 'Pesos da desossa' }));
    expect(pesos.getByText('1.128,10 kg')).toBeDefined();
    expect(pesos.getByText('1.128,81 kg')).toBeDefined();
    expect(pesos.getByText('100,06%')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Ocultar detalhes' }));
    expect(screen.queryByRole('group', { name: 'Formação do valor comercial' })).toBeNull();
    expect(screen.getAllByText('22,58%').length).toBeGreaterThanOrEqual(2);
  });

  it('acessibilidade: detalhes do produto e resumo expandidos sem violações (axe)', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await openDeboning(user);
    await saveStatistic(user, 'Languiru', 'Carcaça');
    await user.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    await user.click(product('Pernil').getByRole('button', { name: 'Detalhes de Pernil' }));
    expect((await axe(container)).violations).toEqual([]);
  });
});
