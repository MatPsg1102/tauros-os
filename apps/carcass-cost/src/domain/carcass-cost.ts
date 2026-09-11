// Domínio puro do Custo da Carcaça — a matemática é a fonte de verdade:
// nenhum arredondamento interno (arredonda-se só na apresentação, ui/format)
// e quebras aplicadas SEQUENCIALMENTE, nunca somadas de forma simplista.
// Três conceitos distintos na estimativa:
// - quebra de ABATE (física, % sobre o peso vivo);
// - quebra de FRIO (física, % sobre o peso que restou APÓS o abate);
// - AJUSTE COMERCIAL/exportação (econômico, ex.: mãozinha/rabinho/banha) —
//   aplicado SOMENTE sobre o custo da matéria-prima convertido para carcaça,
//   nunca sobre abate/serviço/frete e nunca sobre o rendimento físico.

export interface LotCosts {
  /** Taxa de abate, em R$ por cabeça (sempre × quantidade de suínos). */
  readonly slaughterFeePerHead: number;
  /** Taxa de serviço, em R$ por suíno. */
  readonly servicePerHead: number;
  /** Diária do motorista, em R$ por VIAGEM (uma única vez por lote). */
  readonly driverDailyRate: number;
  /** Combustível, em R$ por VIAGEM (uma única vez por lote). */
  readonly fuelCost: number;
}

export interface QuickEstimateInput {
  readonly animals: number;
  /** Peso vivo MÉDIO por suíno (kg) — o total é derivado, nunca digitado. */
  readonly avgLiveWeightKg: number;
  readonly livePricePerKg: number;
  /** Quebra de abate, em % sobre o peso vivo (0 ≤ x < 100). */
  readonly slaughterLossPct: number;
  /** Quebra de frio, em % sobre o peso APÓS o abate (0 ≤ x < 100). */
  readonly coolingLossPct: number;
  /** Ajuste comercial/exportação, em % — só afeta o custo da matéria-prima. */
  readonly commercialAdjustmentPct: number;
  readonly costs: LotCosts;
}

export interface QuickEstimateResult {
  /** Cadeia física de pesos. */
  readonly totalLiveWeightKg: number;
  readonly weightAfterSlaughterKg: number;
  readonly estimatedCarcassKg: number;
  /** Frações 0–1 (a UI formata como %). */
  readonly yieldAfterSlaughter: number;
  readonly finalYield: number;
  readonly totalLossPct: number;
  /** Cadeia econômica por kg de carcaça. */
  readonly baseCarcassPerKg: number;
  readonly commercialAdjustmentPerKg: number;
  readonly equivalentPerKg: number;
  /** Custos adicionais da operação, em R$ do lote. */
  readonly slaughterCost: number;
  readonly serviceCost: number;
  /** Diária + combustível — custo da VIAGEM, nunca por cabeça. */
  readonly tripCost: number;
  readonly additionalCostsTotal: number;
  /** Adicionais ÷ peso FINAL da carcaça, R$/kg — SEM ajuste comercial. */
  readonly additionalPerKg: number;
  readonly costPerKg: number;
  readonly totalCost: number;
  readonly costPerAnimal: number;
}

export interface RealLotInput {
  readonly animals: number;
  readonly scaleWeightKg: number;
  readonly discountsKg: number;
  readonly slaughteredWeightKg: number;
  readonly chilledWeightKg: number;
  readonly livePricePerKg: number;
  readonly costs: LotCosts;
}

