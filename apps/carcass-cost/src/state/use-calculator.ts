// Controller da calculadora (padrão dos controllers do apps/web): a UI não
// calcula nada — consome view model pronto e dispara ações. Todo cálculo vem
// do domínio; toda persistência passa por storage.ts. As ações são closures
// do render atual (baratas de recriar) — nada de efeito colateral dentro de
// updater do React.

import { useEffect, useMemo, useState } from 'react';

import {
  calculateQuickEstimate,
  calculateRealLot,
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

export interface CalculatorActions {
  readonly setMode: (mode: CalculatorMode) => void;
  readonly patchQuick: (patch: Partial<QuickForm>) => void;
  readonly patchReal: (patch: Partial<RealForm>) => void;
  readonly patchCosts: (patch: Partial<CostsForm>) => void;
  readonly patchSettings: (patch: Partial<DefaultSettings>) => void;
  /** Reinicia o lote atual a partir das premissas padrão configuradas. */
  readonly startNewLot: () => void;
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
  readonly history: readonly HistoryEntry[];
  readonly actions: CalculatorActions;
}

export function useCalculator(): CalculatorController {
  const [state, setState] = useState<CalculatorState>(loadState);
  const [history, setHistory] = useState<readonly HistoryEntry[]>(loadHistory);

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
      setState((current) => ({ ...current, mode: nextMode }));
    },
    patchQuick: (patch) => {
      setState((current) => ({ ...current, quick: { ...current.quick, ...patch } }));
    },
    patchReal: (patch) => {
      setState((current) => ({ ...current, real: { ...current.real, ...patch } }));
    },
    patchCosts: (patch) => {
      setState((current) => ({ ...current, costs: { ...current.costs, ...patch } }));
    },
    patchSettings: (patch) => {
      setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
    },
    startNewLot: () => {
      setState((current) => ({ ...lotFromSettings(current.settings), settings: current.settings }));
    },
    saveToHistory,
    loadHistoryEntry: (id) => {
      const entry = history.find((candidate) => candidate.id === id);
      if (entry === undefined) return;
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

  return { state, quickIssues, realIssues, quickResult, realResult, history, actions };
}
