// Testes do domínio de Transformação — indicador econômico de transformação.
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPORT_CARCASS_PRICE_PER_KG,
  DEFAULT_SUBPRODUCTS,
  REFERENCE_COOLING_LOSS_PCT,
  REFERENCE_LIVE_WEIGHT_KG,
  REFERENCE_SLAUGHTER_LOSS_PCT,
  SUBPRODUCT_KEYS,
  calculateTransformation,
  type TransformationInput,
} from './transformation.js';

const BASE: TransformationInput = {
  subproducts: DEFAULT_SUBPRODUCTS,
  exportCarcassPricePerKg: DEFAULT_EXPORT_CARCASS_PRICE_PER_KG,
  referenceLiveWeightKg: REFERENCE_LIVE_WEIGHT_KG,
  slaughterLossPct: REFERENCE_SLAUGHTER_LOSS_PCT,
  coolingLossPct: REFERENCE_COOLING_LOSS_PCT,
};

describe('SUBPRODUCT_KEYS — pele não participa', () => {
  it('há exatamente 7 subprodutos e nenhuma pele/skin', () => {
    expect(SUBPRODUCT_KEYS).toHaveLength(7);
    expect(SUBPRODUCT_KEYS).not.toContain('skin');
    expect(SUBPRODUCT_KEYS).not.toContain('pele');
    expect(calculateTransformation(BASE).items).toHaveLength(7);
  });
});

describe('calculateTransformation — dados iniciais', () => {
  it('valor recuperado de cada subproduto = peso × preço de venda', () => {
    const { items } = calculateTransformation(BASE);
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.recoveredBRL]));
    expect(byKey['head']).toBeCloseTo(2.4 * 0.5, 12); // 1,20
    expect(byKey['jowl']).toBeCloseTo(2.5 * 12.99, 12); // 32,475
    expect(byKey['tail']).toBeCloseTo(0.3 * 12.99, 12); // 3,897
  });

  it('8 kg, R$ 49,95 recuperado, R$ 61,60 teórico, R$ 11,65 de perda, ≈ 1,63%', () => {
    const r = calculateTransformation(BASE);
    expect(r.totalWeightKg).toBeCloseTo(8, 12);
    expect(r.totalRecoveredBRL).toBeCloseTo(49.95, 12);
    // valor teórico = 8 kg × 7,70 = 61,60
    expect(r.theoreticalValueBRL).toBeCloseTo(61.6, 12);
    // perda = 61,60 − 49,95 = 11,65
    expect(r.economicLossBRL).toBeCloseTo(11.65, 12);
    // carcaça = 115 × 0,83 × 0,975 × 7,70 = 716,590875
    expect(r.exportCarcassWeightKg).toBeCloseTo(93.06375, 9);
    expect(r.exportCarcassValueBRL).toBeCloseTo(716.590875, 9);
    // indicador = 11,65 ÷ 716,590875 = 1,6258…% → 1,63%
    expect(r.indicatorPct).toBeCloseTo((11.65 / 716.590875) * 100, 12);
    expect(Math.round((r.indicatorPct ?? 0) * 100) / 100).toBe(1.63);
    // NUNCA 7%
    expect(Math.round((r.indicatorPct ?? 0) * 100) / 100).not.toBe(7);
  });
});

describe('calculateTransformation — direção obrigatória', () => {
  it('↑ preço da papada → ↑ recuperação, ↓ perda, ↓ indicador', () => {
    const base = calculateTransformation(BASE);
    const raised = calculateTransformation({
      ...BASE,
      subproducts: { ...DEFAULT_SUBPRODUCTS, jowl: { weightKg: 2.5, pricePerKg: 15 } },
    });
    expect(raised.totalRecoveredBRL).toBeGreaterThan(base.totalRecoveredBRL);
    expect(raised.economicLossBRL).toBeLessThan(base.economicLossBRL);
    expect(raised.indicatorPct ?? 0).toBeLessThan(base.indicatorPct ?? 0);
    // 54,975 recuperado → perda 6,625 → 0,92%
    expect(raised.totalRecoveredBRL).toBeCloseTo(54.975, 12);
    expect(raised.economicLossBRL).toBeCloseTo(6.625, 12);
    expect(Math.round((raised.indicatorPct ?? 0) * 100) / 100).toBe(0.92);
  });

  it('↓ preço da papada → ↓ recuperação, ↑ perda, ↑ indicador', () => {
    const base = calculateTransformation(BASE);
    const lowered = calculateTransformation({
      ...BASE,
      subproducts: { ...DEFAULT_SUBPRODUCTS, jowl: { weightKg: 2.5, pricePerKg: 10 } },
    });
    expect(lowered.totalRecoveredBRL).toBeLessThan(base.totalRecoveredBRL);
    expect(lowered.economicLossBRL).toBeGreaterThan(base.economicLossBRL);
    expect(lowered.indicatorPct ?? 0).toBeGreaterThan(base.indicatorPct ?? 0);
  });
});

describe('calculateTransformation — reatividade de carcaça e peso', () => {
  it('↑ preço da carcaça de exportação recalcula (perda e denominador sobem)', () => {
    const base = calculateTransformation(BASE);
    const pricier = calculateTransformation({ ...BASE, exportCarcassPricePerKg: 9 });
    // teórico = 8 × 9 = 72; perda = 72 − 49,95 = 22,05
    expect(pricier.theoreticalValueBRL).toBeCloseTo(72, 12);
    expect(pricier.economicLossBRL).toBeCloseTo(22.05, 12);
    expect(pricier.exportCarcassValueBRL).toBeGreaterThan(base.exportCarcassValueBRL);
  });

  it('↑ peso de subproduto vendido abaixo da carcaça (orelha) → mais perda → indicador sobe', () => {
    const base = calculateTransformation(BASE);
    const heavier = calculateTransformation({
      ...BASE,
      subproducts: { ...DEFAULT_SUBPRODUCTS, ear: { weightKg: 1.8, pricePerKg: 2.99 } },
    });
    expect(heavier.totalWeightKg).toBeCloseTo(9, 12);
    // orelha (2,99) < carcaça (7,70): mais peso → mais perda → maior indicador
    expect(heavier.economicLossBRL).toBeGreaterThan(base.economicLossBRL);
    expect(heavier.indicatorPct ?? 0).toBeGreaterThan(base.indicatorPct ?? 0);
  });

  it('peso vivo maior dilui a perda: indicador cai', () => {
    const base = calculateTransformation(BASE);
    const bigger = calculateTransformation({ ...BASE, referenceLiveWeightKg: 130 });
    expect(bigger.economicLossBRL).toBeCloseTo(base.economicLossBRL, 12); // perda não muda
    expect(bigger.indicatorPct ?? 0).toBeLessThan(base.indicatorPct ?? 0); // denominador maior
  });
});

describe('calculateTransformation — dados inválidos (sem 7% silencioso)', () => {
  it('preço da carcaça 0 ⇒ indicador null (não inventa percentual)', () => {
    const r = calculateTransformation({ ...BASE, exportCarcassPricePerKg: 0 });
    expect(r.indicatorPct).toBeNull();
  });
});
