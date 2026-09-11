// Jornada de integração — reatividade da calculadora, lote real canônico do
// spec (R$ 6,38/kg), comparação de preço, persistência e acessibilidade (axe).
import { ThemeProvider } from '@tauros/theme';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './app.js';

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('Calculadora — modo estimativa', () => {
  it('abre direto na calculadora, sem menu, com resultado pendente de peso', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Custo da Carcaça' })).toBeDefined();
    expect(
      screen.getByText('Preencha os campos destacados abaixo para ver o custo da carcaça.'),
    ).toBeDefined();
  });

  it('reage imediatamente ao peso vivo: defaults do spec dão R$ 7,24/kg', async () => {
    // 5,00 ÷ 0,80 × 1,07 + 0,50 + (110×3 + 150) ÷ 9.180,96 = 7,2398…
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo total (kg)'), '12340');
    const matches = await screen.findAllByText(/7,24\/kg/);
    expect(matches.length).toBeGreaterThan(0);
    // Rendimento sequencial visível (74,40%, nunca 73%).
    expect(screen.getAllByText('74,40%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('9.180,96 kg').length).toBeGreaterThan(0);
  });

  it('“E se eu pagar…” aplica o preço tocado e recalcula na hora', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo total (kg)'), '12340');
    // 4,50 ÷ 0,80 × 1,07 + 0,50 + rateio = 6,5710…
    await user.click(await screen.findByRole('button', { name: /4,50/ }));
    const matches = await screen.findAllByText(/6,57\/kg/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('a lista de preços fica ancorada no preço digitado — não re-centra a cada toque', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo total (kg)'), '12340');
    await user.click(await screen.findByRole('button', { name: /4,50/ }));
    // O preço original (R$ 5,00, âncora) continua disponível como chip…
    expect(screen.getByRole('button', { name: /5,00/ })).toBeDefined();
    // …e o chip tocado passa a ser o atual (aria-pressed).
    expect(screen.getByRole('button', { name: /4,50/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('salvar dá feedback e não duplica o mesmo lote', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo total (kg)'), '12340');
    await user.click(screen.getByRole('button', { name: 'Salvar lote no histórico' }));
    const savedButton = screen.getByRole('button', { name: 'Lote salvo no histórico' });
    expect((savedButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Lote salvo. Altere algum valor para salvar de novo.')).toBeDefined();
    // Alterar o lote reabilita o salvar.
    await user.click(screen.getByRole('button', { name: /5,50/ }));
    expect(screen.getByRole('button', { name: 'Salvar lote no histórico' })).toBeDefined();
  });

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = renderApp();
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe('Calculadora — modo lote real (teste de integração do spec)', () => {
  it('reproduz o lote canônico: 110 suínos → R$ 6,38/kg', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('radio', { name: 'Lote Real' }));

    await user.type(screen.getByLabelText('Peso na balança (kg)'), '12560');
    const descontos = screen.getByLabelText('Descontos / graxaria (kg)');
    await user.clear(descontos);
    await user.type(descontos, '220');
    await user.type(screen.getByLabelText('Peso abatido (kg)'), '10513,5');
    await user.type(screen.getByLabelText('Peso após frio (kg)'), '10217,2');

    const preco = screen.getByLabelText('Preço do suíno vivo (R$/kg)');
    await user.clear(preco);
    await user.type(preco, '4,8');

    await user.click(screen.getByRole('radio', { name: 'Por cabeça' }));
    // Taxa padrão por cabeça já é R$ 50,00; serviço R$ 3,00; frete R$ 150,00.

    const custoKg = await screen.findAllByText(/6,38\/kg/);
    expect(custoKg.length).toBeGreaterThan(0);

    // Peso pago e quebras exatamente como no spec.
    expect(screen.getAllByText(/12\.340,00 kg/).length).toBeGreaterThan(0);
    expect(screen.getByText('1.826,50 kg')).toBeDefined();
    expect(screen.getByText('14,80%')).toBeDefined();
    expect(screen.getByText('296,30 kg')).toBeDefined();
    expect(screen.getByText('2,82%')).toBeDefined();
    expect(screen.getByText('2.122,80 kg')).toBeDefined();
    expect(screen.getByText('17,20%')).toBeDefined();
    expect(screen.getByText('82,80%')).toBeDefined();

    // Custos: total R$ 65.212,00 e por suíno R$ 592,84.
    expect(screen.getAllByText(/65\.212,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/592,84/).length).toBeGreaterThan(0);
  });

  it('valida ordenação dos pesos com mensagem simples perto do campo', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('radio', { name: 'Lote Real' }));
    await user.type(screen.getByLabelText('Peso na balança (kg)'), '12560');
    await user.type(screen.getByLabelText('Peso abatido (kg)'), '10000');
    await user.type(screen.getByLabelText('Peso após frio (kg)'), '10500');
    expect(
      await screen.findByText('O peso após frio não pode ser maior que o peso abatido.'),
    ).toBeDefined();
  });
});

describe('Persistência local', () => {
  it('reabre exatamente no estado anterior', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo total (kg)'), '12340');
    await screen.findAllByText(/7,24\/kg/);

    cleanup();
    renderApp();
    const matches = await screen.findAllByText(/7,24\/kg/);
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('Histórico', () => {
  it('salva o lote atual e reabre pelo histórico', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo total (kg)'), '12340');
    await screen.findAllByText(/7,24\/kg/);
    await user.click(screen.getByRole('button', { name: 'Salvar lote no histórico' }));

    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText(/110 suínos/)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Abrir este lote' }));
    const matches = await screen.findAllByText(/7,24\/kg/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('excluir exige confirmação; cancelar preserva o lote', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo total (kg)'), '12340');
    await user.click(screen.getByRole('button', { name: 'Salvar lote no histórico' }));
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    await screen.findByText(/110 suínos/);

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Excluir lote salvo?')).toBeDefined();

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText(/110 suínos/)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }),
    );
    expect(await screen.findByText('Nenhum lote salvo ainda.')).toBeDefined();
  });
});

describe('Configurações', () => {
  it('mostra erro perto do campo e não persiste premissa inválida', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Configurações' }));

    const quebra = screen.getByLabelText('Quebra de abate (%)');
    await user.clear(quebra);
    await user.type(quebra, '120');
    expect(
      await screen.findByText('O percentual precisa ser de 0% até menos de 100%.'),
    ).toBeDefined();

    // Voltar e iniciar novo lote: o padrão vigente continua 20% (o inválido
    // nunca persistiu) — com os defaults o resultado volta a ser R$ 7,24/kg.
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.type(screen.getByLabelText('Peso vivo total (kg)'), '12340');
    const matches = await screen.findAllByText(/7,24\/kg/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('premissa válida persiste e alimenta o novo lote', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Configurações' }));

    const preco = screen.getByLabelText('Preço do suíno vivo (R$/kg)');
    await user.clear(preco);
    await user.type(preco, '4,5');
    await user.click(screen.getByRole('button', { name: 'Iniciar novo lote com estes padrões' }));

    await user.type(screen.getByLabelText('Peso vivo total (kg)'), '12340');
    // 4,50 ÷ 0,80 × 1,07 + 0,50 + rateio = 6,5710… → R$ 6,57/kg
    const matches = await screen.findAllByText(/6,57\/kg/);
    expect(matches.length).toBeGreaterThan(0);
  });
});