export interface RealLotResult {
  readonly paidWeightKg: number;
  /** Peso final recebido (após frio) — eco da entrada, base do custo/kg. */
  readonly finalWeightKg: number;
  readonly slaughterLossKg: number;
  /** Fração da quebra de abate sobre o peso pago. */
  readonly slaughterLossPct: number;
  readonly coolingLossKg: number;
  /** Fração da quebra de frio sobre o peso abatido. */
  readonly coolingLossPct: number;
  readonly totalLossKg: number;
  readonly totalLossPct: number;
  readonly finalYield: number;
  readonly animalsCost: number;
  readonly slaughterCost: number;
  readonly serviceCost: number;
  /** Diária + combustível — custo da VIAGEM, nunca por cabeça. */
  readonly tripCost: number;
  readonly additionalCostsTotal: number;
  readonly totalCost: number;
  /** Decomposição por kg final — mesma transparência do modo estimativa. */
  readonly basePerKg: number;
  readonly additionalPerKg: number;
  readonly costPerKg: number;
  readonly costPerAnimal: number;
}

// Acréscimos FIXOS por kg do custo final equivalente — somados UMA única vez,
// sem rateio por peso/viagem/cabeça e sem o ajuste comercial por cima.
/** Custo de oportunidade (descarga não realizada). */
export const OPPORTUNITY_COST_PER_KG = 0.05;
/** Imposto CENAR. */
export const CENAR_TAX_PER_KG = 0.01;
export const FIXED_SURCHARGES_PER_KG = OPPORTUNITY_COST_PER_KG + CENAR_TAX_PER_KG;

function fraction(pct: number): number {
  return pct / 100;
}

export function calculateTotalLiveWeight(animals: number, avgLiveWeightKg: number): number {
  return animals * avgLiveWeightKg;
}

export function calculateYieldAfterSlaughter(slaughterLossPct: number): number {
  return 1 - fraction(slaughterLossPct);
}

/**
 * Rendimento final = (1 − quebra de abate) × (1 − quebra de frio) —
 * sequencial: a quebra de frio incide sobre o peso que RESTOU do abate,
 * nunca sobre o peso vivo (17% + 2,5% ⇒ 80,925%, não 80,5%).
 */
export function calculateFinalYield(slaughterLossPct: number, coolingLossPct: number): number {
  return calculateYieldAfterSlaughter(slaughterLossPct) * (1 - fraction(coolingLossPct));
}

export function calculatePaidWeight(scaleWeightKg: number, discountsKg: number): number {
  return scaleWeightKg - discountsKg;
}

/**
 * Modo estimativa: premissas configuradas.
 * Física: total = animais × peso médio; após abate = total × (1 − q_abate);
 * carcaça final = após abate × (1 − q_frio).
 * Econômica: base = vivo ÷ (1 − q_abate) ÷ (1 − q_frio);
 * equivalente = base × (1 + ajuste comercial);
 * custo final = equivalente + (abate + serviço + viagem) ÷ carcaça final
 *   + acréscimos fixos (oportunidade R$ 0,05 + CENAR R$ 0,01, uma vez).
 * O ajuste comercial NUNCA incide sobre os custos adicionais nem sobre os
 * acréscimos fixos.
 * Pré-condição: entrada validada (validation.ts) — pesos > 0, animais ≥ 1.
 */
