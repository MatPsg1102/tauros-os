// Domínio puro do Custo da Carcaça — a matemática é a fonte de verdade:
// nenhum arredondamento interno (arredonda-se só na apresentação, ui/format)
// e quebras aplicadas SEQUENCIALMENTE, nunca somadas de forma simplista.
// "Quebra de frio" (perda física de peso) e "transformação" (acréscimo
// econômico do modo rápido) são conceitos DISTINTOS: a transformação afeta
// apenas o preço estimado; a quebra de frio afeta apenas o peso.

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
  readonly liveWeightKg: number;
  readonly livePricePerKg: number;
  /** Quebra de abate, em % (0 ≤ x < 100). */
  readonly slaughterLossPct: number;
  /** Quebra de frio FÍSICA, em % — só afeta o peso estimado. */
  readonly coolingLossPct: number;
  /** Transformação ECONÔMICA, em % — só afeta o preço estimado. */
  readonly transformationPct: number;
  readonly costs: LotCosts;
}

export interface QuickEstimateResult {
  /** Eco da entrada — peso vivo usado na estimativa. */
  readonly liveWeightKg: number;
  /** Frações 0–1 (a UI formata como %). */
  readonly yieldAfterSlaughter: number;
  readonly finalYield: number;
  readonly totalLossPct: number;
  readonly estimatedCarcassKg: number;
  /** Vivo → carcaça (quebra de abate + transformação), R$/kg. */
  readonly basePerKg: number;
  readonly slaughterPerKg: number;
  readonly servicePerKg: number;
  readonly freightPerKg: number;
  /** Abate + serviço + frete, R$/kg — o quanto os custos além do animal pesam. */
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
  /** Decomposição por kg final — mesma transparência do modo rápido. */
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

export function calculateYieldAfterSlaughter(slaughterLossPct: number): number {
  return 1 - fraction(slaughterLossPct);
}

/** Rendimento final = (1 − quebra de abate) × (1 − quebra de frio), sequencial. */
export function calculateFinalYield(slaughterLossPct: number, coolingLossPct: number): number {
  return calculateYieldAfterSlaughter(slaughterLossPct) * (1 - fraction(coolingLossPct));
}

export function calculatePaidWeight(scaleWeightKg: number, discountsKg: number): number {
  return scaleWeightKg - discountsKg;
}

/**
 * Modo rápido (Estimativa): premissas configuradas.
 * Preço: vivo ÷ (1 − quebra abate) × (1 + transformação) + custos rateados.
 * Peso: vivo × rendimento sequencial (quebra abate, depois quebra de frio).
 * Pré-condição: entrada validada (validation.ts) — pesos > 0, animais ≥ 1.
 */
export function calculateQuickEstimate(input: QuickEstimateInput): QuickEstimateResult {
  const yieldAfterSlaughter = calculateYieldAfterSlaughter(input.slaughterLossPct);
  const finalYield = calculateFinalYield(input.slaughterLossPct, input.coolingLossPct);
  const estimatedCarcassKg = input.liveWeightKg * finalYield;

  const basePerKg =
    (input.livePricePerKg / yieldAfterSlaughter) * (1 + fraction(input.transformationPct));
  const slaughterPerKg =
    input.costs.slaughterFee.kind === 'perKg'
      ? input.costs.slaughterFee.amountPerKg
      : (input.costs.slaughterFee.amountPerHead * input.animals) / estimatedCarcassKg;
  const servicePerKg = (input.costs.servicePerHead * input.animals) / estimatedCarcassKg;
  const freightPerKg = input.costs.freight / estimatedCarcassKg;
  const additionalPerKg = slaughterPerKg + servicePerKg + freightPerKg;
  const costPerKg = basePerKg + additionalPerKg;
  const totalCost = costPerKg * estimatedCarcassKg;

  return {
    liveWeightKg: input.liveWeightKg,
    yieldAfterSlaughter,
    finalYield,
    totalLossPct: 1 - finalYield,
    estimatedCarcassKg,
    basePerKg,
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
 * Modo lote real: pesos efetivamente registrados.
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
