// Jornada de integração — reatividade da calculadora, lote real canônico do
// spec (R$ 6,38/kg), comparação de preço, persistência e acessibilidade (axe).
import { ThemeProvider } from '@tauros/theme';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './app.js';
import { calculateQuickEstimate } from './domain/carcass-cost.js';
import {
  DEFAULT_EXPORT_CARCASS_PRICE_PER_KG,
  DEFAULT_SUBPRODUCTS,
  REFERENCE_COOLING_LOSS_PCT,
  REFERENCE_SLAUGHTER_LOSS_PCT,
  calculateTransformation,
} from './domain/transformation.js';
import { formatPerKg } from './ui/format.js';

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
    expect(screen.getByText('Abate + serviço + frete')).toBeDefined();
    expect(screen.getAllByText(/5\.980,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0,58\/kg/).length).toBeGreaterThan(0);
    // Acréscimos fixos visíveis: oportunidade + CENAR + impacto total.
    expect(screen.getByText('Custo de oportunidade')).toBeDefined();
    expect(screen.getByText('Descarga não realizada')).toBeDefined();
    expect(screen.getAllByText(/0,05\/kg/).length).toBeGreaterThan(0);
    expect(screen.getByText('CENAR')).toBeDefined();
    expect(screen.getAllByText(/0,01\/kg/).length).toBeGreaterThan(0);
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