export function calculateQuickEstimate(input: QuickEstimateInput): QuickEstimateResult {
  const yieldAfterSlaughter = calculateYieldAfterSlaughter(input.slaughterLossPct);
  const coolingYield = 1 - fraction(input.coolingLossPct);
  const finalYield = calculateFinalYield(input.slaughterLossPct, input.coolingLossPct);

  const totalLiveWeightKg = calculateTotalLiveWeight(input.animals, input.avgLiveWeightKg);
  // Passo a passo, na ordem física real (não total × rendimento composto):
  // além de espelhar o processo, evita erro de meio-ulp na apresentação
  // (11.500 × 0,80925 cairia um hair abaixo de 9.306,375).
  const weightAfterSlaughterKg = totalLiveWeightKg * yieldAfterSlaughter;
  const estimatedCarcassKg = weightAfterSlaughterKg * coolingYield;

  const baseCarcassPerKg = input.livePricePerKg / yieldAfterSlaughter / coolingYield;
  const commercialAdjustmentPerKg = baseCarcassPerKg * fraction(input.commercialAdjustmentPct);
  const equivalentPerKg = baseCarcassPerKg + commercialAdjustmentPerKg;

  // Abate e serviço são por cabeça; diária e combustível são da VIAGEM
  // (uma única vez por lote). Tudo diluído pelo peso FINAL da carcaça,
  // sem o ajuste comercial por cima.
  const slaughterCost = input.animals * input.costs.slaughterFeePerHead;
  const serviceCost = input.animals * input.costs.servicePerHead;
  const tripCost = input.costs.driverDailyRate + input.costs.fuelCost;
  const additionalCostsTotal = slaughterCost + serviceCost + tripCost;
  const additionalPerKg = additionalCostsTotal / estimatedCarcassKg;

  const costPerKg = equivalentPerKg + additionalPerKg + FIXED_SURCHARGES_PER_KG;
  const totalCost = costPerKg * estimatedCarcassKg;

  return {
    totalLiveWeightKg,
    weightAfterSlaughterKg,
    estimatedCarcassKg,
    yieldAfterSlaughter,
    finalYield,
    totalLossPct: 1 - finalYield,
    baseCarcassPerKg,
    commercialAdjustmentPerKg,
    equivalentPerKg,
    slaughterCost,
    serviceCost,
    tripCost,
    additionalCostsTotal,
    additionalPerKg,
    costPerKg,
    totalCost,
    costPerAnimal: totalCost / input.animals,
  };
}

/**
 * Modo lote real: pesos efetivamente registrados (custo físico real — sem
 * ajuste comercial).
 * Pré-condição: entrada validada — peso pago > 0, abatido > 0, final > 0,
 * animais ≥ 1 e ordenação pago ≥ abatido ≥ final.
 */
export function calculateRealLot(input: RealLotInput): RealLotResult {
  const paidWeightKg = calculatePaidWeight(input.scaleWeightKg, input.discountsKg);
  const slaughterLossKg = paidWeightKg - input.slaughteredWeightKg;
  const coolingLossKg = input.slaughteredWeightKg - input.chilledWeightKg;
  const totalLossKg = paidWeightKg - input.chilledWeightKg;

  const animalsCost = paidWeightKg * input.livePricePerKg;
  const slaughterCost = input.animals * input.costs.slaughterFeePerHead;
  const serviceCost = input.animals * input.costs.servicePerHead;
  const tripCost = input.costs.driverDailyRate + input.costs.fuelCost;
  const additionalCostsTotal = slaughterCost + serviceCost + tripCost;
  const totalCost = animalsCost + additionalCostsTotal;

  const basePerKg = animalsCost / input.chilledWeightKg;
  const additionalPerKg = additionalCostsTotal / input.chilledWeightKg;

  return {
    paidWeightKg,
    finalWeightKg: input.chilledWeightKg,
    slaughterLossKg,
    slaughterLossPct: slaughterLossKg / paidWeightKg,
    coolingLossKg,
    coolingLossPct: coolingLossKg / input.slaughteredWeightKg,
    totalLossKg,
    totalLossPct: totalLossKg / paidWeightKg,
    finalYield: input.chilledWeightKg / paidWeightKg,
    animalsCost,
    slaughterCost,
    serviceCost,
    tripCost,
    additionalCostsTotal,
    totalCost,
    basePerKg,
    additionalPerKg,
    costPerKg: totalCost / input.chilledWeightKg,
    costPerAnimal: totalCost / input.animals,
  };
}

/**
 * "E se eu pagar…": preço atual ±0,50 e ±0,20 (com o atual no centro),
 * arredondado ao centavo; nunca gera preço negativo.
 */
export function whatIfPrices(currentPricePerKg: number): readonly number[] {
  const offsets = [-0.5, -0.2, 0, 0.2, 0.5];
  return offsets
    .map((offset) => Math.round((currentPricePerKg + offset) * 100) / 100)
    .filter((price) => price >= 0);
}
