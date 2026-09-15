// Domínio da Desossa — INDICADOR COMERCIAL DA DESOSSA. Análise independente
// da Transformação (indicador econômico dos subprodutos): nada daqui alimenta
// a Estimativa, o ajuste comercial nem o custo equivalente da carcaça.
// Reproduz a estatística comercial da operação (planilha): a carcaça entra
// com peso e valor inicial; cada produto da desossa tem peso e preço de
// venda; o valor comercial é a soma dos produtos; o acréscimo é o que a
// desossa gera acima do valor inicial; a margem é o acréscimo sobre o valor
// comercial.
//   valor do produto = peso × preço/kg
//   percentual       = peso ÷ peso da carcaça × 100
//   valor comercial  = Σ valor dos produtos
//   acréscimo        = valor comercial − valor inicial da carcaça
//   margem           = acréscimo ÷ valor comercial × 100
// Nada é arredondado aqui (apresentação em 2 casas só em ui/format.ts); a
// planilha arredonda linha a linha, o app soma com precisão total — o valor
// exibido coincide (ver deboning.test.ts).

import { nonNegativeIssue, positiveIssue, type ValidationIssue } from './validation.js';

export interface DeboningProductAmount {
  readonly id: string;
  readonly name: string;
  readonly weightKg: number;
  readonly pricePerKg: number;
}

export interface DeboningInput {
  readonly carcassWeightKg: number;
  readonly carcassValueBRL: number;
  readonly products: readonly DeboningProductAmount[];
}

export interface DeboningProductValue {
  readonly id: string;
  readonly name: string;
  readonly weightKg: number;
  readonly pricePerKg: number;
  /** valor do produto = peso × preço/kg. */
  readonly totalBRL: number;
  /** Participação no peso da carcaça em PONTOS PERCENTUAIS (ex.: 26.23);
   * null se o peso da carcaça for ≤ 0 (não inventa percentual). */
  readonly sharePct: number | null;
}

export interface DeboningResult {
  readonly items: readonly DeboningProductValue[];
  readonly carcassWeightKg: number;
  readonly carcassValueBRL: number;
  readonly productsWeightKg: number;
  /** Σ valor dos produtos. */
  readonly commercialValueBRL: number;
  /** valor comercial − valor inicial da carcaça (pode ser negativo). */
  readonly commercialGainBRL: number;
  /** acréscimo ÷ valor comercial × 100; null se o valor comercial for ≤ 0. */
  readonly marginPct: number | null;
  /** peso dos produtos ÷ peso da carcaça × 100 (pode passar de 100 — dado
   * real da planilha, nunca corrigido); null se o peso da carcaça for ≤ 0. */
  readonly weightYieldPct: number | null;
}

/** Carcaça de referência da estatística atual (cenário da planilha). */
export const DEFAULT_DEBONING_CARCASS = { weightKg: 1128.1, valueBRL: 13029.56 } as const;

/** Produtos da estatística comercial atual, na ordem da planilha. Cabeça,
 * papada, banha, mãozinha, orelha etc. NÃO entram aqui — pertencem à
 * Transformação. */
export const DEFAULT_DEBONING_PRODUCTS: readonly DeboningProductAmount[] = [
  { id: 'pernil', name: 'Pernil', weightKg: 295.86, pricePerKg: 15 },
  { id: 'lombo', name: 'Lombo', weightKg: 142.1, pricePerKg: 19.8 },
  { id: 'pazinha', name: 'Pazinha', weightKg: 124.6, pricePerKg: 14.29 },
  { id: 'costelinha', name: 'Costelinha', weightKg: 181.15, pricePerKg: 19.8 },
  { id: 'copa-lombo', name: 'Copa lombo', weightKg: 42.27, pricePerKg: 15.99 },
  { id: 'toucinho-torresmo', name: 'Toucinho torresmo', weightKg: 123.67, pricePerKg: 11.6 },
  { id: 'sua', name: 'Suã', weightKg: 24, pricePerKg: 0.7 },
  { id: 'pezinho', name: 'Pezinho', weightKg: 15.2, pricePerKg: 2.99 },
  { id: 'barriga', name: 'Barriga', weightKg: 88.76, pricePerKg: 19.8 },
  { id: 'rabinho', name: 'Rabinho', weightKg: 4.2, pricePerKg: 11.99 },
  { id: 'retalho', name: 'Retalho', weightKg: 15, pricePerKg: 11.99 },
  { id: 'osso', name: 'Osso', weightKg: 72, pricePerKg: 0.7 },
];

