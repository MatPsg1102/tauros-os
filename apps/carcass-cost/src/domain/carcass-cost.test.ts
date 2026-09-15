// Testes do domínio de custo de carcaça — vetores canônicos do modelo v2:
// físico 100×115 kg → 9.545 → 9.306,375 kg (80,925%) e econômico
// 5,20 ÷ 0,83 ÷ 0,975 × 1,07 ≈ 6,88/kg; lote real 65.212 → 6,38/kg.
import { describe, expect, it } from 'vitest';

import {
  CENAR_TAX_PER_KG,
  FIXED_SURCHARGES_PER_KG,
  OPPORTUNITY_COST_PER_KG,
  calculateFinalYield,
  calculatePaidWeight,
  calculateQuickEstimate,
  calculateRealLot,
  calculateTotalLiveWeight,
  calculateYieldAfterSlaughter,
  type QuickEstimateInput,
  type RealLotInput,
} from './carcass-cost.js';

describe('calculateYieldAfterSlaughter / calculateFinalYield', () => {
  it('aplica as quebras sequencialmente, nunca somadas', () => {
    expect(calculateYieldAfterSlaughter(17)).toBeCloseTo(0.83, 12);
    // 17% + 2,5% sequencial = 80,925% (a soma simplista daria 80,5%).
    expect(calculateFinalYield(17, 2.5)).toBeCloseTo(0.80925, 12);
    expect(calculateFinalYield(17, 2.5)).not.toBeCloseTo(0.805, 4);
  });

  it('quebra zero preserva o peso', () => {
    expect(calculateFinalYield(0, 0)).toBe(1);
  });
});

describe('calculateTotalLiveWeight', () => {
  it('total = animais × peso médio', () => {
    expect(calculateTotalLiveWeight(100, 115)).toBe(11_500);
  });
});

const ZERO_COSTS = {
  slaughterFeePerHead: 0,
  servicePerHead: 0,
  driverDailyRate: 0,
  fuelCost: 0,
} as const;

// Caso realista de custos: abate R$ 50/cabeça, serviço R$ 3/suíno,
// diária R$ 150/viagem, combustível R$ 250/viagem.
const REALISTIC_COSTS = {
  slaughterFeePerHead: 50,
  servicePerHead: 3,
  driverDailyRate: 150,
  fuelCost: 250,
} as const;

const QUICK_BASE: QuickEstimateInput = {
  animals: 100,
  avgLiveWeightKg: 115,
  livePricePerKg: 5.2,
  slaughterLossPct: 17,
  coolingLossPct: 2.5,
  commercialAdjustmentPct: 7,
  costs: ZERO_COSTS,
};

describe('calculateQuickEstimate — cadeia física', () => {
  it('115 kg × 100 animais → 11.500 → 9.545 → 9.306,375 kg', () => {
    const result = calculateQuickEstimate(QUICK_BASE);
    expect(result.totalLiveWeightKg).toBeCloseTo(11_500, 9);
    // quebra de abate (17%) sobre o peso VIVO
    expect(result.weightAfterSlaughterKg).toBeCloseTo(9_545, 9);
    // quebra de frio (2,5%) sobre o peso APÓS o abate — nunca sobre o vivo
    expect(result.estimatedCarcassKg).toBeCloseTo(9_306.375, 9);
    expect(result.yieldAfterSlaughter).toBeCloseTo(0.83, 12);
    expect(result.finalYield).toBeCloseTo(0.80925, 12);
    expect(result.totalLossPct).toBeCloseTo(0.19075, 12);
  });
});

