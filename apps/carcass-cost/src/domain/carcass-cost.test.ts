// Testes do domínio de custo de carcaça — vetores canônicos do spec do
// produto (exemplo rápido R$ 7,1875/kg e lote real de 110 suínos → R$ 6,38/kg).
import { describe, expect, it } from 'vitest';

import {
  calculateFinalYield,
  calculatePaidWeight,
  calculateQuickEstimate,
  calculateRealLot,
  calculateYieldAfterSlaughter,
  whatIfPrices,
  type QuickEstimateInput,
  type RealLotInput,
} from './carcass-cost.js';

describe('calculateYieldAfterSlaughter / calculateFinalYield', () => {
  it('aplica as quebras sequencialmente, nunca somadas', () => {
    expect(calculateYieldAfterSlaughter(20)).toBeCloseTo(0.8, 12);
    // 20% + 7% sequencial = 74,40% (a soma simplista daria 73%).
    expect(calculateFinalYield(20, 7)).toBeCloseTo(0.744, 12);
  });

  it('quebra zero preserva o peso', () => {
    expect(calculateFinalYield(0, 0)).toBe(1);
  });
});

const QUICK_BASE: QuickEstimateInput = {
  animals: 110,
  liveWeightKg: 12_340,
  livePricePerKg: 5,
  slaughterLossPct: 20,
  coolingLossPct: 7,
  transformationPct: 7,
  costs: {
    slaughterFee: { kind: 'perKg', amountPerKg: 0.5 },
    servicePerHead: 0,
    freight: 0,
  },
};

describe('calculateQuickEstimate', () => {
  it('reproduz o exemplo canônico: 5,00 ÷ 0,80 × 1,07 + 0,50 = 7,1875', () => {
    const result = calculateQuickEstimate(QUICK_BASE);
    expect(result.basePerKg).toBeCloseTo(6.6875, 12);
    expect(result.costPerKg).toBeCloseTo(7.1875, 12);
  });

  it('não arredonda valores intermediários (6,6875 permanece exato)', () => {
    const result = calculateQuickEstimate(QUICK_BASE);
    // Se o intermediário fosse arredondado para 6,69, o total seria 7,19 exato.
    expect(result.costPerKg).not.toBeCloseTo(7.19, 12);
    expect(result.costPerKg).toBeCloseTo(7.1875, 12);
  });

  it('estima peso e rendimento pelo caminho físico sequencial', () => {
    const result = calculateQuickEstimate(QUICK_BASE);
    expect(result.yieldAfterSlaughter).toBeCloseTo(0.8, 12);
    expect(result.finalYield).toBeCloseTo(0.744, 12);
    expect(result.totalLossPct).toBeCloseTo(0.256, 12);
    expect(result.estimatedCarcassKg).toBeCloseTo(9_180.96, 6);
  });

  it('transformação afeta só o preço; quebra de frio afeta só o peso', () => {
    const semFrio = calculateQuickEstimate({ ...QUICK_BASE, coolingLossPct: 0 });
    expect(semFrio.basePerKg).toBeCloseTo(6.6875, 12);
    expect(semFrio.estimatedCarcassKg).toBeCloseTo(12_340 * 0.8, 6);

    const semTransformacao = calculateQuickEstimate({ ...QUICK_BASE, transformationPct: 0 });
    expect(semTransformacao.basePerKg).toBeCloseTo(6.25, 12);
    expect(semTransformacao.estimatedCarcassKg).toBeCloseTo(9_180.96, 6);
  });

  it('rateia serviço e frete pelo peso estimado da carcaça', () => {
    const result = calculateQuickEstimate({
      ...QUICK_BASE,
      costs: { ...QUICK_BASE.costs, servicePerHead: 3, freight: 150 },
    });
    // (110 × 3 + 150) ÷ 9.180,96 = 0,052282…
    expect(result.servicePerKg).toBeCloseTo(330 / 9_180.96, 12);
    expect(result.freightPerKg).toBeCloseTo(150 / 9_180.96, 12);
    expect(result.additionalPerKg).toBeCloseTo(0.5 + 480 / 9_180.96, 12);
    expect(result.costPerKg).toBeCloseTo(7.1875 + 480 / 9_180.96, 12);
  });

  it('taxa de abate por cabeça é rateada pelo peso estimado', () => {
    const result = calculateQuickEstimate({
      ...QUICK_BASE,
      costs: { ...QUICK_BASE.costs, slaughterFee: { kind: 'perHead', amountPerHead: 50 } },
    });
    expect(result.slaughterPerKg).toBeCloseTo(5_500 / 9_180.96, 12);
  });

  it('custo total e custo por suíno derivam do custo/kg × peso estimado', () => {
    const result = calculateQuickEstimate(QUICK_BASE);
    expect(result.totalCost).toBeCloseTo(result.costPerKg * result.estimatedCarcassKg, 6);
    expect(result.costPerAnimal).toBeCloseTo(result.totalCost / 110, 6);
  });
});

// Lote real canônico do spec: 110 suínos, balança 12.560 kg, graxaria 220 kg,
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
