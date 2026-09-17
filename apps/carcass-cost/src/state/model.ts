// Modelo do estado persistido: formas em edição + premissas padrão +
// transformação (subprodutos) + desossa (análise comercial). As premissas
// padrão (tela Configurações) alimentam lotes novos; o lote atual guarda os
// valores efetivamente em uso; a transformação e a desossa são análises
// globais (como as premissas padrão) — não reiniciam ao começar um lote novo.
// Transformação e Desossa são INDEPENDENTES: nada da desossa alimenta o
// indicador de transformação nem o custo equivalente da carcaça.

import type { CostsForm, QuickForm, RealForm } from '../domain/validation.js';
import {
  DEFAULT_EXPORT_CARCASS_PRICE_PER_KG,
  DEFAULT_SUBPRODUCTS,
  SUBPRODUCT_KEYS,
  type SubproductKey,
} from '../domain/transformation.js';
import {
  DEFAULT_DEBONING_CARCASS,
  DEFAULT_DEBONING_PRODUCTS,
  type DeboningForm,
} from '../domain/deboning.js';

export type CalculatorMode = 'quick' | 'real';

export interface DefaultSettings {
  readonly animals: number;
  readonly livePricePerKg: number;
  readonly slaughterLossPct: number;
  readonly coolingLossPct: number;
  readonly slaughterFeePerHead: number;
  readonly servicePerHead: number;
  readonly driverDailyRate: number;
  readonly fuelCost: number;
}

export const DEFAULT_SETTINGS: DefaultSettings = {
  animals: 110,
  livePricePerKg: 5,
  slaughterLossPct: 17,
  coolingLossPct: 2.5,
  slaughterFeePerHead: 50,
  servicePerHead: 3,
  driverDailyRate: 150,
  fuelCost: 0,
};

/** Item de subproduto em edição (campo vazio = null). */
export interface SubproductForm {
  readonly weightKg: number | null;
  readonly pricePerKg: number | null;
}

export interface TransformationForm {
  readonly subproducts: Readonly<Record<SubproductKey, SubproductForm>>;
  readonly exportCarcassPricePerKg: number | null;
}

export const DEFAULT_TRANSFORMATION: TransformationForm = {
  subproducts: Object.fromEntries(
    SUBPRODUCT_KEYS.map((key) => [key, { ...DEFAULT_SUBPRODUCTS[key] }]),
  ) as Record<SubproductKey, SubproductForm>,
  exportCarcassPricePerKg: DEFAULT_EXPORT_CARCASS_PRICE_PER_KG,
};

/** Desossa inicial = estatística comercial atual da operação (cenário da
 * planilha): a tela abre com a referência preenchida e o operador ajusta.
 * O valor inicial da carcaça NÃO é estado: deriva de peso × custo do kg. */
export const DEFAULT_DEBONING: DeboningForm = {
  carcassWeightKg: DEFAULT_DEBONING_CARCASS.weightKg,
  carcassCostPerKg: DEFAULT_DEBONING_CARCASS.costPerKg,
  products: DEFAULT_DEBONING_PRODUCTS.map((product) => ({ ...product })),
  statistic: null,
};

export interface CalculatorState {
  readonly mode: CalculatorMode;
  readonly quick: QuickForm;
  readonly real: RealForm;
  readonly costs: CostsForm;
  readonly settings: DefaultSettings;
  readonly transformation: TransformationForm;
  readonly deboning: DeboningForm;
}

/** Snapshot de um lote salvo no histórico (recarregável na calculadora). */
export interface HistoryEntry {
  readonly id: string;
  readonly savedAt: string;
  readonly mode: CalculatorMode;
  readonly quick: QuickForm;
  readonly real: RealForm;
  readonly costs: CostsForm;
  readonly summary: {
    readonly animals: number | null;
    /** Peso vivo (estimativa) ou peso pago (lote real). */
    readonly referenceWeightKg: number | null;
    readonly finalWeightKg: number | null;
    readonly livePricePerKg: number | null;
    readonly costPerKg: number | null;
  };
}

/** Snapshot de uma análise de desossa salva no histórico (recarregável na
 * tela Desossa). Os números do resumo vêm do domínio no momento do salvar. */
export interface DeboningHistoryEntry {
  readonly id: string;
  readonly savedAt: string;
  /** Nome dado pelo operador ao salvar; vazio em análises antigas (a UI mostra a data). */
  readonly name: string;
  readonly deboning: DeboningForm;
  readonly summary: {
    readonly carcassWeightKg: number | null;
    readonly carcassValueBRL: number | null;
    readonly commercialValueBRL: number | null;
    readonly commercialGainBRL: number | null;
    readonly marginPct: number | null;
    readonly productCount: number;
  };
}

export function lotFromSettings(
  settings: DefaultSettings,
): Omit<CalculatorState, 'settings' | 'transformation' | 'deboning'> {
  return {
    mode: 'quick',
    quick: {
      animals: settings.animals,
      avgLiveWeightKg: null,
      livePricePerKg: settings.livePricePerKg,
      slaughterLossPct: settings.slaughterLossPct,
      coolingLossPct: settings.coolingLossPct,
    },
    real: {
      animals: settings.animals,
      scaleWeightKg: null,
      discountsKg: 0,
      slaughteredWeightKg: null,
      chilledWeightKg: null,
      livePricePerKg: settings.livePricePerKg,
    },
    costs: {
      slaughterFeePerHead: settings.slaughterFeePerHead,
      servicePerHead: settings.servicePerHead,
      driverDailyRate: settings.driverDailyRate,
      fuelCost: settings.fuelCost,
    },
  };
}

export function initialState(): CalculatorState {
  return {
    ...lotFromSettings(DEFAULT_SETTINGS),
    settings: DEFAULT_SETTINGS,
    transformation: DEFAULT_TRANSFORMATION,
    deboning: DEFAULT_DEBONING,
  };
}
