// Domínio da aba Transformação — indicador ECONÔMICO dos subprodutos que
// acompanham a carcaça. NÃO é quebra/perda/rendimento: é a razão entre o valor
// de venda dos subprodutos (por suíno) e o valor da carcaça de exportação
// (por suíno de referência). Esse indicador substitui o antigo 7% fixo como o
// ajuste comercial da Estimativa. Reusa o rendimento físico do motor V2
// (calculateFinalYield) — não recalcula quebra por conta própria.

import { calculateFinalYield } from './carcass-cost.js';

export type SubproductKey = 'head' | 'headTrim' | 'lard' | 'jowl' | 'trotter' | 'ear' | 'tail';

/** Ordem oficial de exibição dos subprodutos. */
export const SUBPRODUCT_KEYS: readonly SubproductKey[] = [
  'head',
  'headTrim',
  'lard',
  'jowl',
  'trotter',
  'ear',
  'tail',
];

export interface SubproductAmount {
  readonly weightKg: number;
  readonly pricePerKg: number;
}

/** Referência física padrão (por suíno) para o valor da carcaça de exportação —
 * fixa, independente das premissas editáveis dos lotes. */
export const REFERENCE_LIVE_WEIGHT_KG = 115;
export const REFERENCE_SLAUGHTER_LOSS_PCT = 17;
export const REFERENCE_COOLING_LOSS_PCT = 2.5;
export const DEFAULT_EXPORT_CARCASS_PRICE_PER_KG = 7.7;
/** Fallback quando não há subprodutos/carcaça válidos — não quebra a Estimativa. */
export const DEFAULT_COMMERCIAL_ADJUSTMENT_PCT = 7;

/** Cadastro inicial dos subprodutos (peso kg, preço R$/kg). */
export const DEFAULT_SUBPRODUCTS: Readonly<Record<SubproductKey, SubproductAmount>> = {
  head: { weightKg: 2.4, pricePerKg: 0.5 },
  headTrim: { weightKg: 0.6, pricePerKg: 5 },
  lard: { weightKg: 0.8, pricePerKg: 4.99 },
  jowl: { weightKg: 2.5, pricePerKg: 12.99 },
  trotter: { weightKg: 0.6, pricePerKg: 4.99 },
  ear: { weightKg: 0.8, pricePerKg: 2.99 },
  tail: { weightKg: 0.3, pricePerKg: 12.99 },
};

export interface TransformationInput {
  readonly subproducts: Readonly<Record<SubproductKey, SubproductAmount>>;
  readonly exportCarcassPricePerKg: number;
  /** Referência física (padrões da Estimativa). */
  readonly referenceLiveWeightKg: number;
  readonly slaughterLossPct: number;
  readonly coolingLossPct: number;
}

export interface SubproductValue {
  readonly key: SubproductKey;
  readonly weightKg: number;
  readonly pricePerKg: number;
  readonly valueBRL: number;
}

export interface TransformationResult {
  readonly items: readonly SubproductValue[];
  readonly totalWeightKg: number;
  readonly totalValueBRL: number;
  readonly exportCarcassWeightKg: number;
  readonly exportCarcassValueBRL: number;
  /** Indicador econômico em PONTOS PERCENTUAIS (ex.: 6.9705). null se inválido. */
  readonly indicatorPct: number | null;
}

/**
 * Indicador = valor total dos subprodutos ÷ valor da carcaça de exportação.
 * Carcaça de exportação = peso vivo de referência × rendimento físico (mesma
 * cadeia do motor V2) × preço de exportação. Denominador ≤ 0 ⇒ indicador null.
 */
export function calculateTransformation(input: TransformationInput): TransformationResult {
  const items: SubproductValue[] = SUBPRODUCT_KEYS.map((key) => {
    const amount = input.subproducts[key];
    return {
      key,
      weightKg: amount.weightKg,
      pricePerKg: amount.pricePerKg,
      valueBRL: amount.weightKg * amount.pricePerKg,
    };
  });

  const totalWeightKg = items.reduce((sum, item) => sum + item.weightKg, 0);
  const totalValueBRL = items.reduce((sum, item) => sum + item.valueBRL, 0);

  const finalYield = calculateFinalYield(input.slaughterLossPct, input.coolingLossPct);
  const exportCarcassWeightKg = input.referenceLiveWeightKg * finalYield;
  const exportCarcassValueBRL = exportCarcassWeightKg * input.exportCarcassPricePerKg;

  const indicatorPct =
    exportCarcassValueBRL > 0 ? (totalValueBRL / exportCarcassValueBRL) * 100 : null;

  return {
    items,
    totalWeightKg,
    totalValueBRL,
    exportCarcassWeightKg,
    exportCarcassValueBRL,
    indicatorPct,
  };
}

/**
 * Percentual de ajuste comercial que a Estimativa deve usar: o indicador
 * calculado quando válido; senão o fallback padrão (7%) — nunca quebra o motor.
 */
export function resolveCommercialAdjustmentPct(result: TransformationResult): number {
  return result.indicatorPct === null ? DEFAULT_COMMERCIAL_ADJUSTMENT_PCT : result.indicatorPct;
}