describe('calculateQuickEstimate — cadeia econômica', () => {
  it('5,20 ÷ 0,83 ÷ 0,975 × 1,07 ≈ 6,88/kg (sem custos adicionais)', () => {
    const result = calculateQuickEstimate(QUICK_BASE);
    expect(result.baseCarcassPerKg).toBeCloseTo(5.2 / 0.83 / 0.975, 12);
    expect(result.equivalentPerKg).toBeCloseTo((5.2 / 0.83 / 0.975) * 1.07, 12);
    expect(Math.round(result.equivalentPerKg * 100) / 100).toBe(6.88);
    // sem abate/serviço/viagem, o custo final é o equivalente + acréscimos fixos
    expect(result.costPerKg).toBeCloseTo(result.equivalentPerKg + FIXED_SURCHARGES_PER_KG, 12);
  });

  it('acréscimos fixos: oportunidade R$ 0,05 + CENAR R$ 0,01, uma única vez', () => {
    expect(OPPORTUNITY_COST_PER_KG).toBe(0.05);
    expect(CENAR_TAX_PER_KG).toBe(0.01);
    expect(FIXED_SURCHARGES_PER_KG).toBeCloseTo(0.06, 12);

    const result = calculateQuickEstimate({ ...QUICK_BASE, costs: REALISTIC_COSTS });
    // resultado SEM os acréscimos (equivalente + adicionais diluídos)
    const semAcrescimos = result.equivalentPerKg + result.additionalPerKg;
    // com oportunidade apenas: atual + 0,05
    expect(result.costPerKg - CENAR_TAX_PER_KG).toBeCloseTo(semAcrescimos + 0.05, 12);
    // com CENAR apenas: atual + 0,01
    expect(result.costPerKg - OPPORTUNITY_COST_PER_KG).toBeCloseTo(semAcrescimos + 0.01, 12);
    // com ambos: atual + 0,06 — valores absolutos, sem rateio por peso/viagem/cabeça
    expect(result.costPerKg).toBeCloseTo(semAcrescimos + 0.06, 12);
    // e nenhum deles recebe o +7%: mudar o ajuste não muda a soma fixa
    const semAjuste = calculateQuickEstimate({
      ...QUICK_BASE,
      costs: REALISTIC_COSTS,
      commercialAdjustmentPct: 0,
    });
    expect(semAjuste.costPerKg - semAjuste.equivalentPerKg - semAjuste.additionalPerKg).toBeCloseTo(
      0.06,
      12,
    );
  });

  it('exemplo do pedido: lote padrão 7,46 passa a 7,52 com os acréscimos', () => {
    // 110 × 115 kg, vivo 5,20, custos 50/3/150/0 — antes: 7,4597 → 7,46;
    // agora: 7,4597 + 0,06 = 7,5197 → R$ 7,52.
    const result = calculateQuickEstimate({
      ...QUICK_BASE,
      animals: 110,
      costs: { slaughterFeePerHead: 50, servicePerHead: 3, driverDailyRate: 150, fuelCost: 0 },
    });
    expect(result.costPerKg - FIXED_SURCHARGES_PER_KG).toBeCloseTo(
      (5.2 / 0.83 / 0.975) * 1.07 + 5_980 / 10_237.0125,
      12,
    );
    expect(Math.round(result.costPerKg * 100) / 100).toBe(7.52);
  });

  it('ajuste comercial incide SÓ sobre a matéria-prima, nunca sobre os custos', () => {
    const withCosts: QuickEstimateInput = { ...QUICK_BASE, costs: REALISTIC_COSTS };
    const result = calculateQuickEstimate(withCosts);
    const noAdjustment = calculateQuickEstimate({ ...withCosts, commercialAdjustmentPct: 0 });
    // custos adicionais idênticos com e sem ajuste (o 7% não os multiplica)
    expect(result.additionalCostsTotal).toBeCloseTo(noAdjustment.additionalCostsTotal, 12);
    expect(result.additionalPerKg).toBeCloseTo(noAdjustment.additionalPerKg, 12);
    // identidade exata: final = equivalente + adicionais + acréscimos fixos
    expect(result.costPerKg).toBeCloseTo(
      result.equivalentPerKg + result.additionalPerKg + FIXED_SURCHARGES_PER_KG,
      12,
    );
    // sem ajuste, equivalente = base
    expect(noAdjustment.equivalentPerKg).toBeCloseTo(noAdjustment.baseCarcassPerKg, 12);
  });

  it('quebra de frio afeta o peso E a conversão do preço; ajuste só o preço', () => {
    const semFrio = calculateQuickEstimate({ ...QUICK_BASE, coolingLossPct: 0 });
    expect(semFrio.estimatedCarcassKg).toBeCloseTo(9_545, 9);
    expect(semFrio.baseCarcassPerKg).toBeCloseTo(5.2 / 0.83, 12);

    const semAjuste = calculateQuickEstimate({ ...QUICK_BASE, commercialAdjustmentPct: 0 });
    expect(semAjuste.estimatedCarcassKg).toBeCloseTo(9_306.375, 9);
    expect(semAjuste.equivalentPerKg).toBeCloseTo(5.2 / 0.83 / 0.975, 12);
  });

  it('abate por cabeça, serviço por suíno, diária e combustível UMA vez por viagem', () => {
    const result = calculateQuickEstimate({ ...QUICK_BASE, costs: REALISTIC_COSTS });
    expect(result.slaughterCost).toBeCloseTo(100 * 50, 12);
    expect(result.serviceCost).toBeCloseTo(100 * 3, 12);
    // custo da viagem NÃO multiplica pela quantidade de suínos
    expect(result.tripCost).toBeCloseTo(150 + 250, 12);
    expect(result.additionalCostsTotal).toBeCloseTo(5_000 + 300 + 400, 12);
  });

  it('dobrar o nº de suínos dobra abate/serviço mas NÃO a viagem', () => {
    const single = calculateQuickEstimate({ ...QUICK_BASE, costs: REALISTIC_COSTS });
    const double = calculateQuickEstimate({
      ...QUICK_BASE,
      animals: 200,
      costs: REALISTIC_COSTS,
    });
    expect(double.slaughterCost).toBeCloseTo(single.slaughterCost * 2, 9);
    expect(double.serviceCost).toBeCloseTo(single.serviceCost * 2, 9);
    expect(double.tripCost).toBeCloseTo(single.tripCost, 12);
  });

  it('caso realista completo: adicionais diluídos pelo peso FINAL da carcaça', () => {
    // 100 × 115 kg, vivo 5,20 → carcaça final 9.306,375 kg;
    // adicionais = 5.000 + 300 + 150 + 250 = 5.700 → 5.700 ÷ 9.306,375 = 0,6125/kg;
    // final = 6,8755 (equivalente) + 0,6125 + 0,06 (fixos) = 7,5480 → R$ 7,55/kg.
    const result = calculateQuickEstimate({ ...QUICK_BASE, costs: REALISTIC_COSTS });
    expect(result.additionalPerKg).toBeCloseTo(5_700 / 9_306.375, 12);
    expect(result.costPerKg).toBeCloseTo(
      (5.2 / 0.83 / 0.975) * 1.07 + 5_700 / 9_306.375 + FIXED_SURCHARGES_PER_KG,
      12,
    );
    expect(Math.round(result.costPerKg * 100) / 100).toBe(7.55);
  });

  it('preços 5,00 / 5,20 / 5,50 / 6,00 passam pelo motor V2 com adicionais fixos', () => {
    const additional = calculateQuickEstimate({
      ...QUICK_BASE,
      costs: REALISTIC_COSTS,
    }).additionalPerKg;
    for (const price of [5, 5.2, 5.5, 6]) {
      const result = calculateQuickEstimate({
        ...QUICK_BASE,
        livePricePerKg: price,
        costs: REALISTIC_COSTS,
      });
      // +7% só no custo-base; preço não mexe nos adicionais (diluídos pelo
      // peso final, que também não muda com o preço) nem nos acréscimos fixos.
      expect(result.equivalentPerKg).toBeCloseTo((price / 0.83 / 0.975) * 1.07, 12);
      expect(result.additionalPerKg).toBeCloseTo(additional, 12);
      expect(result.costPerKg).toBeCloseTo(
        result.equivalentPerKg + additional + FIXED_SURCHARGES_PER_KG,
        12,
      );
      expect(result.estimatedCarcassKg).toBeCloseTo(9_306.375, 9);
    }
  });

  it('vetor de validação do responsável: 11.500 kg + R$ 5.980 adicionais ⇒ ≈ 7,58/kg', () => {
    // 100 × 115 = 11.500 kg → final 9.306,375 kg; equivalente 5,20÷0,83÷0,975×1,07;
    // adicionais 5.000 (abate) + 300 (serviço) + 150 + 530 (viagem) = 5.980
    // ⇒ 5.980 ÷ 9.306,375 = 0,6426/kg ⇒ 6,8755 + 0,6426 = 7,5181;
    // + acréscimos fixos 0,06 ⇒ 7,5781 → R$ 7,58.
    const result = calculateQuickEstimate({
      ...QUICK_BASE,
      costs: { slaughterFeePerHead: 50, servicePerHead: 3, driverDailyRate: 150, fuelCost: 530 },
    });
    expect(result.totalLiveWeightKg).toBeCloseTo(11_500, 9);
    expect(result.estimatedCarcassKg).toBeCloseTo(9_306.375, 9);
    expect(result.additionalCostsTotal).toBeCloseTo(5_980, 9);
    // o denominador dos adicionais é o peso FINAL da carcaça
    expect(result.additionalPerKg).toBeCloseTo(5_980 / 9_306.375, 12);
    expect(result.costPerKg).toBeCloseTo(
      (5.2 / 0.83 / 0.975) * 1.07 + 5_980 / 9_306.375 + FIXED_SURCHARGES_PER_KG,
      12,
    );
    expect(Math.round(result.costPerKg * 100) / 100).toBe(7.58);
  });

  it('custo total e custo por suíno derivam do custo/kg × peso final', () => {
    const result = calculateQuickEstimate(QUICK_BASE);
    expect(result.totalCost).toBeCloseTo(result.costPerKg * result.estimatedCarcassKg, 6);
    expect(result.costPerAnimal).toBeCloseTo(result.totalCost / 100, 6);
  });
});

