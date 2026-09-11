// Testes das regras de validação — valores impossíveis nunca chegam às fórmulas.
import { describe, expect, it } from 'vitest';

import {
  buildQuickInput,
  buildRealInput,
  headCountIssue,
  nonNegativeIssue,
  percentageIssue,
  positiveIssue,
  validateCosts,
  validateQuick,
  validateReal,
  type CostsForm,
  type QuickForm,
  type RealForm,
} from './validation.js';

const VALID_COSTS: CostsForm = {
  slaughterFeeKind: 'perKg',
  slaughterFeePerKg: 0.5,
  slaughterFeePerHead: null,
  servicePerHead: 3,
  freight: 150,
};

const VALID_QUICK: QuickForm = {
  animals: 110,
  avgLiveWeightKg: 115,
  livePricePerKg: 5,
  slaughterLossPct: 17,
  coolingLossPct: 2.5,
  commercialAdjustmentPct: 7,
};

const VALID_REAL: RealForm = {
  animals: 110,
  scaleWeightKg: 12_560,
  discountsKg: 220,
  slaughteredWeightKg: 10_513.5,
  chilledWeightKg: 10_217.2,
  livePricePerKg: 4.8,
};

describe('regras de campo exportadas (consumidas pela tela de Configurações)', () => {
  it('nonNegativeIssue / positiveIssue', () => {
    expect(nonNegativeIssue(-0.01)).toBe('NEGATIVE');
    expect(nonNegativeIssue(0)).toBeNull();
    expect(positiveIssue(0)).toBe('NOT_POSITIVE');
    expect(positiveIssue(0.01)).toBeNull();
  });

  it('percentageIssue nas duas bordas', () => {
    expect(percentageIssue(-1)).toBe('PCT_OUT_OF_RANGE');
    expect(percentageIssue(100)).toBe('PCT_OUT_OF_RANGE');
    expect(percentageIssue(0)).toBeNull();
    expect(percentageIssue(99.99)).toBeNull();
  });

  it('headCountIssue exige inteiro positivo', () => {
    expect(headCountIssue(0)).toBe('NOT_POSITIVE');
    expect(headCountIssue(1.5)).toBe('NOT_INTEGER');
    expect(headCountIssue(110)).toBeNull();
  });
});

describe('validateQuick', () => {
  it('aceita o lote canônico', () => {
    expect(validateQuick(VALID_QUICK, VALID_COSTS)).toEqual([]);
  });

  it('exige valor preenchido', () => {
    expect(validateQuick({ ...VALID_QUICK, avgLiveWeightKg: null }, VALID_COSTS)).toEqual([
      { field: 'avgLiveWeightKg', code: 'REQUIRED' },
    ]);
  });

  it('rejeita quantidade não inteira ou não positiva de animais', () => {
    expect(validateQuick({ ...VALID_QUICK, animals: 1.5 }, VALID_COSTS)).toEqual([
      { field: 'animals', code: 'NOT_INTEGER' },
    ]);
    expect(validateQuick({ ...VALID_QUICK, animals: 0 }, VALID_COSTS)).toEqual([
      { field: 'animals', code: 'NOT_POSITIVE' },
    ]);
  });

  it('rejeita peso médio zero ou negativo', () => {
    expect(validateQuick({ ...VALID_QUICK, avgLiveWeightKg: 0 }, VALID_COSTS)).toEqual([
      { field: 'avgLiveWeightKg', code: 'NOT_POSITIVE' },
    ]);
  });

  it('rejeita preço negativo e aceita zero', () => {
    expect(validateQuick({ ...VALID_QUICK, livePricePerKg: -1 }, VALID_COSTS)).toEqual([
      { field: 'livePricePerKg', code: 'NEGATIVE' },
    ]);
    expect(validateQuick({ ...VALID_QUICK, livePricePerKg: 0 }, VALID_COSTS)).toEqual([]);
  });

  it('percentual fora de [0, 100) é rejeitado nas duas bordas (três campos)', () => {
    expect(validateQuick({ ...VALID_QUICK, slaughterLossPct: -0.01 }, VALID_COSTS)).toEqual([
      { field: 'slaughterLossPct', code: 'PCT_OUT_OF_RANGE' },
    ]);
    expect(validateQuick({ ...VALID_QUICK, coolingLossPct: 100 }, VALID_COSTS)).toEqual([
      { field: 'coolingLossPct', code: 'PCT_OUT_OF_RANGE' },
    ]);
    expect(validateQuick({ ...VALID_QUICK, commercialAdjustmentPct: -1 }, VALID_COSTS)).toEqual([
      { field: 'commercialAdjustmentPct', code: 'PCT_OUT_OF_RANGE' },
    ]);
    expect(validateQuick({ ...VALID_QUICK, slaughterLossPct: 0 }, VALID_COSTS)).toEqual([]);
    expect(validateQuick({ ...VALID_QUICK, coolingLossPct: 99.99 }, VALID_COSTS)).toEqual([]);
    expect(validateQuick({ ...VALID_QUICK, commercialAdjustmentPct: 0 }, VALID_COSTS)).toEqual([]);
  });
});

