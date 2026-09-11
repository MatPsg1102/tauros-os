// Testes do domínio de custo de carcaça — vetores canônicos do modelo v2:
// físico 100×115 kg → 9.545 → 9.306,375 kg (80,925%) e econômico
// 5,20 ÷ 0,83 ÷ 0,975 × 1,07 ≈ 6,88/kg; lote real 65.212 → 6,38/kg.
import { describe, expect, it } from 'vitest';

import {
  calculateFinalYield,
  calculatePaidWeight,
  calculateQuickEstimate,
  calculateRealLot,
  calculateTotalLiveWeight,
  calculateYieldAfterSlaughter,
  whatIfPrices,
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
  slaughterFee: { kind: 'perKg', amountPerKg: 0 },
  servicePerHead: 0,
  freight: 0,
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
    // sem abate/serviço/frete, o custo final é o próprio equivalente
    expect(result.costPerKg).toBeCloseTo(result.equivalentPerKg, 12);
  });

  it('ajuste comercial incide SÓ sobre a matéria-prima, nunca sobre os custos', () => {
    const withCosts: QuickEstimateInput = {
      ...QUICK_BASE,
      costs: { slaughterFee: { kind: 'perKg', amountPerKg: 0.5 }, servicePerHead: 3, freight: 150 },
    };
    const result = calculateQuickEstimate(withCosts);
    const noAdjustment = calculateQuickEstimate({ ...withCosts, commercialAdjustmentPct: 0 });
    // custos adicionais idênticos com e sem ajuste (o 7% não os multiplica)
    expect(result.additionalPerKg).toBeCloseTo(noAdjustment.additionalPerKg, 12);
    // identidade exata: final = equivalente + adicionais
    expect(result.costPerKg).toBeCloseTo(result.equivalentPerKg + result.additionalPerKg, 12);
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

  it('rateia abate/serviço/frete pelo peso final da carcaça', () => {
    const result = calculateQuickEstimate({
      ...QUICK_BASE,
      costs: { slaughterFee: { kind: 'perKg', amountPerKg: 0.5 }, servicePerHead: 3, freight: 150 },
    });
    expect(result.slaughterPerKg).toBeCloseTo(0.5, 12);
    expect(result.servicePerKg).toBeCloseTo(300 / 9_306.375, 12);
    expect(result.freightPerKg).toBeCloseTo(150 / 9_306.375, 12);
    expect(result.additionalPerKg).toBeCloseTo(0.5 + 300 / 9_306.375 + 150 / 9_306.375, 12);
  });

  it('taxa de abate por cabeça é rateada pelo peso final', () => {
    const result = calculateQuickEstimate({
      ...QUICK_BASE,
      costs: { ...ZERO_COSTS, slaughterFee: { kind: 'perHead', amountPerHead: 50 } },
    });
    expect(result.slaughterPerKg).toBeCloseTo(5_000 / 9_306.375, 12);
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
    slaughterFee: { kind: 'perHead', amountPerHead: 50 },
    servicePerHead: 3,
    freight: 150,
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
    expect(result.freightCost).toBeCloseTo(150, 6);
    expect(result.totalCost).toBeCloseTo(65_212, 6);
    expect(result.costPerKg).toBeCloseTo(65_212 / 10_217.2, 12); // ≈ 6,38
    expect(result.costPerAnimal).toBeCloseTo(65_212 / 110, 6);
    expect(result.additionalPerKg).toBeCloseTo(5_980 / 10_217.2, 12);
  });

  it('taxa de abate por kg usa o peso final recebido', () => {
    const result = calculateRealLot({
      ...REAL_LOT,
      costs: { ...REAL_LOT.costs, slaughterFee: { kind: 'perKg', amountPerKg: 0.5 } },
    });
    expect(result.slaughterCost).toBeCloseTo(10_217.2 * 0.5, 6);
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

describe('whatIfPrices', () => {
  it('gera 4,50 / 4,80 / 5,00 / 5,20 / 5,50 a partir de 5,00', () => {
    expect(whatIfPrices(5)).toEqual([4.5, 4.8, 5, 5.2, 5.5]);
  });

  it('nunca gera preço negativo', () => {
    expect(whatIfPrices(0.3)).toEqual([0.1, 0.3, 0.5, 0.8]);
  });
});