describe('Auditoria matemática — Estimativa 4,80 / 17% / 2,5% / indicador 1,63%', () => {
  it('exibe R$ 6,67/kg com a cadeia 5,93 → +0,10 → 6,03 → +0,58 → +0,06 (nunca 6,71)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    const ajuste = within(screen.getByRole('region', { name: 'Ajuste rápido' })).getByLabelText(
      'Preço do suíno vivo (R$/kg)',
    );
    await user.clear(ajuste);
    await user.type(ajuste, '4,80');
    expect((await screen.findAllByText(/6,67\/kg/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5,93\/kg/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0,10\/kg/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/6,03\/kg/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0,58\/kg/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1,63%').length).toBeGreaterThan(0);
    expect(screen.queryByText(/6,71\/kg/)).toBeNull();
  });
});

describe('Formação do custo (Estimativa) — só valores do domínio', () => {
  const COSTS = { slaughterFeePerHead: 50, servicePerHead: 3, driverDailyRate: 150, fuelCost: 0 };
  // Intl usa espaço não-quebrável em "R$ 6,18/kg"; a Testing Library normaliza o
  // DOM (NBSP → espaço) mas não o matcher — por isso o esperado é normalizado.
  const plain = (text: string): string => text.replace(/\u00a0/g, ' ');
  const indicatorPct = (jowlPrice = 12.99): number =>
    calculateTransformation({
      subproducts: { ...DEFAULT_SUBPRODUCTS, jowl: { weightKg: 2.5, pricePerKg: jowlPrice } },
      exportCarcassPricePerKg: DEFAULT_EXPORT_CARCASS_PRICE_PER_KG,
      referenceLiveWeightKg: 115,
      slaughterLossPct: REFERENCE_SLAUGHTER_LOSS_PCT,
      coolingLossPct: REFERENCE_COOLING_LOSS_PCT,
    }).indicatorPct ?? 0;
  const expected = (livePrice: number, pct: number) =>
    calculateQuickEstimate({
      animals: 110,
      avgLiveWeightKg: 115,
      livePricePerKg: livePrice,
      slaughterLossPct: 17,
      coolingLossPct: 2.5,
      commercialAdjustmentPct: pct,
      costs: COSTS,
    });
  const formation = () => within(screen.getByRole('group', { name: 'Formação do custo por kg' }));
  const expectFormation = (livePrice: number, pct: number): void => {
    const r = expected(livePrice, pct);
    const f = formation();
    expect(f.getByText('Carcaça antes do ajuste')).toBeDefined();
    expect(f.getByText(plain(formatPerKg(r.baseCarcassPerKg)))).toBeDefined();
    expect(f.getByText('Ajuste transformação')).toBeDefined();
    expect(f.getByText(plain(`+ ${formatPerKg(r.commercialAdjustmentPerKg)}`))).toBeDefined();
    expect(f.getByText('Carcaça equivalente')).toBeDefined();
    expect(f.getByText(plain(formatPerKg(r.equivalentPerKg)))).toBeDefined();
    expect(f.getByText('Abate + serviço + frete')).toBeDefined();
    expect(f.getByText(plain(`+ ${formatPerKg(r.additionalPerKg)}`))).toBeDefined();
    expect(f.getByText('Custo de oportunidade')).toBeDefined();
    expect(f.getByText('CENAR')).toBeDefined();
    expect(f.getByText('Custo final')).toBeDefined();
    expect(f.getByText(plain(formatPerKg(r.costPerKg)))).toBeDefined();
  };

  it('cenário 110 × 115 kg, R$ 4,80: 5,93 → +0,10 → 6,03 → +0,58 → +0,05 → +0,01 → 6,67', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    const ajuste = within(screen.getByRole('region', { name: 'Ajuste rápido' })).getByLabelText(
      'Preço do suíno vivo (R$/kg)',
    );
    await user.clear(ajuste);
    await user.type(ajuste, '4,80');
    await screen.findAllByText(/6,67\/kg/);
    const f = formation();
    for (const text of [
      'R$ 5,93/kg',
      '+ R$ 0,10/kg',
      'R$ 6,03/kg',
      '+ R$ 0,58/kg',
      '+ R$ 0,05/kg',
      '+ R$ 0,01/kg',
      'R$ 6,67/kg',
    ]) {
      expect(f.getByText(plain(text))).toBeDefined();
    }
    // origem das parcelas
    expect(f.getByText(plain('R$ 4,80/kg vivo ÷ 80,93% de rendimento'))).toBeDefined();
    expect(f.getByText('Indicador 1,63% dos subprodutos')).toBeDefined();
    expect(f.getByText(plain('R$ 5.980,00 ÷ 10.237,01 kg'))).toBeDefined();
    expect(f.getByText('Descarga não realizada')).toBeDefined();
    expectFormation(4.8, indicatorPct());
  });

  it('alterar o preço do suíno recalcula a composição inteira', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    await screen.findAllByText(/6,92\/kg/);
    expectFormation(5, indicatorPct());
    const ajuste = within(screen.getByRole('region', { name: 'Ajuste rápido' })).getByLabelText(
      'Preço do suíno vivo (R$/kg)',
    );
    await user.clear(ajuste);
    await user.type(ajuste, '5,50');
    await screen.findAllByText(/7,55\/kg/);
    expectFormation(5.5, indicatorPct());
  });

  it('alterar subprodutos atualiza o indicador e a parcela "Ajuste transformação"', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    await screen.findAllByText(/6,92\/kg/);
    await user.click(screen.getByRole('button', { name: 'Transformação' }));
    const papada = within(screen.getByRole('group', { name: 'Papada' })).getByLabelText('R$/Kg');
    await user.clear(papada);
    await user.type(papada, '15,00');
    await screen.findAllByText('0,92%');
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await screen.findAllByText(/6,88\/kg/);
    expect(formation().getByText('Indicador 0,92% dos subprodutos')).toBeDefined();
    expectFormation(5, indicatorPct(15));
  });

  it('o "?" continua acessível (nome, estado e nota) e a ação principal é o primário', async () => {
    const user = userEvent.setup();
    renderApp();
    const help = screen.getByRole('button', { name: 'Sobre: Custos' });
    await user.click(help);
    expect(help.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/Abate e serviço são por suíno/)).toBeDefined();
    const save = screen.getByRole('button', { name: 'Salvar lote no histórico' });
    expect(save.getAttribute('data-variant')).toBe('primary');
    expect(
      screen.getByRole('button', { name: 'Ajustar subprodutos' }).getAttribute('data-variant'),
    ).toBe('secondary');
  });
});

