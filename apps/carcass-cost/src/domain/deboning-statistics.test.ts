// Estatística de pesos — funções puras: só pesos entram na estatística; aplicar
// preenche lista e pesos preservando preços já informados; nenhuma fórmula muda.
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEBONING_PRODUCTS,
  applyDeboningStatistic,
  buildDeboningInput,
  calculateDeboning,
  deboningStatisticLabel,
  statisticFromForm,
  type DeboningForm,
} from './deboning.js';

const FORM: DeboningForm = {
  carcassWeightKg: 1128.1,
  carcassCostPerKg: 11.55,
  products: DEFAULT_DEBONING_PRODUCTS,
  statistic: null,
};
const META = { id: 'stat-x', supplier: 'Frigorífico X', kind: 'porco-mineiro' } as const;

describe('estatística de pesos da desossa', () => {
  it('statisticFromForm guarda fornecedor, tipo, peso da carcaça e só os pesos dos produtos', () => {
    const statistic = statisticFromForm(FORM, META);
    expect(statistic.id).toBe('stat-x');
    expect(statistic.supplier).toBe('Frigorífico X');
    expect(statistic.kind).toBe('porco-mineiro');
    expect(statistic.carcassWeightKg).toBe(1128.1);
    expect(statistic.products).toHaveLength(12);
    expect(statistic.products[0]).toEqual({ id: 'pernil', name: 'Pernil', weightKg: 295.86 });
    expect(JSON.stringify(statistic)).not.toContain('pricePerKg');
  });

  it('aplicar preenche lista e pesos, preserva preços já informados (por id) e o custo do kg', () => {
    const statistic = statisticFromForm(FORM, META);
    const edited: DeboningForm = {
      carcassWeightKg: 900,
      carcassCostPerKg: 12.4,
      products: [
        { id: 'pernil', name: 'Pernil', weightKg: 100, pricePerKg: 16 },
        { id: 'extra', name: 'Filezinho', weightKg: 5, pricePerKg: 30 },
      ],
      statistic: null,
    };
    const applied = applyDeboningStatistic(edited, statistic);
    expect(applied.carcassWeightKg).toBe(1128.1);
    expect(applied.carcassCostPerKg).toBe(12.4);
    expect(applied.products).toHaveLength(12);
    expect(applied.products[0]).toEqual({
      id: 'pernil',
      name: 'Pernil',
      weightKg: 295.86,
      pricePerKg: 16,
    });
    expect(applied.products[1]?.pricePerKg).toBeNull();
    expect(applied.products.some((product) => product.id === 'extra')).toBe(false);
    expect(applied.statistic).toEqual({
      id: 'stat-x',
      supplier: 'Frigorífico X',
      kind: 'porco-mineiro',
    });
  });

  it('estatística sem peso de carcaça mantém o peso atual da análise', () => {
    const statistic = { ...statisticFromForm(FORM, META), carcassWeightKg: null };
    expect(
      applyDeboningStatistic({ ...FORM, carcassWeightKg: 777 }, statistic).carcassWeightKg,
    ).toBe(777);
  });

  it('não altera o cálculo comercial: mesma entrada ⇒ mesmo resultado', () => {
    const applied = applyDeboningStatistic(FORM, statisticFromForm(FORM, META));
    const before = buildDeboningInput(FORM);
    const after = buildDeboningInput(applied);
    expect(after).toEqual(before);
    if (before === null || after === null) throw new Error('entrada inesperadamente nula');
    expect(calculateDeboning(after)).toEqual(calculateDeboning(before));
    expect(calculateDeboning(after).marginPct).toBeCloseTo(22.579, 2);
  });

  it('rótulo = Fornecedor · Tipo', () => {
    expect(deboningStatisticLabel(META)).toBe('Frigorífico X · Porco Mineiro');
    expect(deboningStatisticLabel({ ...META, kind: 'carcaca' })).toBe('Frigorífico X · Carcaça');
  });
});
