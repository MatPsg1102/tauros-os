// Testes do domínio de Transformação — indicador econômico dos subprodutos.
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COMMERCIAL_ADJUSTMENT_PCT,
  DEFAULT_EXPORT_CARCASS_PRICE_PER_KG,
  DEFAULT_SUBPRODUCTS,
  REFERENCE_LIVE_WEIGHT_KG,
  calculateTransformation,
  resolveCommercialAdjustmentPct,
  type TransformationInput,
} from './transformation.js';

const BASE: TransformationInput = {
  subproducts: DEFAULT_SUBPRODUCTS,
  exportCarcassPricePerKg: DEFAULT_EXPORT_CARCASS_PRICE_PER_KG,
  referenceLiveWeightKg: REFERENCE_LIVE_WEIGHT_KG,
  slaughterLossPct: 17,
  coolingLossPct: 2.5,
};

describe('calculateTransformation — valores dos subprodutos', () => {
  it('valor de cada subproduto = peso × preço', () => {
    const { items } = calculateTransformation(BASE);
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.valueBRL]));
    expect(byKey['head']).toBeCloseTo(2.4 * 0.5, 12); // 1,20
    expect(byKey['headTrim']).toBeCloseTo(0.6 * 5, 12); // 3,00
    expect(byKey['lard']).toBeCloseTo(0.8 * 4.99, 12); // 3,992
    expect(byKey['jowl']).toBeCloseTo(2.5 * 12.99, 12); // 32,475
    expect(byKey['trotter']).toBeCloseTo(0.6 * 4.99, 12); // 2,994
    expect(byKey['ear']).toBeCloseTo(0.8 * 2.99, 12); // 2,392
    expect(byKey['tail']).toBeCloseTo(0.3 * 12.99, 12); // 3,897
  });

  it('soma correta dos 7 subprodutos: 8,00 kg e R$ 49,95', () => {
    const result = calculateTransformation(BASE);
    expect(result.items).toHaveLength(7);
    expect(result.totalWeightKg).toBeCloseTo(8, 12);
    expect(result.totalValueBRL).toBeCloseTo(49.95, 12);
  });
});

describe('calculateTransformation — carcaça de exportação e indicador', () => {
  it('valor da carcaça de exportação = 115 × 0,83 × 0,975 × 7,70 ≈ 716,59', () => {
    const result = calculateTransformation(BASE);
    expect(result.exportCarcassWeightKg).toBeCloseTo(93.06375, 9);
    expect(result.exportCarcassValueBRL).toBeCloseTo(716.590875, 9);
  });

  it('indicador ≈ 6,97% com os dados iniciais (sem arredondar para 7,00)', () => {
    const result = calculateTransformation(BASE);
    expect(result.indicatorPct).toBeCloseTo((49.95 / 716.590875) * 100, 12);
    expect(result.indicatorPct).not.toBeNull();
    expect(Math.round((result.indicatorPct ?? 0) * 100) / 100).toBe(6.97);
    // diferença vs padrão histórico ≈ -0,03 p.p.
    expect((result.indicatorPct ?? 0) - DEFAULT_COMMERCIAL_ADJUSTMENT_PCT).toBeCloseTo(-0.0295, 3);
  });
});

describe('calculateTransformation — reatividade do indicador', () => {
  it('aumentar o PREÇO de um subproduto aumenta o indicador', () => {
    const base = calculateTransformation(BASE);
    const raised = calculateTransformation({
      ...BASE,
      subproducts: { ...DEFAULT_SUBPRODUCTS, jowl: { weightKg: 2.5, pricePerKg: 15 } },
    });
    expect(raised.totalValueBRL).toBeGreaterThan(base.totalValueBRL);
    expect(raised.indicatorPct ?? 0).toBeGreaterThan(base.indicatorPct ?? 0);
  });

  it('aumentar o PESO de um subproduto aumenta o indicador', () => {
    const base = calculateTransformation(BASE);
    const raised = calculateTransformation({
      ...BASE,
      subproducts: { ...DEFAULT_SUBPRODUCTS, jowl: { weightKg: 3, pricePerKg: 12.99 } },
    });
    expect(raised.indicatorPct ?? 0).toBeGreaterThan(base.indicatorPct ?? 0);
  });

  it('aumentar o PREÇO da carcaça de exportação DIMINUI o indicador', () => {
    const base = calculateTransformation(BASE);
    const pricier = calculateTransformation({ ...BASE, exportCarcassPricePerKg: 9 });
    expect(pricier.exportCarcassValueBRL).toBeGreaterThan(base.exportCarcassValueBRL);
    expect(pricier.indicatorPct ?? 0).toBeLessThan(base.indicatorPct ?? 0);
  });
});

describe('resolveCommercialAdjustmentPct', () => {
  it('usa o indicador calculado quando válido', () => {
    const result = calculateTransformation(BASE);
    expect(resolveCommercialAdjustmentPct(result)).toBeCloseTo(result.indicatorPct ?? 0, 12);
  });

  it('cai no fallback 7% quando o denominador é inválido (preço de exportação 0)', () => {
    const result = calculateTransformation({ ...BASE, exportCarcassPricePerKg: 0 });
    expect(result.indicatorPct).toBeNull();
    expect(resolveCommercialAdjustmentPct(result)).toBe(7);
  });
});
