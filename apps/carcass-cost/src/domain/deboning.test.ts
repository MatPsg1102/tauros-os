// Testes do domínio da Desossa — indicador comercial da desossa (cenário da
// planilha da operação: carcaça 1.128,10 kg / R$ 13.029,56 → R$ 16.829,56,
// acréscimo R$ 3.800,00, margem 22,58%).
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEBONING_CARCASS,
  DEFAULT_DEBONING_PRODUCTS,
  buildDeboningInput,
  calculateDeboning,
  deboningProductField,
  validateDeboning,
  type DeboningForm,
  type DeboningInput,
} from './deboning.js';

const SHEET: DeboningInput = {
  carcassWeightKg: DEFAULT_DEBONING_CARCASS.weightKg,
  carcassValueBRL: DEFAULT_DEBONING_CARCASS.valueBRL,
  products: DEFAULT_DEBONING_PRODUCTS,
};

const round2 = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 100) / 100;

const byId = (input: DeboningInput) =>
  Object.fromEntries(calculateDeboning(input).items.map((item) => [item.id, item]));

describe('DEFAULT_DEBONING_PRODUCTS — produtos da estatística atual', () => {
  it('tem os 12 produtos da planilha, na ordem, sem itens da Transformação', () => {
    expect(DEFAULT_DEBONING_PRODUCTS.map((p) => p.name)).toEqual([
      'Pernil',
      'Lombo',
      'Pazinha',
      'Costelinha',
      'Copa lombo',
      'Toucinho torresmo',
      'Suã',
      'Pezinho',
      'Barriga',
      'Rabinho',
      'Retalho',
      'Osso',
    ]);
    const names = DEFAULT_DEBONING_PRODUCTS.map((p) => p.name.toLowerCase());
    for (const excluded of ['cabeça', 'papada', 'banha', 'mãozinha', 'orelha']) {
      expect(names).not.toContain(excluded);
    }
    const ids = DEFAULT_DEBONING_PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('calculateDeboning — fórmulas unitárias', () => {
  it('1. valor total por produto = peso × preço/kg', () => {
    const items = byId(SHEET);
    expect(items['pernil']?.totalBRL).toBeCloseTo(295.86 * 15, 12); // 4.437,90
    expect(items['lombo']?.totalBRL).toBeCloseTo(142.1 * 19.8, 12); // 2.813,58
    expect(items['pazinha']?.totalBRL).toBeCloseTo(124.6 * 14.29, 12); // 1.780,53
    expect(items['costelinha']?.totalBRL).toBeCloseTo(181.15 * 19.8, 12); // 3.586,77
    expect(items['copa-lombo']?.totalBRL).toBeCloseTo(42.27 * 15.99, 12); // 675,90
    expect(items['toucinho-torresmo']?.totalBRL).toBeCloseTo(123.67 * 11.6, 12); // 1.434,57
    expect(items['sua']?.totalBRL).toBeCloseTo(24 * 0.7, 12); // 16,80
    expect(items['pezinho']?.totalBRL).toBeCloseTo(15.2 * 2.99, 12); // 45,45
    expect(items['barriga']?.totalBRL).toBeCloseTo(88.76 * 19.8, 12); // 1.757,45
    expect(items['rabinho']?.totalBRL).toBeCloseTo(4.2 * 11.99, 12); // 50,36
    expect(items['retalho']?.totalBRL).toBeCloseTo(15 * 11.99, 12); // 179,85
    expect(items['osso']?.totalBRL).toBeCloseTo(72 * 0.7, 12); // 50,40
  });

  it('2. percentual por produto = peso ÷ peso da carcaça × 100', () => {
    const items = byId(SHEET);
    expect(items['pernil']?.sharePct).toBeCloseTo((295.86 / 1128.1) * 100, 12);
    expect(round2(items['pernil']?.sharePct ?? null)).toBe(26.23);
    expect(items['osso']?.sharePct).toBeCloseTo((72 / 1128.1) * 100, 12);
    expect(round2(items['osso']?.sharePct ?? null)).toBe(6.38);
  });

  it('3. valor comercial = soma do valor de todos os produtos', () => {
    const r = calculateDeboning(SHEET);
    const expected = SHEET.products.reduce((sum, p) => sum + p.weightKg * p.pricePerKg, 0);
    expect(r.commercialValueBRL).toBeCloseTo(expected, 9);
    // Soma exata (sem arredondar linha a linha): 16.829,5573 → exibe 16.829,56.
    expect(r.commercialValueBRL).toBeCloseTo(16829.5573, 6);
    expect(round2(r.commercialValueBRL)).toBe(16829.56);
  });

  it('4. acréscimo comercial = valor comercial − valor inicial da carcaça', () => {
    const r = calculateDeboning(SHEET);
    expect(r.commercialGainBRL).toBeCloseTo(r.commercialValueBRL - 13029.56, 9);
    expect(round2(r.commercialGainBRL)).toBe(3800);
  });

  it('5. margem comercial = acréscimo ÷ valor comercial × 100', () => {
    const r = calculateDeboning(SHEET);
    expect(r.marginPct).toBeCloseTo((r.commercialGainBRL / r.commercialValueBRL) * 100, 12);
    expect(round2(r.marginPct)).toBe(22.58);
    // A margem é sobre o valor COMERCIAL, não sobre o valor da carcaça (29,17%).
    expect(round2(r.marginPct)).not.toBe(29.17);
  });
});

describe('calculateDeboning — 6. cenário completo da planilha', () => {
  it('1.128,10 kg / R$ 13.029,56 → R$ 16.829,56, + R$ 3.800,00, 22,58%', () => {
    const r = calculateDeboning(SHEET);
    expect(r.items).toHaveLength(12);
    expect(r.carcassWeightKg).toBe(1128.1);
    expect(r.carcassValueBRL).toBe(13029.56);
    expect(round2(r.commercialValueBRL)).toBe(16829.56);
    expect(round2(r.commercialGainBRL)).toBe(3800);
    expect(round2(r.marginPct)).toBe(22.58);
  });

  it('peso dos produtos 1.128,81 kg ⇒ rendimento de peso 100,06% (dado real, não corrigido)', () => {
    const r = calculateDeboning(SHEET);
    expect(r.productsWeightKg).toBeCloseTo(1128.81, 9);
    expect(r.weightYieldPct).toBeCloseTo((1128.81 / 1128.1) * 100, 9);
    expect(round2(r.weightYieldPct)).toBe(100.06);
    expect(r.weightYieldPct ?? 0).toBeGreaterThan(100);
  });
});

describe('calculateDeboning — reatividade', () => {
  it('7. alterar o preço de um produto recalcula o valor total e a margem', () => {
    const base = calculateDeboning(SHEET);
    const raised = calculateDeboning({
      ...SHEET,
      products: SHEET.products.map((p) => (p.id === 'pernil' ? { ...p, pricePerKg: 16 } : p)),
    });
    const pernil = raised.items.find((i) => i.id === 'pernil');
    expect(pernil?.totalBRL).toBeCloseTo(295.86 * 16, 12); // 4.733,76
    expect(pernil?.sharePct).toBeCloseTo((295.86 / 1128.1) * 100, 12); // percentual não muda
    expect(raised.commercialValueBRL).toBeCloseTo(base.commercialValueBRL + 295.86, 9);
    expect(raised.commercialGainBRL).toBeCloseTo(base.commercialGainBRL + 295.86, 9);
    expect(raised.marginPct ?? 0).toBeGreaterThan(base.marginPct ?? 0);
    expect(round2(raised.marginPct)).toBe(23.92);
  });

  it('8. alterar o peso recalcula percentual, valor total e margem', () => {
    const base = calculateDeboning(SHEET);
    const heavier = calculateDeboning({
      ...SHEET,
      products: SHEET.products.map((p) => (p.id === 'pernil' ? { ...p, weightKg: 300 } : p)),
    });
    const pernil = heavier.items.find((i) => i.id === 'pernil');
    expect(pernil?.totalBRL).toBeCloseTo(4500, 12);
    expect(round2(pernil?.sharePct ?? null)).toBe(26.59);
    expect(heavier.productsWeightKg).toBeCloseTo(base.productsWeightKg + 4.14, 9);
    expect(heavier.commercialValueBRL).toBeCloseTo(base.commercialValueBRL - 4437.9 + 4500, 9);
    expect(round2(heavier.marginPct)).toBe(22.86);
  });

  it('9. adicionar um produto entra no total, no peso e na margem', () => {
    const base = calculateDeboning(SHEET);
    const added = calculateDeboning({
      ...SHEET,
      products: [
        ...SHEET.products,
        { id: 'novo', name: 'Filezinho', weightKg: 10, pricePerKg: 20 },
      ],
    });
    expect(added.items).toHaveLength(13);
    expect(added.commercialValueBRL).toBeCloseTo(base.commercialValueBRL + 200, 9);
    expect(added.commercialGainBRL).toBeCloseTo(base.commercialGainBRL + 200, 9);
    expect(added.productsWeightKg).toBeCloseTo(base.productsWeightKg + 10, 9);
    expect(round2(added.marginPct)).toBe(23.49);
  });

  it('10. remover um produto sai do total, do peso e da margem', () => {
    const base = calculateDeboning(SHEET);
    const removed = calculateDeboning({
      ...SHEET,
      products: SHEET.products.filter((p) => p.id !== 'osso'),
    });
    expect(removed.items).toHaveLength(11);
    expect(removed.commercialValueBRL).toBeCloseTo(base.commercialValueBRL - 50.4, 9);
    expect(removed.productsWeightKg).toBeCloseTo(base.productsWeightKg - 72, 9);
    expect(round2(removed.marginPct)).toBe(22.35);
    expect(round2(removed.weightYieldPct)).toBe(93.68);
  });

  it('acréscimo negativo quando a desossa vale menos que a carcaça (margem negativa, não escondida)', () => {
    const r = calculateDeboning({ ...SHEET, carcassValueBRL: 17000 });
    expect(r.commercialGainBRL).toBeLessThan(0);
    expect(r.marginPct ?? 0).toBeLessThan(0);
  });
});

describe('11. valores inválidos — não inventar resultado', () => {
  it('peso da carcaça 0 ⇒ percentuais e rendimento de peso null (totais em R$ seguem)', () => {
    const r = calculateDeboning({ ...SHEET, carcassWeightKg: 0 });
    expect(r.items.every((item) => item.sharePct === null)).toBe(true);
    expect(r.weightYieldPct).toBeNull();
    expect(round2(r.commercialValueBRL)).toBe(16829.56);
  });

  it('valor comercial 0 (nenhum produto vendido) ⇒ margem null', () => {
    const r = calculateDeboning({ ...SHEET, products: [] });
    expect(r.commercialValueBRL).toBe(0);
    expect(r.marginPct).toBeNull();
    expect(r.commercialGainBRL).toBeCloseTo(-13029.56, 9);
  });

  const validForm: DeboningForm = {
    carcassWeightKg: 1128.1,
    carcassValueBRL: 13029.56,
    products: DEFAULT_DEBONING_PRODUCTS,
  };

  it('carcaça sem peso/valor ou com peso 0 ⇒ problema no campo e entrada nula', () => {
    expect(validateDeboning({ ...validForm, carcassWeightKg: null })).toEqual([
      { field: 'carcassWeightKg', code: 'REQUIRED' },
    ]);
    expect(validateDeboning({ ...validForm, carcassWeightKg: 0 })).toEqual([
      { field: 'carcassWeightKg', code: 'NOT_POSITIVE' },
    ]);
    expect(validateDeboning({ ...validForm, carcassValueBRL: null })).toEqual([
      { field: 'carcassValueBRL', code: 'REQUIRED' },
    ]);
    expect(validateDeboning({ ...validForm, carcassValueBRL: -1 })).toEqual([
      { field: 'carcassValueBRL', code: 'NEGATIVE' },
    ]);
    expect(buildDeboningInput({ ...validForm, carcassWeightKg: null })).toBeNull();
  });

  it('peso ou preço negativo em produto ⇒ problema no campo do produto e entrada nula', () => {
    const form: DeboningForm = {
      ...validForm,
      products: [
        { id: 'pernil', name: 'Pernil', weightKg: -1, pricePerKg: 15 },
        { id: 'lombo', name: 'Lombo', weightKg: 142.1, pricePerKg: -19.8 },
      ],
    };
    expect(validateDeboning(form)).toEqual([
      { field: deboningProductField('pernil', 'weightKg'), code: 'NEGATIVE' },
      { field: deboningProductField('lombo', 'pricePerKg'), code: 'NEGATIVE' },
    ]);
    expect(buildDeboningInput(form)).toBeNull();
  });

  it('produto com campo vazio contribui 0 (ainda não pesado/precificado), sem inventar valor', () => {
    const form: DeboningForm = {
      ...validForm,
      products: [
        { id: 'pernil', name: 'Pernil', weightKg: 295.86, pricePerKg: 15 },
        { id: 'novo', name: '', weightKg: null, pricePerKg: null },
      ],
    };
    expect(validateDeboning(form)).toEqual([]);
    const input = buildDeboningInput(form);
    expect(input?.products[1]).toEqual({ id: 'novo', name: '', weightKg: 0, pricePerKg: 0 });
    const r = calculateDeboning(input as DeboningInput);
    expect(r.commercialValueBRL).toBeCloseTo(4437.9, 9);
    expect(r.items[1]?.totalBRL).toBe(0);
  });

  it('a forma válida da planilha vira exatamente a entrada da planilha', () => {
    expect(buildDeboningInput(validForm)).toEqual(SHEET);
  });
});
