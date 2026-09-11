// Validação das entradas da calculadora — regras de domínio (valores
// impossíveis nunca chegam às fórmulas). As mensagens pt-BR ficam na UI
// (ui/field-messages.ts), indexadas pelo código do problema.

import type {
  LotCosts,
  QuickEstimateInput,
  RealLotInput,
  SlaughterFeeModel,
} from './carcass-cost.js';

export type SlaughterFeeKind = SlaughterFeeModel['kind'];

/** Formas em edição: campo vazio = null (contrato do NumberInput do DS). */
export interface QuickForm {
  readonly animals: number | null;
  readonly liveWeightKg: number | null;
  readonly livePricePerKg: number | null;
  readonly slaughterLossPct: number | null;
  /** Um único valor alimenta quebra de frio (peso) e transformação (preço). */
  readonly coolingTransformPct: number | null;
}

export interface RealForm {
  readonly animals: number | null;
  readonly scaleWeightKg: number | null;
  readonly discountsKg: number | null;
  readonly slaughteredWeightKg: number | null;
  readonly chilledWeightKg: number | null;
  readonly livePricePerKg: number | null;
}

export interface CostsForm {
  readonly slaughterFeeKind: SlaughterFeeKind;
  readonly slaughterFeePerKg: number | null;
  readonly slaughterFeePerHead: number | null;
  readonly servicePerHead: number | null;
  readonly freight: number | null;
}

export type IssueCode =
  | 'REQUIRED'
  | 'NEGATIVE'
  | 'NOT_POSITIVE'
  | 'NOT_INTEGER'
  | 'PCT_OUT_OF_RANGE'
  | 'DISCOUNTS_EXCEED_SCALE'
  | 'SLAUGHTERED_EXCEEDS_PAID'
  | 'CHILLED_EXCEEDS_SLAUGHTERED';

export interface ValidationIssue {
  readonly field: string;
  readonly code: IssueCode;
}

type FieldRule = (value: number) => IssueCode | null;

// Regras de campo EXPORTADAS: qualquer tela que valide um valor avulso (ex.:
// premissas padrão em Configurações) consome estas funções — nunca recria a
// regra localmente.
export function nonNegativeIssue(value: number): IssueCode | null {
  return value < 0 ? 'NEGATIVE' : null;
}

export function positiveIssue(value: number): IssueCode | null {
  return value <= 0 ? 'NOT_POSITIVE' : null;
}

export function percentageIssue(value: number): IssueCode | null {
  return value < 0 || value >= 100 ? 'PCT_OUT_OF_RANGE' : null;
}

export function headCountIssue(value: number): IssueCode | null {
  return value <= 0 ? 'NOT_POSITIVE' : Number.isInteger(value) ? null : 'NOT_INTEGER';
}

const nonNegative: FieldRule = nonNegativeIssue;
const positive: FieldRule = positiveIssue;
const percentage: FieldRule = percentageIssue;
const headCount: FieldRule = headCountIssue;

function check(
  issues: ValidationIssue[],
  field: string,
  value: number | null,
  rule: FieldRule,
): void {
  if (value === null) {
    issues.push({ field, code: 'REQUIRED' });
    return;
  }
  const code = rule(value);
  if (code !== null) issues.push({ field, code });
}

export function validateCosts(costs: CostsForm): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Só o campo do modelo ativo é validado — por kg e por cabeça nunca
  // valem ao mesmo tempo.
  if (costs.slaughterFeeKind === 'perKg') {
    check(issues, 'slaughterFeePerKg', costs.slaughterFeePerKg, nonNegative);
  } else {
    check(issues, 'slaughterFeePerHead', costs.slaughterFeePerHead, nonNegative);
  }
  check(issues, 'servicePerHead', costs.servicePerHead, nonNegative);
  check(issues, 'freight', costs.freight, nonNegative);
  return issues;
}

export function validateQuick(form: QuickForm, costs: CostsForm): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  check(issues, 'animals', form.animals, headCount);
  check(issues, 'liveWeightKg', form.liveWeightKg, positive);
  check(issues, 'livePricePerKg', form.livePricePerKg, nonNegative);
  check(issues, 'slaughterLossPct', form.slaughterLossPct, percentage);
  check(issues, 'coolingTransformPct', form.coolingTransformPct, percentage);
  issues.push(...validateCosts(costs));
  return issues;
}

