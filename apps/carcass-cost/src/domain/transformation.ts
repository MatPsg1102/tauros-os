// Domínio da aba Transformação — INDICADOR ECONÔMICO DE TRANSFORMAÇÃO.
// No suíno mineiro recebemos subprodutos (cabeça, retalho, banha, papada,
// mãozinha, orelha, rabinho) que NÃO vêm na carcaça de exportação. Eles são
// parte física do suíno mas se vendem por valores diferentes do preço/kg da
// carcaça. O indicador mede a PERDA econômica dessa diferença:
//   perda = (peso dos subprodutos × preço da carcaça) − valor recuperado
//   indicador = perda ÷ valor da carcaça de exportação
// Assim, quanto MAIOR a recuperação (preço de venda), MENOR o indicador.
// Não é quebra física; não é o antigo 7% fixo; não há calibração no 7%.
// Reusa o rendimento físico do motor V2 (calculateFinalYield).

import { calculateFinalYield } from './carcass-cost.js';

export type SubproductKey = 'head' | 'headTrim' | 'lard' | 'jowl' | 'trotter' | 'ear' | 'tail';

/** Ordem oficial de exibição dos subprodutos (PELE não participa). */
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

/** Referência física padrão (por suíno) usada quando a Estimativa ainda não
 * tem um peso médio informado. Quebras fixas (não seguem premissas de lote). */
export const REFERENCE_LIVE_WEIGHT_KG = 115;
export const REFERENCE_SLAUGHTER_LOSS_PCT = 17;
export const REFERENCE_COOLING_LOSS_PCT = 2.5;
export const DEFAULT_EXPORT_CARCASS_PRICE_PER_KG = 7.7;

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
  /** Peso vivo de referência (compartilhado da Estimativa; fallback 115). */
  readonly referenceLiveWeightKg: number;
  readonly slaughterLossPct: number;
  readonly coolingLossPct: number;
}

export interface SubproductValue {
  readonly key: SubproductKey;
  readonly weightKg: number;
  readonly pricePerKg: number;
  /** Valor recuperado na venda = peso × preço de venda. */
  readonly recoveredBRL: number;
}

export interface TransformationResult {
  readonly items: readonly SubproductValue[];
  readonly totalWeightKg: number;
  readonly totalRecoveredBRL: number;
  /** Valor teórico dos subprodutos se valorizados pelo preço da carcaça. */
  readonly theoreticalValueBRL: number;
  /** Perda econômica = teórico − recuperado. */
  readonly economicLossBRL: number;
  readonly exportCarcassWeightKg: number;
  readonly exportCarcassValueBRL: number;
  /** Indicador econômico em PONTOS PERCENTUAIS (ex.: 1.63). null se inválido
   * (denominador ≤ 0) — a Estimativa trata o nulo como pendente, sem 7%. */
  readonly indicatorPct: number | null;
}

/**
 * perda = (peso total dos subprodutos × preço da carcaça) − valor recuperado;
 * indicador = perda ÷ valor da carcaça de exportação;
 * valor da carcaça = peso vivo × rendimento físico × preço da carcaça.
 * Denominador ≤ 0 ⇒ indicador null (dados inválidos, não inventa percentual).
 */
export function calculateTransformation(input: TransformationInput): TransformationResult {
  const items: SubproductValue[] = SUBPRODUCT_KEYS.map((key) => {
    const amount = input.subproducts[key];
    return {
      key,
      weightKg: amount.weightKg,
      pricePerKg: amount.pricePerKg,
      recoveredBRL: amount.weightKg * amount.pricePerKg,
    };
  });

  const totalWeightKg = items.reduce((sum, item) => sum + item.weightKg, 0);
  const totalRecoveredBRL = items.reduce((sum, item) => sum + item.recoveredBRL, 0);
  const theoreticalValueBRL = totalWeightKg * input.exportCarcassPricePerKg;
  const economicLossBRL = theoreticalValueBRL - totalRecoveredBRL;

  const finalYield = calculateFinalYield(input.slaughterLossPct, input.coolingLossPct);
  const exportCarcassWeightKg = input.referenceLiveWeightKg * finalYield;
  const exportCarcassValueBRL = exportCarcassWeightKg * input.exportCarcassPricePerKg;

  const indicatorPct =
    exportCarcassValueBRL > 0 ? (economicLossBRL / exportCarcassValueBRL) * 100 : null;

  return {
    items,
    totalWeightKg,
    totalRecoveredBRL,
    theoreticalValueBRL,
    economicLossBRL,
    exportCarcassWeightKg,
    exportCarcassValueBRL,
    indicatorPct,
  };
}