describe('validateCosts', () => {
  it('valida somente o campo do modelo de abate ativo', () => {
    // perKg ativo: perHead pode ficar vazio.
    expect(validateCosts(VALID_COSTS)).toEqual([]);
    // perHead ativo: perKg pode ficar vazio.
    expect(
      validateCosts({
        ...VALID_COSTS,
        slaughterFeeKind: 'perHead',
        slaughterFeePerKg: null,
        slaughterFeePerHead: 50,
      }),
    ).toEqual([]);
    expect(
      validateCosts({ ...VALID_COSTS, slaughterFeeKind: 'perHead', slaughterFeePerHead: null }),
    ).toEqual([{ field: 'slaughterFeePerHead', code: 'REQUIRED' }]);
  });

  it('rejeita custos negativos', () => {
    expect(validateCosts({ ...VALID_COSTS, freight: -1 })).toEqual([
      { field: 'freight', code: 'NEGATIVE' },
    ]);
    expect(validateCosts({ ...VALID_COSTS, servicePerHead: -0.01 })).toEqual([
      { field: 'servicePerHead', code: 'NEGATIVE' },
    ]);
  });
});

describe('validateReal', () => {
  it('aceita o lote canônico', () => {
    expect(validateReal(VALID_REAL, VALID_COSTS)).toEqual([]);
  });

  it('descontos iguais ou maiores que a balança zeram o peso pago', () => {
    expect(validateReal({ ...VALID_REAL, discountsKg: 12_560 }, VALID_COSTS)).toEqual([
      { field: 'discountsKg', code: 'DISCOUNTS_EXCEED_SCALE' },
    ]);
  });

  it('peso abatido não pode superar o peso pago', () => {
    expect(validateReal({ ...VALID_REAL, slaughteredWeightKg: 12_341 }, VALID_COSTS)).toEqual([
      { field: 'slaughteredWeightKg', code: 'SLAUGHTERED_EXCEEDS_PAID' },
    ]);
  });

  it('peso recebido não pode superar o peso abatido', () => {
    expect(validateReal({ ...VALID_REAL, chilledWeightKg: 10_514 }, VALID_COSTS)).toEqual([
      { field: 'chilledWeightKg', code: 'CHILLED_EXCEEDS_SLAUGHTERED' },
    ]);
  });

  it('não empilha erros de ordenação quando um campo base está inválido', () => {
    const issues = validateReal({ ...VALID_REAL, scaleWeightKg: null }, VALID_COSTS);
    expect(issues).toEqual([{ field: 'scaleWeightKg', code: 'REQUIRED' }]);
  });
});

describe('buildQuickInput', () => {
  it('retorna null enquanto houver problema de validação', () => {
    expect(buildQuickInput({ ...VALID_QUICK, avgLiveWeightKg: null }, VALID_COSTS)).toBeNull();
  });

  it('constrói a entrada com os três conceitos separados', () => {
    const input = buildQuickInput(VALID_QUICK, VALID_COSTS);
    expect(input).not.toBeNull();
    expect(input?.avgLiveWeightKg).toBe(115);
    expect(input?.slaughterLossPct).toBe(17);
    expect(input?.coolingLossPct).toBe(2.5);
    expect(input?.commercialAdjustmentPct).toBe(7);
    expect(input?.costs.slaughterFee).toEqual({ kind: 'perKg', amountPerKg: 0.5 });
  });
});

describe('buildRealInput', () => {
  it('retorna null enquanto houver problema de validação', () => {
    expect(buildRealInput({ ...VALID_REAL, chilledWeightKg: 99_999 }, VALID_COSTS)).toBeNull();
  });

  it('constrói a entrada completa quando válida', () => {
    const input = buildRealInput(VALID_REAL, {
      ...VALID_COSTS,
      slaughterFeeKind: 'perHead',
      slaughterFeePerHead: 50,
    });
    expect(input).toMatchObject({
      animals: 110,
      scaleWeightKg: 12_560,
      costs: { slaughterFee: { kind: 'perHead', amountPerHead: 50 } },
    });
  });
});