// Lote real canônico: 110 suínos, balança 12.560 kg, graxaria 220 kg,
// abatido 10.513,50 kg, após frio 10.217,20 kg, vivo R$ 4,80/kg,
// abate R$ 50/cabeça, serviço R$ 3/cabeça, frete R$ 150.
const REAL_LOT: RealLotInput = {
  animals: 110,
  scaleWeightKg: 12_560,
  discountsKg: 220,
  slaughteredWeightKg: 10_513.5,
  chilledWeightKg: 10_217.2,
  livePricePerKg: 4.8,
  costs: {
    slaughterFeePerHead: 50,
    servicePerHead: 3,
    driverDailyRate: 150,
    fuelCost: 0,
  },
};

describe('calculateRealLot', () => {
  it('calcula pesos e quebras do lote real', () => {
    const result = calculateRealLot(REAL_LOT);
    expect(result.paidWeightKg).toBeCloseTo(12_340, 6);
    expect(result.slaughterLossKg).toBeCloseTo(1_826.5, 6);
    expect(result.slaughterLossPct).toBeCloseTo(1_826.5 / 12_340, 12); // ≈ 14,80%
    expect(result.coolingLossKg).toBeCloseTo(296.3, 6);
    expect(result.coolingLossPct).toBeCloseTo(296.3 / 10_513.5, 12); // ≈ 2,82%
    expect(result.totalLossKg).toBeCloseTo(2_122.8, 6);
    expect(result.totalLossPct).toBeCloseTo(2_122.8 / 12_340, 12); // ≈ 17,20%
    expect(result.finalYield).toBeCloseTo(10_217.2 / 12_340, 12); // ≈ 82,80%
  });

  it('calcula os custos do lote real (teste de integração do spec)', () => {
    const result = calculateRealLot(REAL_LOT);
    expect(result.animalsCost).toBeCloseTo(59_232, 6);
    expect(result.slaughterCost).toBeCloseTo(5_500, 6);
    expect(result.serviceCost).toBeCloseTo(330, 6);
    expect(result.tripCost).toBeCloseTo(150, 6);
    expect(result.additionalCostsTotal).toBeCloseTo(5_980, 6);
    expect(result.totalCost).toBeCloseTo(65_212, 6);
    expect(result.costPerKg).toBeCloseTo(65_212 / 10_217.2, 12); // ≈ 6,38
    expect(result.costPerAnimal).toBeCloseTo(65_212 / 110, 6);
    expect(result.additionalPerKg).toBeCloseTo(5_980 / 10_217.2, 12);
  });

  it('combustível entra UMA vez por viagem também no lote real', () => {
    const result = calculateRealLot({
      ...REAL_LOT,
      costs: { ...REAL_LOT.costs, fuelCost: 250 },
    });
    expect(result.tripCost).toBeCloseTo(400, 6);
    expect(result.totalCost).toBeCloseTo(65_462, 6);
    expect(result.costPerKg).toBeCloseTo(65_462 / 10_217.2, 12);
  });

  it('decomposição por kg soma exatamente o custo/kg', () => {
    const result = calculateRealLot(REAL_LOT);
    expect(result.basePerKg + result.additionalPerKg).toBeCloseTo(result.costPerKg, 12);
  });
});