describe('Desossa (indicador comercial da desossa) — cenário da planilha', () => {
  const plain = (text: string): string => text.replace(/\u00a0/g, ' ');
  const openDeboning = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Desossa' }));
    expect(screen.getByRole('heading', { name: 'Desossa' })).toBeDefined();
  };
  const product = (name: string) => within(screen.getByRole('group', { name }));
  const formation = () =>
    within(screen.getByRole('group', { name: 'Formação do valor comercial' }));

  it('a navegação tem as quatro telas e a Desossa é uma área própria (fora da Transformação)', () => {
    renderApp();
    const nav = within(screen.getByRole('navigation', { name: 'Telas' }));
    expect(nav.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Transformação',
      'Desossa',
      'Histórico',
      'Configurações',
    ]);
  });

  it('abre com a estatística atual: R$ 16.829,56, + R$ 3.800,00, 22,58%, 1.128,81 kg, 100,06%', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);

    // Margem em destaque (card) e na barra fixa; a divisão que a gera e a
    // composição só aparecem em "Ver detalhes" (resumo fechado por padrão).
    expect(screen.getAllByText('22,58%').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(plain('R$ 3.800,00 ÷ R$ 16.829,56'))).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(screen.getByText(plain('R$ 3.800,00 ÷ R$ 16.829,56'))).toBeDefined();
    // Formação do valor: carcaça → + acréscimo → valor comercial.
    const f = formation();
    expect(f.getByText('Carcaça')).toBeDefined();
    expect(f.getByText(plain('R$ 13.029,56'))).toBeDefined();
    expect(f.getByText('Acréscimo comercial')).toBeDefined();
    expect(f.getByText(plain('+ R$ 3.800,00'))).toBeDefined();
    expect(f.getByText('Valor comercial da desossa')).toBeDefined();
    expect(f.getByText(plain('R$ 16.829,56'))).toBeDefined();
    expect(f.getByText('12 produtos')).toBeDefined();
    // Pesos: carcaça, produtos e rendimento de peso (100,06% real, não corrigido).
    const pesos = within(screen.getByRole('group', { name: 'Pesos da desossa' }));
    expect(pesos.getByText('1.128,10 kg')).toBeDefined();
    expect(pesos.getByText('1.128,81 kg')).toBeDefined();
    expect(pesos.getByText('100,06%')).toBeDefined();
    // Carcaça: peso e custo do kg editáveis (o NumberInput não agrupa milhar);
    // valor inicial DERIVADO (peso × custo), só leitura, com a conta ao lado.
    expect((screen.getByLabelText('Peso da carcaça') as HTMLInputElement).value).toBe('1128,1');
    expect((screen.getByLabelText('Custo do kg') as HTMLInputElement).value).toContain('11,55');
    expect(screen.queryByLabelText('Valor inicial')).toBeNull();
    const inicial = within(screen.getByRole('group', { name: 'Valor inicial da carcaça' }));
    expect(inicial.getByText('Valor inicial')).toBeDefined();
    expect(inicial.getByText(plain('R$ 13.029,56'))).toBeDefined();
    expect(inicial.getByText(plain('1.128,10 kg × R$ 11,55/kg'))).toBeDefined();
    // 12 produtos; total e percentual ficam sob o botão de detalhes de cada um.
    expect(product('Pernil').queryByText(plain('R$ 4.437,90'))).toBeNull();
    await user.click(product('Pernil').getByRole('button', { name: 'Detalhes de Pernil' }));
    expect(product('Pernil').getByText(plain('R$ 4.437,90'))).toBeDefined();
    expect(product('Pernil').getByText('26,23%')).toBeDefined();
    await user.click(product('Osso').getByRole('button', { name: 'Detalhes de Osso' }));
    expect(product('Osso').getByText(plain('R$ 50,40'))).toBeDefined();
    await user.click(
      product('Toucinho torresmo').getByRole('button', { name: 'Detalhes de Toucinho torresmo' }),
    );
    expect(product('Toucinho torresmo').getByText(plain('R$ 1.434,57'))).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Papada' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Cabeça' })).toBeNull();
  });

  it('alterar o R$/kg do Pernil recalcula o total do produto e a margem (percentual não muda)', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await user.click(product('Pernil').getByRole('button', { name: 'Detalhes de Pernil' }));
    const price = product('Pernil').getByLabelText('R$/Kg');
    await user.clear(price);
    await user.type(price, '16,00');
    expect(await product('Pernil').findByText(plain('R$ 4.733,76'))).toBeDefined();
    expect(product('Pernil').getByText('26,23%')).toBeDefined();
    expect(screen.getAllByText('23,92%').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('22,58%')).toBeNull();
  });

  it('alterar o peso do Pernil recalcula percentual, total, peso dos produtos e margem', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await user.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    await user.click(product('Pernil').getByRole('button', { name: 'Detalhes de Pernil' }));
    const weight = product('Pernil').getByLabelText('Peso');
    await user.clear(weight);
    await user.type(weight, '300');
    expect(await product('Pernil').findByText(plain('R$ 4.500,00'))).toBeDefined();
    expect(product('Pernil').getByText('26,59%')).toBeDefined();
    expect(screen.getAllByText('22,86%').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('1.132,95 kg')).toBeDefined();
  });

  it('adicionar produto entra em modo de edição, ganha nome, peso e preço e entra no total', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await user.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar produto' }));
    expect(screen.getByRole('button', { name: 'Concluir' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const row = product('Produto 13');
    await user.type(row.getByLabelText('Nome do produto 13'), 'Filezinho');
    await user.type(row.getByLabelText('Peso'), '10');
    await user.type(row.getByLabelText('R$/Kg'), '20,00');
    expect(screen.getByRole('group', { name: 'Filezinho' })).toBeDefined();
    expect(screen.getAllByText('23,49%').length).toBeGreaterThanOrEqual(2);
    expect(formation().getByText('13 produtos')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Concluir' }));
    await user.click(product('Filezinho').getByRole('button', { name: 'Detalhes de Filezinho' }));
    expect(product('Filezinho').getByText(plain('R$ 200,00'))).toBeDefined();
  });

  it('remover produto (Osso) sai do total, do peso e da margem', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await user.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.click(product('Osso').getByRole('button', { name: 'Remover' }));
    expect(screen.queryByRole('group', { name: 'Osso' })).toBeNull();
    expect(screen.getAllByText('22,35%').length).toBeGreaterThanOrEqual(2);
    expect(formation().getByText('11 produtos')).toBeDefined();
    expect(screen.getByText('1.056,81 kg')).toBeDefined();
    expect(screen.getByText('93,68%')).toBeDefined();
  });

  it('alterar o custo do kg recalcula o valor inicial (só leitura), o acréscimo e a margem', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await user.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    const cost = screen.getByLabelText('Custo do kg');
    await user.clear(cost);
    await user.type(cost, '12,00');
    const inicial = within(screen.getByRole('group', { name: 'Valor inicial da carcaça' }));
    expect(await inicial.findByText(plain('R$ 13.537,20'))).toBeDefined();
    expect(inicial.getByText(plain('1.128,10 kg × R$ 12,00/kg'))).toBeDefined();
    expect(formation().getByText(plain('R$ 13.537,20'))).toBeDefined();
    // acréscimo 16.829,56 − 13.537,20 = 3.292,36 → margem 19,56%; valor comercial não muda.
    expect(formation().getByText(plain('+ R$ 3.292,36'))).toBeDefined();
    expect(formation().getByText(plain('R$ 16.829,56'))).toBeDefined();
    expect(screen.getAllByText('19,56%').length).toBeGreaterThanOrEqual(2);
  });

  it('carcaça sem peso: mensagem no campo e nenhum resultado inventado', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    await user.clear(screen.getByLabelText('Peso da carcaça'));
    expect(await screen.findByText('Informe este valor.')).toBeDefined();
    expect(
      screen.getByText('Informe o peso e o custo do kg da carcaça para ver o resultado.'),
    ).toBeDefined();
    expect(
      within(screen.getByRole('group', { name: 'Valor inicial da carcaça' })).getByText('—'),
    ).toBeDefined();
    expect(screen.queryByText('22,58%')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Salvar análise no histórico' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('salvar análise leva ao Histórico; abrir restaura; excluir exige confirmação', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    const price = product('Pernil').getByLabelText('R$/Kg');
    await user.clear(price);
    await user.type(price, '16,00');
    await screen.findAllByText('23,92%');

    const save = screen.getByRole('button', { name: 'Salvar análise no histórico' });
    expect(save.getAttribute('data-variant')).toBe('primary');
    await user.click(save);
    // Identificação antes de persistir (nome + data automática); confirma com o padrão.
    const saveDialog = await screen.findByRole('dialog', { name: 'Salvar análise' });
    await user.click(within(saveDialog).getByRole('button', { name: 'Salvar análise' }));
    expect(
      (screen.getByRole('button', { name: 'Análise salva no histórico' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText('Análise salva. Altere algum valor para salvar de novo.'),
    ).toBeDefined();

    // Volta à referência para provar que "Abrir" restaura o snapshot salvo.
    await user.clear(price);
    await user.type(price, '15,00');
    await screen.findAllByText('22,58%');

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(screen.getByRole('heading', { name: 'Desossas' })).toBeDefined();
    const card = within(screen.getByRole('article', { name: /Desossa de/ }));
    expect(card.getByText('DESOSSA')).toBeDefined();
    expect(card.getByText('23,92%')).toBeDefined();
    expect(card.getByText(/12 produtos/)).toBeDefined();
    expect(card.getByRole('button', { name: 'Excluir análise' }).getAttribute('data-variant')).toBe(
      'danger',
    );

    await user.click(card.getByRole('button', { name: 'Abrir esta desossa' }));
    expect(screen.getByRole('heading', { name: 'Desossa' })).toBeDefined();
    expect((await screen.findAllByText('23,92%')).length).toBeGreaterThanOrEqual(2);
    expect((product('Pernil').getByLabelText('R$/Kg') as HTMLInputElement).value).toContain(
      '16,00',
    );

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    await user.click(screen.getByRole('button', { name: 'Excluir análise' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Excluir desossa salva?')).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('article', { name: /Desossa de/ })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Excluir análise' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }),
    );
    expect(screen.queryByRole('article', { name: /Desossa de/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Desossas' })).toBeNull();
  });

  it('NÃO alimenta a Transformação nem a Estimativa (6,92/kg e 1,63% intactos)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Peso vivo médio'), '115');
    expect((await screen.findAllByText(/6,92\/kg/)).length).toBeGreaterThan(0);

    await openDeboning(user);
    const price = product('Pernil').getByLabelText('R$/Kg');
    await user.clear(price);
    await user.type(price, '30,00');
    const cost = screen.getByLabelText('Custo do kg');
    await user.clear(cost);
    await user.type(cost, '9,00');
    expect(screen.queryByText('22,58%')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect((await screen.findAllByText(/6,92\/kg/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1,63%').length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole('group', { name: 'Formação do custo por kg' })).getByText(
        'Indicador 1,63% dos subprodutos',
      ),
    ).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Transformação' }));
    expect(screen.getAllByText('1,63%').length).toBeGreaterThan(0);
    expect(screen.getByText('8,00 kg')).toBeDefined();
  });

  it('a desossa persiste ao reabrir o app e sobrevive a "novo lote"', async () => {
    const user = userEvent.setup();
    renderApp();
    await openDeboning(user);
    const price = product('Pernil').getByLabelText('R$/Kg');
    await user.clear(price);
    await user.type(price, '16,00');
    await screen.findAllByText('23,92%');

    cleanup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Configurações' }));
    await user.click(screen.getByRole('button', { name: 'Iniciar novo lote com estes padrões' }));
    await openDeboning(user);
    expect((await screen.findAllByText('23,92%')).length).toBeGreaterThanOrEqual(2);
  });

  it('"?" acessível, hierarquia de botões do DS e sem violações de acessibilidade (axe)', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await openDeboning(user);
    const help = screen.getByRole('button', { name: 'Sobre: margem comercial' });
    expect(help.getAttribute('aria-expanded')).toBe('false');
    await user.click(help);
    expect(screen.getByText(/Margem = acréscimo ÷ valor comercial/)).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Adicionar produto' }).getAttribute('data-variant'),
    ).toBe('secondary');
    expect(
      screen
        .getByRole('button', { name: 'Salvar análise no histórico' })
        .getAttribute('data-variant'),
    ).toBe('primary');
    expect(screen.getByRole('button', { name: 'Voltar' }).getAttribute('data-variant')).toBe(
      'secondary',
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
