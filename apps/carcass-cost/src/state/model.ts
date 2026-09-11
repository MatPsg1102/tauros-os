// Modelo do estado persistido: formas em edição + premissas padrão.
// As premissas padrão (tela Configurações) alimentam lotes novos; o lote
// atual guarda os valores efetivamente em uso.

import type { CostsForm, QuickForm, RealForm, SlaughterFeeKind } from '../domain/validation.js';

export type CalculatorMode = 'quick' | 'real';

export interface DefaultSettings {
  readonly animals: number;
  readonly livePricePerKg: number;
  readonly slaughterLossPct: number;
  readonly coolingTransformPct: number;
  readonly slaughterFeeKind: SlaughterFeeKind;
  readonly slaughterFeePerKg: number;
  readonly slaughterFeePerHead: number;
  readonly servicePerHead: number;
  readonly freight: number;
}

export const DEFAULT_SETTINGS: DefaultSettings = {
  animals: 110,
  livePricePerKg: 5,
  slaughterLossPct: 20,
  coolingTransformPct: 7,
  slaughterFeeKind: 'perKg',
  slaughterFeePerKg: 0.5,
  slaughterFeePerHead: 50,
  servicePerHead: 3,
  freight: 150,
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
      liveWeightKg: null,
      livePricePerKg: settings.livePricePerKg,
      slaughterLossPct: settings.slaughterLossPct,
      coolingTransformPct: settings.coolingTransformPct,
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
      slaughterFeeKind: settings.slaughterFeeKind,
      slaughterFeePerKg: settings.slaughterFeePerKg,
      slaughterFeePerHead: settings.slaughterFeePerHead,
      servicePerHead: settings.servicePerHead,
      freight: settings.freight,
    },
  };
}

export function initialState(): CalculatorState {
  return { ...lotFromSettings(DEFAULT_SETTINGS), settings: DEFAULT_SETTINGS };
}
