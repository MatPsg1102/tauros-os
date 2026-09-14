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

  it('reage imediatamente ao peso médio: defaults dão R$ 6,92/kg', async () => {
    // Física: 110 × 115 = 12.650 kg → ×0,83 = 10.499,50 → ×0,975 = 10.237,0125.
    // Econômica: indicador 1,6258% (aba Transformação); 5,00 ÷ 0,83 ÷ 0,975 ×
    // 1,016258 = 6,2790 + (5.980)/10.237 = 0,5842 + 0,06 (fixos) = 6,9232 → 6,92.
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    const matches = await screen.findAllByText(/6,92\/kg/);
    expect(matches.length).toBeGreaterThan(0);
    // Peso vivo total derivado (nunca digitado) visível junto ao campo.
    expect(screen.getByText('Peso vivo total: 12.650,00 kg')).toBeDefined();
    // Cadeia física sequencial: 83,00% após abate, 80,93% final (nunca 80,5%).
    expect(screen.getAllByText('83,00%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('80,93%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10.499,50 kg').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10.237,01 kg').length).toBeGreaterThan(0);
    // Cadeia econômica: equivalente antes dos custos adicionais = 6,28/kg.
    expect(screen.getAllByText(/6,28\/kg/).length).toBeGreaterThan(0);
    // Custos adicionais explícitos: total da operação e impacto por kg.
    expect(screen.getByText('Custos adicionais da operação')).toBeDefined();
    expect(screen.getAllByText(/5\.980,00/).length).toBeGreaterThan(0);
    expect(screen.getByText('Impacto dos custos adicionais')).toBeDefined();
    expect(screen.getAllByText(/0,58\/kg/).length).toBeGreaterThan(0);
    // Acréscimos fixos visíveis: oportunidade + CENAR + impacto total.
    expect(screen.getByText('Custo de oportunidade')).toBeDefined();
    expect(screen.getByText('Descarga não realizada')).toBeDefined();
    expect(screen.getAllByText(/0,05\/kg/).length).toBeGreaterThan(0);
    expect(screen.getByText('Imposto CENAR')).toBeDefined();
    expect(screen.getAllByText(/0,01\/kg/).length).toBeGreaterThan(0);
    expect(screen.getByText('Impacto total dos acréscimos')).toBeDefined();
    expect(screen.getAllByText(/0,06\/kg/).length).toBeGreaterThan(0);
  });

  it('a seção “E se eu pagar…” não existe mais', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    await screen.findAllByText(/6,92\/kg/);
    expect(screen.queryByText('E se eu pagar…')).toBeNull();
    expect(screen.queryByRole('button', { name: /4,50/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /5,50/ })).toBeNull();
  });

  it('salvar dá feedback e não duplica o mesmo lote', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    await user.click(screen.getByRole('button', { name: 'Salvar lote no histórico' }));
    const savedButton = screen.getByRole('button', { name: 'Lote salvo no histórico' });
    expect((savedButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Lote salvo. Altere algum valor para salvar de novo.')).toBeDefined();
    // Alterar o lote (preço via Ajuste rápido) reabilita o salvar.
    const ajuste = within(screen.getByRole('region', { name: 'Ajuste rápido' })).getByLabelText(
      'Preço do suíno vivo (R$/kg)',
    );
    await user.clear(ajuste);
    await user.type(ajuste, '5,50');
    expect(screen.getByRole('button', { name: 'Salvar lote no histórico' })).toBeDefined();
  });

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = renderApp();
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe('Ajuste rápido (tela de resultado da estimativa)', () => {
  const ajusteField = () =>
    within(screen.getByRole('region', { name: 'Ajuste rápido' })).getByLabelText(
      'Preço do suíno vivo (R$/kg)',
    );

  it('recalcula na hora para 5,00 / 5,20 / 5,50 / 6,00 sem tocar nos demais parâmetros', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    await screen.findAllByText(/6,92\/kg/);

    const ajuste = ajusteField();
    const cases: ReadonlyArray<readonly [string, RegExp]> = [
      ['5,20', /7,17\/kg/],
      ['5,50', /7,55\/kg/],
      ['6,00', /8,18\/kg/],
      ['5,00', /6,92\/kg/],
    ];
    for (const [price, expected] of cases) {
      await user.clear(ajuste);
      await user.type(ajuste, price);
      expect((await screen.findAllByText(expected)).length).toBeGreaterThan(0);
    }

    // Demais parâmetros intocados: pesos, quebras e custos seguem os mesmos.
    expect((screen.getByLabelText('Quebra de abate') as HTMLInputElement).value).toBe('17');
    expect((screen.getByLabelText('Quebra de frio') as HTMLInputElement).value).toBe('2,5');
    expect((screen.getByLabelText('Peso vivo médio') as HTMLInputElement).value).toBe('115');
    // Adicionais fixos (R$ 5.980,00) e impacto inalterado — o preço não os move.
    expect(screen.getAllByText(/5\.980,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0,58\/kg/).length).toBeGreaterThan(0);
  });

  it('fica sincronizado com o campo de preço das Entradas (mesmo estado)', async () => {
    const user = userEvent.setup();
    renderApp();
    const form = within(screen.getByRole('region', { name: 'Entradas do lote' })).getByLabelText(
      'Preço do suíno vivo (R$/kg)',
    );

    const ajuste = ajusteField();
    await user.clear(ajuste);
    await user.type(ajuste, '5,50');
    expect((form as HTMLInputElement).value).toContain('5,50');

    await user.clear(form);
    await user.type(form, '6,00');
    expect((ajusteField() as HTMLInputElement).value).toContain('6,00');
  });

  it('não existe na aba Lote Real', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('radio', { name: 'Lote Real' }));
    expect(screen.queryByRole('region', { name: 'Ajuste rápido' })).toBeNull();
  });
});