export function validateReal(form: RealForm, costs: CostsForm): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  check(issues, 'animals', form.animals, headCount);
  check(issues, 'scaleWeightKg', form.scaleWeightKg, positive);
  check(issues, 'discountsKg', form.discountsKg, nonNegative);
  check(issues, 'slaughteredWeightKg', form.slaughteredWeightKg, positive);
  check(issues, 'chilledWeightKg', form.chilledWeightKg, positive);
  check(issues, 'livePricePerKg', form.livePricePerKg, nonNegative);

  // Ordenação dos pesos — verificada apenas entre campos já individualmente
  // válidos, para não empilhar erros derivados.
  const { scaleWeightKg, discountsKg, slaughteredWeightKg, chilledWeightKg } = form;
  if (scaleWeightKg !== null && scaleWeightKg > 0 && discountsKg !== null && discountsKg >= 0) {
    const paid = scaleWeightKg - discountsKg;
    if (paid <= 0) {
      issues.push({ field: 'discountsKg', code: 'DISCOUNTS_EXCEED_SCALE' });
    } else if (slaughteredWeightKg !== null && slaughteredWeightKg > paid) {
      issues.push({ field: 'slaughteredWeightKg', code: 'SLAUGHTERED_EXCEEDS_PAID' });
    }
  }
  if (
    slaughteredWeightKg !== null &&
    chilledWeightKg !== null &&
    chilledWeightKg > slaughteredWeightKg
  ) {
    issues.push({ field: 'chilledWeightKg', code: 'CHILLED_EXCEEDS_SLAUGHTERED' });
  }

  issues.push(...validateCosts(costs));
  return issues;
}

export function buildLotCosts(costs: CostsForm): LotCosts | null {
  if (validateCosts(costs).length > 0) return null;
  if (costs.servicePerHead === null || costs.freight === null) return null;
  let slaughterFee: SlaughterFeeModel;
  if (costs.slaughterFeeKind === 'perKg') {
    if (costs.slaughterFeePerKg === null) return null;
    slaughterFee = { kind: 'perKg', amountPerKg: costs.slaughterFeePerKg };
  } else {
    if (costs.slaughterFeePerHead === null) return null;
    slaughterFee = { kind: 'perHead', amountPerHead: costs.slaughterFeePerHead };
  }
  return { slaughterFee, servicePerHead: costs.servicePerHead, freight: costs.freight };
}

/** Constrói a entrada do modo rápido; null enquanto houver problema de validação. */
export function buildQuickInput(form: QuickForm, costs: CostsForm): QuickEstimateInput | null {
  if (validateQuick(form, costs).length > 0) return null;
  const lotCosts = buildLotCosts(costs);
  if (
    lotCosts === null ||
    form.animals === null ||
    form.liveWeightKg === null ||
    form.livePricePerKg === null ||
    form.slaughterLossPct === null ||
    form.coolingTransformPct === null
  ) {
    return null;
  }
  return {
    animals: form.animals,
    liveWeightKg: form.liveWeightKg,
    livePricePerKg: form.livePricePerKg,
    slaughterLossPct: form.slaughterLossPct,
    coolingLossPct: form.coolingTransformPct,
    transformationPct: form.coolingTransformPct,
    costs: lotCosts,
  };
}

/** Constrói a entrada do modo lote real; null enquanto houver problema de validação. */
export function buildRealInput(form: RealForm, costs: CostsForm): RealLotInput | null {
  if (validateReal(form, costs).length > 0) return null;
  const lotCosts = buildLotCosts(costs);
  if (
    lotCosts === null ||
    form.animals === null ||
    form.scaleWeightKg === null ||
    form.discountsKg === null ||
    form.slaughteredWeightKg === null ||
    form.chilledWeightKg === null ||
    form.livePricePerKg === null
  ) {
    return null;
  }
  return {
    animals: form.animals,
    scaleWeightKg: form.scaleWeightKg,
    discountsKg: form.discountsKg,
    slaughteredWeightKg: form.slaughteredWeightKg,
    chilledWeightKg: form.chilledWeightKg,
    livePricePerKg: form.livePricePerKg,
    costs: lotCosts,
  };
}
