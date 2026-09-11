// Controller da calculadora (padrão dos controllers do apps/web): a UI não
// calcula nada — consome view model pronto e dispara ações. Todo cálculo vem
// do domínio; toda persistência passa por storage.ts. As ações são closures
// do render atual (baratas de recriar) — nada de efeito colateral dentro de
// updater do React.

import { useEffect, useMemo, useState } from 'react';

import {
  calculateQuickEstimate,
  calculateRealLot,
  whatIfPrices,
  type QuickEstimateResult,
  type RealLotResult,
} from '../domain/carcass-cost.js';
import {
  buildQuickInput,
  buildRealInput,
  validateQuick,
  validateReal,
  type CostsForm,
  type QuickForm,
  type RealForm,
  type ValidationIssue,
} from '../domain/validation.js';
import {
  lotFromSettings,
  type CalculatorMode,
  type CalculatorState,
  type DefaultSettings,
  type HistoryEntry,
} from './model.js';
import { HISTORY_LIMIT, loadHistory, loadState, saveHistory, saveState } from './storage.js';

export interface WhatIfEntry {
  readonly price: number;
  readonly costPerKg: number | null;
  readonly current: boolean;
}

export interface CalculatorActions {
  readonly setMode: (mode: CalculatorMode) => void;
  readonly patchQuick: (patch: Partial<QuickForm>) => void;
  readonly patchReal: (patch: Partial<RealForm>) => void;
  readonly patchCosts: (patch: Partial<CostsForm>) => void;
  readonly patchSettings: (patch: Partial<DefaultSettings>) => void;
  /** Reinicia o lote atual a partir das premissas padrão configuradas. */
  readonly startNewLot: () => void;
  readonly applyPrice: (price: number) => void;
  readonly saveToHistory: () => void;
  readonly loadHistoryEntry: (id: string) => void;
  readonly removeHistoryEntry: (id: string) => void;
}

export interface CalculatorController {
  readonly state: CalculatorState;
  readonly quickIssues: readonly ValidationIssue[];
  readonly realIssues: readonly ValidationIssue[];
  readonly quickResult: QuickEstimateResult | null;
  readonly realResult: RealLotResult | null;
  readonly whatIf: readonly WhatIfEntry[];
  readonly history: readonly HistoryEntry[];
  readonly actions: CalculatorActions;
}

function quickCostAt(form: QuickForm, costs: CostsForm, price: number): number | null {
  const input = buildQuickInput({ ...form, livePricePerKg: price }, costs);
  return input === null ? null : calculateQuickEstimate(input).costPerKg;
}

function realCostAt(form: RealForm, costs: CostsForm, price: number): number | null {
  const input = buildRealInput({ ...form, livePricePerKg: price }, costs);
  return input === null ? null : calculateRealLot(input).costPerKg;
}

export function useCalculator(): CalculatorController {
  const [state, setState] = useState<CalculatorState>(loadState);
  const [history, setHistory] = useState<readonly HistoryEntry[]>(loadHistory);
  // Âncora do "E se eu pagar…": o preço DIGITADO. Tocar num chip aplica o
  // preço ao lote mas NÃO re-centra a lista — o preço original continua
  // visível como chip para voltar. Digitar um preço novo re-ancora.
  const [whatIfAnchor, setWhatIfAnchor] = useState<number | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const quickIssues = useMemo(
    () => validateQuick(state.quick, state.costs),
    [state.quick, state.costs],
  );
  const realIssues = useMemo(
    () => validateReal(state.real, state.costs),
    [state.real, state.costs],
  );

  const quickResult = useMemo(() => {
    const input = buildQuickInput(state.quick, state.costs);
    return input === null ? null : calculateQuickEstimate(input);
  }, [state.quick, state.costs]);

  const realResult = useMemo(() => {
    const input = buildRealInput(state.real, state.costs);
    return input === null ? null : calculateRealLot(input);
  }, [state.real, state.costs]);

  const currentPrice =
    state.mode === 'quick' ? state.quick.livePricePerKg : state.real.livePricePerKg;
  const anchorPrice = whatIfAnchor ?? currentPrice;

  const whatIf = useMemo<readonly WhatIfEntry[]>(() => {
    if (anchorPrice === null || currentPrice === null) return [];
    return whatIfPrices(anchorPrice).map((price) => ({
      price,
      costPerKg:
        state.mode === 'quick'
          ? quickCostAt(state.quick, state.costs, price)
          : realCostAt(state.real, state.costs, price),
      current: price === currentPrice,
    }));
  }, [anchorPrice, currentPrice, state.mode, state.quick, state.real, state.costs]);

  const saveToHistory = (): void => {
    let summary: HistoryEntry['summary'];
    if (state.mode === 'real') {
      summary = {
        animals: state.real.animals,
        referenceWeightKg: realResult === null ? null : realResult.paidWeightKg,
        finalWeightKg: realResult === null ? state.real.chilledWeightKg : realResult.finalWeightKg,
        livePricePerKg: state.real.livePricePerKg,
        costPerKg: realResult === null ? null : realResult.costPerKg,
      };
    } else {
      summary = {
        animals: state.quick.animals,
        referenceWeightKg: quickResult === null ? null : quickResult.totalLiveWeightKg,
        finalWeightKg: quickResult === null ? null : quickResult.estimatedCarcassKg,
        livePricePerKg: state.quick.livePricePerKg,
        costPerKg: quickResult === null ? null : quickResult.costPerKg,
      };
    }
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      mode: state.mode,
      quick: state.quick,
      real: state.real,
      costs: state.costs,
      summary,
    };
    setHistory((entries) => [entry, ...entries].slice(0, HISTORY_LIMIT));
  };

  const actions: CalculatorActions = {
    setMode: (nextMode) => {
      setWhatIfAnchor(null);
      setState((current) => ({ ...current, mode: nextMode }));
    },
    patchQuick: (patch) => {
      if ('livePricePerKg' in patch) setWhatIfAnchor(patch.livePricePerKg ?? null);
      setState((current) => ({ ...current, quick: { ...current.quick, ...patch } }));
    },
    patchReal: (patch) => {
      if ('livePricePerKg' in patch) setWhatIfAnchor(patch.livePricePerKg ?? null);
      setState((current) => ({ ...current, real: { ...current.real, ...patch } }));
    },
    patchCosts: (patch) => {
      setState((current) => ({ ...current, costs: { ...current.costs, ...patch } }));
    },
    patchSettings: (patch) => {
      setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
    },
    startNewLot: () => {
      setWhatIfAnchor(null);
      setState((current) => ({ ...lotFromSettings(current.settings), settings: current.settings }));
    },
    applyPrice: (price) => {
      // Fixa a âncora no valor vigente ANTES do toque: a lista de chips não
      // se move sob o dedo e o preço original permanece disponível.
      setWhatIfAnchor(anchorPrice);
      setState((current) =>
        current.mode === 'quick'
          ? { ...current, quick: { ...current.quick, livePricePerKg: price } }
          : { ...current, real: { ...current.real, livePricePerKg: price } },
      );
    },
    saveToHistory,
    loadHistoryEntry: (id) => {
      const entry = history.find((candidate) => candidate.id === id);
      if (entry === undefined) return;
      setWhatIfAnchor(null);
      setState((current) => ({
        ...current,
        mode: entry.mode,
        quick: entry.quick,
        real: entry.real,
        costs: entry.costs,
      }));
    },
    removeHistoryEntry: (id) => {
      setHistory((entries) => entries.filter((entry) => entry.id !== id));
    },
  };

  return { state, quickIssues, realIssues, quickResult, realResult, whatIf, history, actions };
}