export function calculateDeboning(input: DeboningInput): DeboningResult {
  const carcassPositive = input.carcassWeightKg > 0;
  const items: DeboningProductValue[] = input.products.map((product) => ({
    id: product.id,
    name: product.name,
    weightKg: product.weightKg,
    pricePerKg: product.pricePerKg,
    totalBRL: product.weightKg * product.pricePerKg,
    sharePct: carcassPositive ? (product.weightKg / input.carcassWeightKg) * 100 : null,
  }));

  const productsWeightKg = items.reduce((sum, item) => sum + item.weightKg, 0);
  const commercialValueBRL = items.reduce((sum, item) => sum + item.totalBRL, 0);
  const commercialGainBRL = commercialValueBRL - input.carcassValueBRL;
  const marginPct = commercialValueBRL > 0 ? (commercialGainBRL / commercialValueBRL) * 100 : null;
  const weightYieldPct = carcassPositive ? (productsWeightKg / input.carcassWeightKg) * 100 : null;

  return {
    items,
    carcassWeightKg: input.carcassWeightKg,
    carcassValueBRL: input.carcassValueBRL,
    productsWeightKg,
    commercialValueBRL,
    commercialGainBRL,
    marginPct,
    weightYieldPct,
  };
}

// --- Forma em edição (campo vazio = null, contrato do NumberInput do DS) ---

export interface DeboningProductForm {
  readonly id: string;
  readonly name: string;
  readonly weightKg: number | null;
  readonly pricePerKg: number | null;
}

export interface DeboningForm {
  readonly carcassWeightKg: number | null;
  readonly carcassValueBRL: number | null;
  readonly products: readonly DeboningProductForm[];
}

/** Campo de um produto na lista de problemas: `product:<id>:weightKg`. */
export function deboningProductField(id: string, key: 'weightKg' | 'pricePerKg'): string {
  return `product:${id}:${key}`;
}

/**
 * Carcaça: peso obrigatório e > 0 (denominador dos percentuais); valor
 * inicial obrigatório e ≥ 0. Produto: campo vazio ainda não foi pesado /
 * precificado e contribui 0 (como a célula vazia da planilha); valor
 * negativo é inválido — nenhum resultado é inventado enquanto existir.
 */
export function validateDeboning(form: DeboningForm): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (form.carcassWeightKg === null) {
    issues.push({ field: 'carcassWeightKg', code: 'REQUIRED' });
  } else {
    const code = positiveIssue(form.carcassWeightKg);
    if (code !== null) issues.push({ field: 'carcassWeightKg', code });
  }
  if (form.carcassValueBRL === null) {
    issues.push({ field: 'carcassValueBRL', code: 'REQUIRED' });
  } else {
    const code = nonNegativeIssue(form.carcassValueBRL);
    if (code !== null) issues.push({ field: 'carcassValueBRL', code });
  }
  for (const product of form.products) {
    for (const key of ['weightKg', 'pricePerKg'] as const) {
      const value = product[key];
      if (value === null) continue;
      const code = nonNegativeIssue(value);
      if (code !== null) issues.push({ field: deboningProductField(product.id, key), code });
    }
  }
  return issues;
}

/** Constrói a entrada da desossa; null enquanto houver problema de validação. */
export function buildDeboningInput(form: DeboningForm): DeboningInput | null {
  if (validateDeboning(form).length > 0) return null;
  if (form.carcassWeightKg === null || form.carcassValueBRL === null) return null;
  return {
    carcassWeightKg: form.carcassWeightKg,
    carcassValueBRL: form.carcassValueBRL,
    products: form.products.map((product) => ({
      id: product.id,
      name: product.name,
      weightKg: product.weightKg ?? 0,
      pricePerKg: product.pricePerKg ?? 0,
    })),
  };
}
