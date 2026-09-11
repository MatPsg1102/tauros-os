// Domínio puro do Custo da Carcaça — a matemática é a fonte de verdade:
// nenhum arredondamento interno (arredonda-se só na apresentação, ui/format)
// e quebras aplicadas SEQUENCIALMENTE, nunca somadas de forma simplista.
// Três conceitos distintos na estimativa:
// - quebra de ABATE (física, % sobre o peso vivo);
// - quebra de FRIO (física, % sobre o peso que restou APÓS o abate);
// - AJUSTE COMERCIAL/exportação (econômico, ex.: mãozinha/rabinho/banha) —
//   aplicado SOMENTE sobre o custo da matéria-prima convertido para carcaça,
//   nunca sobre abate/serviço/frete e nunca sobre o rendimento físico.

export type SlaughterFeeModel =
  | { readonly kind: 'perKg'; readonly amountPerKg: number }
  | { readonly kind: 'perHead'; readonly amountPerHead: number };

export interface LotCosts {
  readonly slaughterFee: SlaughterFeeModel;
  /** Taxa de serviço, em R$ por suíno. */
  readonly servicePerHead: number;
  /** Frete / diária do motorista, em R$ por lote. */
  readonly freight: number;
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
  readonly slaughterPerKg: number;
  readonly servicePerKg: number;
  readonly freightPerKg: number;
  /** Abate + serviço + frete, R$/kg — SEM ajuste comercial por cima. */
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
  readonly freightCost: number;
  readonly totalCost: number;
  /** Decomposição por kg final — mesma transparência do modo estimativa. */
  readonly basePerKg: number;
  readonly slaughterPerKg: number;
  readonly servicePerKg: number;
  readonly freightPerKg: number;
  readonly additionalPerKg: number;
  readonly costPerKg: number;
  readonly costPerAnimal: number;
}

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
 * custo final = equivalente + (abate + serviço + frete) ÷ carcaça final.
 * O ajuste comercial NUNCA incide sobre os custos adicionais.
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

  const slaughterPerKg =
    input.costs.slaughterFee.kind === 'perKg'
      ? input.costs.slaughterFee.amountPerKg
      : (input.costs.slaughterFee.amountPerHead * input.animals) / estimatedCarcassKg;
  const servicePerKg = (input.costs.servicePerHead * input.animals) / estimatedCarcassKg;
  const freightPerKg = input.costs.freight / estimatedCarcassKg;
  const additionalPerKg = slaughterPerKg + servicePerKg + freightPerKg;

  const costPerKg = equivalentPerKg + additionalPerKg;
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
    slaughterPerKg,
    servicePerKg,
    freightPerKg,
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
  const slaughterCost =
    input.costs.slaughterFee.kind === 'perKg'
      ? input.chilledWeightKg * input.costs.slaughterFee.amountPerKg
      : input.animals * input.costs.slaughterFee.amountPerHead;
  const serviceCost = input.animals * input.costs.servicePerHead;
  const freightCost = input.costs.freight;
  const totalCost = animalsCost + slaughterCost + serviceCost + freightCost;

  const basePerKg = animalsCost / input.chilledWeightKg;
  const slaughterPerKg = slaughterCost / input.chilledWeightKg;
  const servicePerKg = serviceCost / input.chilledWeightKg;
  const freightPerKg = freightCost / input.chilledWeightKg;

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
    freightCost,
    totalCost,
    basePerKg,
    slaughterPerKg,
    servicePerKg,
    freightPerKg,
    additionalPerKg: slaughterPerKg + servicePerKg + freightPerKg,
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