describe('calculatePaidWeight', () => {
  it('peso pago = balança − descontos', () => {
    expect(calculatePaidWeight(12_560, 220)).toBeCloseTo(12_340, 12);
  });
});

// Auditoria matemática (2026-09-14): print mostrando R$ 6,71/kg com preço
// 4,80, quebras 17%/2,5%, indicador 1,63% e adicionais ≈ 0,59/kg. A cadeia
// atual dá 6,67 — cada etapa abaixo é o que a tela exibe. 6,71 só aparece
// com OUTRA entrada (preço 4,83 ou quebra de abate 17,5%).
describe('auditoria — cenário 4,80 / 17% / 2,5% / indicador 1,6258% (print R$ 6,71)', () => {
  // Indicador da Transformação com os dados iniciais e peso médio 115.
  const INDICATOR_PCT = ((61.6 - 49.95) / (115 * 0.83 * 0.975 * 7.7)) * 100;
  const scenario = (overrides: Partial<QuickEstimateInput> = {}): QuickEstimateInput => ({
    animals: 100,
    avgLiveWeightKg: 115,
    livePricePerKg: 4.8,
    slaughterLossPct: 17,
    coolingLossPct: 2.5,
    commercialAdjustmentPct: INDICATOR_PCT,
    costs: { slaughterFeePerHead: 50, servicePerHead: 3, driverDailyRate: 150, fuelCost: 0 },
    ...overrides,
  });

  it('cada etapa bate com o que a tela exibe e o total é R$ 6,67/kg (não 6,71)', () => {
    const r = calculateQuickEstimate(scenario());
    expect(r.baseCarcassPerKg).toBeCloseTo(4.8 / 0.83 / 0.975, 12); // 5,9314 → "5,93"
    expect(r.commercialAdjustmentPerKg).toBeCloseTo((r.baseCarcassPerKg * INDICATOR_PCT) / 100, 12); // "+0,10"
    expect(r.equivalentPerKg).toBeCloseTo(6.027848, 5); // "6,03"
    expect(r.additionalCostsTotal).toBe(5450);
    expect(r.additionalPerKg).toBeCloseTo(5450 / 9306.375, 12); // 0,5856 → "+0,59"
    expect(r.costPerKg).toBeCloseTo(6.673465, 5);
    expect(r.costPerKg.toFixed(2)).toBe('6.67');
  });

  it('indicador e acréscimos incidem UMA vez; nada além das parcelas exibidas entra no total', () => {
    const r = calculateQuickEstimate(scenario());
    // indicador só sobre o custo-base, uma vez
    expect(r.equivalentPerKg).toBeCloseTo(r.baseCarcassPerKg * (1 + INDICATOR_PCT / 100), 12);
    // acréscimos fixos uma vez (0,05 + 0,01), sem indicador por cima
    expect(FIXED_SURCHARGES_PER_KG).toBeCloseTo(0.06, 12);
    // total = exatamente a soma das parcelas exibidas — sem valor oculto
    expect(
      r.costPerKg - r.equivalentPerKg - r.additionalPerKg - FIXED_SURCHARGES_PER_KG,
    ).toBeCloseTo(0, 12);
    // rateio pelo peso FINAL exibido (carcaça estimada), não por outro denominador
    expect(r.estimatedCarcassKg).toBeCloseTo(9306.375, 9);
    expect(r.additionalPerKg * r.estimatedCarcassKg).toBeCloseTo(r.additionalCostsTotal, 9);
  });

  it('6,71 só aparece com outra entrada: preço 4,83 ou quebra de abate 17,5%', () => {
    expect(calculateQuickEstimate(scenario({ livePricePerKg: 4.83 })).costPerKg.toFixed(2)).toBe(
      '6.71',
    );
    expect(calculateQuickEstimate(scenario({ slaughterLossPct: 17.5 })).costPerKg.toFixed(2)).toBe(
      '6.71',
    );
    // com 110 suínos (adicionais 0,58/kg) o total continua 6,67
    expect(calculateQuickEstimate(scenario({ animals: 110 })).costPerKg.toFixed(2)).toBe('6.67');
  });
});
