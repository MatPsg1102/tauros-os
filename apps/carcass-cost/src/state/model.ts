// Modelo do estado persistido: formas em edição + premissas padrão.
// As premissas padrão (tela Configurações) alimentam lotes novos; o lote
// atual guarda os valores efetivamente em uso.

import type { CostsForm, QuickForm, RealForm } from '../domain/validation.js';

export type CalculatorMode = 'quick' | 'real';

export interface DefaultSettings {
  readonly animals: number;
  readonly livePricePerKg: number;
  readonly slaughterLossPct: number;
  readonly coolingLossPct: number;
  readonly commercialAdjustmentPct: number;
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
  commercialAdjustmentPct: 7,
  slaughterFeePerHead: 50,
  servicePerHead: 3,
  driverDailyRate: 150,
  fuelCost: 0,
};

export interface CalculatorState {
  readonly mode: CalculatorMode;
  readonly quick: QuickForm;
  readonly real: RealForm;
  readonly costs: CostsForm;
  readonly settings: DefaultSettings;
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

export function lotFromSettings(settings: DefaultSettings): Omit<CalculatorState, 'settings'> {
  return {
    mode: 'quick',
    quick: {
      animals: settings.animals,
      avgLiveWeightKg: null,
      livePricePerKg: settings.livePricePerKg,
      slaughterLossPct: settings.slaughterLossPct,
      coolingLossPct: settings.coolingLossPct,
      commercialAdjustmentPct: settings.commercialAdjustmentPct,
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
  return { ...lotFromSettings(DEFAULT_SETTINGS), settings: DEFAULT_SETTINGS };
}