describe('Calculadora — modo lote real (teste de integração do spec)', () => {
  it('reproduz o lote canônico: 110 suínos → R$ 6,38/kg', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('radio', { name: 'Lote Real' }));

    await user.type(screen.getByLabelText('Peso na balança'), '12560');
    const descontos = screen.getByLabelText('Descontos / graxaria');
    await user.clear(descontos);
    await user.type(descontos, '220');
    await user.type(screen.getByLabelText('Peso abatido'), '10513,5');
    await user.type(screen.getByLabelText('Peso após frio'), '10217,2');

    const preco = screen.getByLabelText('Preço do suíno vivo (R$/kg)');
    await user.clear(preco);
    await user.type(preco, '4,8');
    // Custos padrão: abate R$ 50/cabeça, serviço R$ 3, diária R$ 150, combustível R$ 0.

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
    await user.type(screen.getByLabelText('Peso na balança'), '12560');
    await user.type(screen.getByLabelText('Peso abatido'), '10000');
    await user.type(screen.getByLabelText('Peso após frio'), '10500');
    expect(
      await screen.findByText('O peso após frio não pode ser maior que o peso abatido.'),
    ).toBeDefined();
  });
});

describe('Persistência local', () => {
  it('reabre exatamente no estado anterior', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    await screen.findAllByText(/6,92\/kg/);

    cleanup();
    renderApp();
    const matches = await screen.findAllByText(/6,92\/kg/);
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('Histórico', () => {
  it('salva o lote atual e reabre pelo histórico', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    await screen.findAllByText(/6,92\/kg/);
    await user.click(screen.getByRole('button', { name: 'Salvar lote no histórico' }));

    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText(/110 suínos/)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Abrir este lote' }));
    const matches = await screen.findAllByText(/6,92\/kg/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('excluir exige confirmação; cancelar preserva o lote', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
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

    const quebra = screen.getByLabelText('Quebra de abate');
    await user.clear(quebra);
    await user.type(quebra, '120');
    expect(
      await screen.findByText('O percentual precisa ser de 0% até menos de 100%.'),
    ).toBeDefined();

    // Voltar e iniciar novo lote: o padrão vigente continua 20% (o inválido
    // nunca persistiu) — com os defaults o resultado volta a ser R$ 6,92/kg.
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    const matches = await screen.findAllByText(/6,92\/kg/);
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

    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    // 4,50 ÷ 0,83 ÷ 0,975 × 1,016258 + adicionais + acréscimos fixos ≈ 6,30/kg
    const matches = await screen.findAllByText(/6,30\/kg/);
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('Transformação (indicador econômico de transformação)', () => {
  it('mostra perda e indicador ≈ 1,63% (nunca 7%)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Transformação' }));

    expect(screen.getByRole('heading', { name: 'Transformação' })).toBeDefined();
    // 7 subprodutos; papada = 2,5 × 12,99 = R$ 32,48 (valor recuperado).
    expect(
      within(screen.getByRole('group', { name: 'Papada' })).getByText(/R\$\s*32,48/),
    ).toBeDefined();
    // Resumo financeiro: 8,00 kg; recuperado 49,95; teórico 61,60; perda 11,65;
    // carcaça 716,59; indicador 1,63%.
    expect(screen.getByText('8,00 kg')).toBeDefined();
    expect(screen.getAllByText(/49,95/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/61,60/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/11,65/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/716,59/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1,63%').length).toBeGreaterThan(0);
    // Não há mais padrão histórico 7,00% nem diferença.
    expect(screen.queryByText('7,00%')).toBeNull();
    expect(screen.queryByText('Padrão histórico')).toBeNull();
  });

  it('AUMENTAR o preço da papada DIMINUI o indicador e o custo da Estimativa', async () => {
    const user = userEvent.setup();
    renderApp();
    // Estimativa base: 115 kg, defaults, indicador 1,63% → R$ 6,92/kg.
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    expect((await screen.findAllByText(/6,92\/kg/)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Transformação' }));
    const papada = within(screen.getByRole('group', { name: 'Papada' })).getByLabelText('R$/Kg');
    await user.clear(papada);
    await user.type(papada, '15,00');
    // recuperado 54,975 → perda 6,625 → 6,625/716,59 = 0,92% (DIMINUIU de 1,63%).
    expect((await screen.findAllByText('0,92%')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    // indicador menor → custo equivalente menor: 6,92 → 6,88/kg.
    expect((await screen.findAllByText(/6,88\/kg/)).length).toBeGreaterThan(0);
    // Os acréscimos fixos NÃO recebem o indicador — seguem 0,05 / 0,01 / 0,06.
    expect(screen.getAllByText(/0,05\/kg/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0,01\/kg/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0,06\/kg/).length).toBeGreaterThan(0);
  });

  it('REDUZIR o preço da papada AUMENTA o indicador', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Transformação' }));
    const papada = within(screen.getByRole('group', { name: 'Papada' })).getByLabelText('R$/Kg');
    await user.clear(papada);
    await user.type(papada, '10,00');
    // recuperado 42,475 → perda 19,125 → 19,125/716,59 = 2,67% (AUMENTOU de 1,63%).
    expect((await screen.findAllByText('2,67%')).length).toBeGreaterThan(0);
  });

  it('o preço da carcaça de exportação é editável e recalcula o indicador', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Transformação' }));
    const exportPrice = screen.getByLabelText('Preço da carcaça de exportação (R$/kg)');
    await user.clear(exportPrice);
    await user.type(exportPrice, '9,00');
    // teórico 72,00 → perda 22,05; carcaça 837,57 → 22,05/837,57 = 2,63%.
    expect((await screen.findAllByText('2,63%')).length).toBeGreaterThan(0);
  });

  it('a transformação persiste ao sair e voltar da aba', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Transformação' }));
    const papada = within(screen.getByRole('group', { name: 'Papada' })).getByLabelText('R$/Kg');
    await user.clear(papada);
    await user.type(papada, '15,00');
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Transformação' }));
    const papadaAgain = within(screen.getByRole('group', { name: 'Papada' })).getByLabelText(
      'R$/Kg',
    );
    expect((papadaAgain as HTMLInputElement).value).toContain('15,00');
  });
});

describe('Ajuda contextual ("?")', () => {
  it('abre e fecha a nota inline da seção, sem overlay', async () => {
    const user = userEvent.setup();
    renderApp();
    const button = screen.getByRole('button', { name: 'Sobre: Rendimento' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Quebra de abate incide sobre o peso vivo/)).toBeNull();
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/Quebra de abate incide sobre o peso vivo/)).toBeDefined();
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Quebra de abate incide sobre o peso vivo/)).toBeNull();
  });
});
