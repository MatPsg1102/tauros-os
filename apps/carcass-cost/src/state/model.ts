// Modelo do estado persistido: formas em edição + premissas padrão +
// transformação (subprodutos). As premissas padrão (tela Configurações)
// alimentam lotes novos; o lote atual guarda os valores efetivamente em uso;
// a transformação é uma premissa global (como as premissas padrão) — não
// reinicia ao começar um lote novo.

import type { CostsForm, QuickForm, RealForm } from '../domain/validation.js';
import {
  DEFAULT_EXPORT_CARCASS_PRICE_PER_KG,
  DEFAULT_SUBPRODUCTS,
  SUBPRODUCT_KEYS,
  type SubproductKey,
} from '../domain/transformation.js';

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

export interface CalculatorState {
  readonly mode: CalculatorMode;
  readonly quick: QuickForm;
  readonly real: RealForm;
  readonly costs: CostsForm;
  readonly settings: DefaultSettings;
  readonly transformation: TransformationForm;
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

export function lotFromSettings(
  settings: DefaultSettings,
): Omit<CalculatorState, 'settings' | 'transformation'> {
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
  };
}
