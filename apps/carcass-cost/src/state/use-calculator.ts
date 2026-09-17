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
  buildDeboningInput,
  calculateDeboning,
  validateDeboning,
  type DeboningForm,
  type DeboningProductForm,
  type DeboningResult,
} from '../domain/deboning.js';
import {
  REFERENCE_COOLING_LOSS_PCT,
  REFERENCE_LIVE_WEIGHT_KG,
  REFERENCE_SLAUGHTER_LOSS_PCT,
  SUBPRODUCT_KEYS,
  calculateTransformation,
  type SubproductKey,
  type TransformationInput,
  type TransformationResult,
} from '../domain/transformation.js';
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
  type DeboningHistoryEntry,
  type DefaultSettings,
  type HistoryEntry,
  type SubproductForm,
  type TransformationForm,
} from './model.js';
import {
  HISTORY_LIMIT,
  loadDeboningHistory,
  loadHistory,
  loadState,
  saveDeboningHistory,
  saveHistory,
  saveState,
} from './storage.js';
import { CLOUD_UNAVAILABLE_MESSAGE, type CloudHistory } from './cloud.js';

export type DeboningCarcassPatch = Partial<
  Pick<DeboningForm, 'carcassWeightKg' | 'carcassCostPerKg'>
>;
export type DeboningProductPatch = Partial<Omit<DeboningProductForm, 'id'>>;

export interface CalculatorActions {
  readonly setMode: (mode: CalculatorMode) => void;
  readonly patchQuick: (patch: Partial<QuickForm>) => void;
  readonly patchReal: (patch: Partial<RealForm>) => void;
  readonly patchCosts: (patch: Partial<CostsForm>) => void;
  readonly patchSettings: (patch: Partial<DefaultSettings>) => void;
  readonly patchSubproduct: (key: SubproductKey, patch: Partial<SubproductForm>) => void;
  readonly setExportCarcassPrice: (value: number | null) => void;
  /** Reinicia o lote atual a partir das premissas padrão configuradas. */
  readonly startNewLot: () => void;
  readonly saveToHistory: () => void;
  readonly loadHistoryEntry: (id: string) => void;
  readonly removeHistoryEntry: (id: string) => void;
  // Desossa — análise comercial independente (nunca toca quick/real/transformation).
  readonly patchDeboning: (patch: DeboningCarcassPatch) => void;
  readonly patchDeboningProduct: (id: string, patch: DeboningProductPatch) => void;
  /** Acrescenta uma linha vazia ao fim da lista (nome, peso e preço em branco). */
  readonly addDeboningProduct: () => void;
  readonly removeDeboningProduct: (id: string) => void;
  readonly saveDeboningToHistory: () => void;
  readonly loadDeboningEntry: (id: string) => void;
  readonly removeDeboningEntry: (id: string) => void;
}

export interface CalculatorController {
  readonly state: CalculatorState;
  readonly quickIssues: readonly ValidationIssue[];
  readonly realIssues: readonly ValidationIssue[];
  readonly quickResult: QuickEstimateResult | null;
  readonly realResult: RealLotResult | null;
  readonly transformation: TransformationResult;
  /** Indicador econômico da Transformação usado pela Estimativa como ajuste
   * comercial; null quando a Transformação é inválida (Estimativa fica pendente). */
  readonly commercialAdjustmentPct: number | null;
  readonly history: readonly HistoryEntry[];
  /** Origem da lista de lotes: localStorage ou nuvem (sessão ativa). */
  readonly historySource: 'local' | 'cloud';
  /** Última falha da nuvem (listar, salvar, excluir); null quando tudo certo. */
  readonly cloudError: string | null;
  /** Desossa (indicador comercial): null enquanto houver problema de validação. */
  readonly deboning: DeboningResult | null;
  readonly deboningIssues: readonly ValidationIssue[];
  readonly deboningHistory: readonly DeboningHistoryEntry[];
  readonly actions: CalculatorActions;
}

// Glue form→domínio: campo vazio (null) não contribui (peso/preço = 0). O peso
// vivo vem COMPARTILHADO da Estimativa (state.quick.avgLiveWeightKg) para o
// valor da carcaça de exportação; se ainda não informado, usa a referência
// padrão de 115 kg. Quebras físicas fixas (17%/2,5%).
function buildTransformationInput(
  form: TransformationForm,
  avgLiveWeightKg: number | null,
): TransformationInput {
  const subproducts = Object.fromEntries(
    SUBPRODUCT_KEYS.map((key) => {
      const item = form.subproducts[key];
      return [key, { weightKg: item.weightKg ?? 0, pricePerKg: item.pricePerKg ?? 0 }];
    }),
  ) as TransformationInput['subproducts'];
  return {
    subproducts,
    exportCarcassPricePerKg: form.exportCarcassPricePerKg ?? 0,
    referenceLiveWeightKg:
      avgLiveWeightKg !== null && avgLiveWeightKg > 0 ? avgLiveWeightKg : REFERENCE_LIVE_WEIGHT_KG,
    slaughterLossPct: REFERENCE_SLAUGHTER_LOSS_PCT,
    coolingLossPct: REFERENCE_COOLING_LOSS_PCT,
  };
}

// `cloudHistory` presente = sessão ativa: os lotes vêm da nuvem e vão para ela.
export function useCalculator(cloudHistory: CloudHistory | null = null): CalculatorController {
  const [state, setState] = useState<CalculatorState>(loadState);
  // A origem acompanha a lista: o efeito de persistência nunca grava a lista
  // da nuvem no localStorage durante a troca de origem.
  const [lots, setLots] = useState<{
    readonly source: 'local' | 'cloud';
    readonly entries: readonly HistoryEntry[];
  }>(() => ({ source: 'local', entries: loadHistory() }));
  const [cloudError, setCloudError] = useState<string | null>(null);
  const history = lots.entries;
  const [deboningHistory, setDeboningHistory] =
    useState<readonly DeboningHistoryEntry[]>(loadDeboningHistory);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (lots.source === 'local') saveHistory(lots.entries);
  }, [lots]);

  useEffect(() => {
    if (cloudHistory === null) {
      setLots({ source: 'local', entries: loadHistory() });
      setCloudError(null);
      return undefined;
    }
    let active = true;
    setCloudError(null);
    void cloudHistory.list().then(
      (entries) => {
        if (active) setLots({ source: 'cloud', entries });
      },
      () => {
        if (active) {
          setLots({ source: 'cloud', entries: [] });
          setCloudError(CLOUD_UNAVAILABLE_MESSAGE);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [cloudHistory]);

  useEffect(() => {
    saveDeboningHistory(deboningHistory);
  }, [deboningHistory]);

  const transformation = useMemo(
    () =>
      calculateTransformation(
        buildTransformationInput(state.transformation, state.quick.avgLiveWeightKg),
      ),
    [state.transformation, state.quick.avgLiveWeightKg],
  );
  // Indicador da aba Transformação = ajuste comercial da Estimativa. Sem
  // fallback: indicador inválido (null) deixa a Estimativa pendente.
  const commercialAdjustmentPct = transformation.indicatorPct;

  const quickIssues = useMemo(
    () => validateQuick(state.quick, state.costs),
    [state.quick, state.costs],
  );
  const realIssues = useMemo(
    () => validateReal(state.real, state.costs),
    [state.real, state.costs],
  );

  const quickResult = useMemo(() => {
    if (commercialAdjustmentPct === null) return null;
    const input = buildQuickInput(state.quick, state.costs, commercialAdjustmentPct);
    return input === null ? null : calculateQuickEstimate(input);
  }, [state.quick, state.costs, commercialAdjustmentPct]);

  const realResult = useMemo(() => {
    const input = buildRealInput(state.real, state.costs);
    return input === null ? null : calculateRealLot(input);
  }, [state.real, state.costs]);

  // Desossa depende SÓ de state.deboning — nem lê nem alimenta a Transformação
  // ou a Estimativa (regra: análise comercial independente).
  const deboningIssues = useMemo(() => validateDeboning(state.deboning), [state.deboning]);
  const deboning = useMemo(() => {
    const input = buildDeboningInput(state.deboning);
    return input === null ? null : calculateDeboning(input);
  }, [state.deboning]);

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
    const prepend = (): void => {
      setLots((current) => ({
        source: current.source,
        entries: [entry, ...current.entries].slice(0, HISTORY_LIMIT),
      }));
    };
    if (cloudHistory === null) {
      prepend();
      return;
    }
    setCloudError(null);
    void cloudHistory.save(entry).then(prepend, () => {
      setCloudError(CLOUD_UNAVAILABLE_MESSAGE);
    });
  };

  const saveDeboningToHistory = (): void => {
    const entry: DeboningHistoryEntry = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      deboning: state.deboning,
      summary: {
        carcassWeightKg: state.deboning.carcassWeightKg,
        carcassValueBRL: deboning === null ? null : deboning.carcassValueBRL,
        commercialValueBRL: deboning === null ? null : deboning.commercialValueBRL,
        commercialGainBRL: deboning === null ? null : deboning.commercialGainBRL,
        marginPct: deboning === null ? null : deboning.marginPct,
        productCount: state.deboning.products.length,
      },
    };
    setDeboningHistory((entries) => [entry, ...entries].slice(0, HISTORY_LIMIT));
  };

  const patchDeboningForm = (update: (current: DeboningForm) => DeboningForm): void => {
    setState((current) => ({ ...current, deboning: update(current.deboning) }));
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
    patchSubproduct: (key, patch) => {
      setState((current) => ({
        ...current,
        transformation: {
          ...current.transformation,
          subproducts: {
            ...current.transformation.subproducts,
            [key]: { ...current.transformation.subproducts[key], ...patch },
          },
        },
      }));
    },
    setExportCarcassPrice: (value) => {
      setState((current) => ({
        ...current,
        transformation: { ...current.transformation, exportCarcassPricePerKg: value },
      }));
    },
    startNewLot: () => {
      setState((current) => ({
        ...lotFromSettings(current.settings),
        settings: current.settings,
        transformation: current.transformation,
        deboning: current.deboning,
      }));
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
      const drop = (): void => {
        setLots((current) => ({
          source: current.source,
          entries: current.entries.filter((entry) => entry.id !== id),
        }));
      };
      if (cloudHistory === null) {
        drop();
        return;
      }
      setCloudError(null);
      void cloudHistory.remove(id).then(drop, () => {
        setCloudError(CLOUD_UNAVAILABLE_MESSAGE);
      });
    },
    patchDeboning: (patch) => {
      patchDeboningForm((current) => ({ ...current, ...patch }));
    },
    patchDeboningProduct: (id, patch) => {
      patchDeboningForm((current) => ({
        ...current,
        products: current.products.map((product) =>
          product.id === id ? { ...product, ...patch } : product,
        ),
      }));
    },
    addDeboningProduct: () => {
      const product: DeboningProductForm = {
        id: crypto.randomUUID(),
        name: '',
        weightKg: null,
        pricePerKg: null,
      };
      patchDeboningForm((current) => ({ ...current, products: [...current.products, product] }));
    },
    removeDeboningProduct: (id) => {
      patchDeboningForm((current) => ({
        ...current,
        products: current.products.filter((product) => product.id !== id),
      }));
    },
    saveDeboningToHistory,
    loadDeboningEntry: (id) => {
      const entry = deboningHistory.find((candidate) => candidate.id === id);
      if (entry === undefined) return;
      setState((current) => ({ ...current, deboning: entry.deboning }));
    },
    removeDeboningEntry: (id) => {
      setDeboningHistory((entries) => entries.filter((entry) => entry.id !== id));
    },
  };

  return {
    state,
    quickIssues,
    realIssues,
    quickResult,
    realResult,
    transformation,
    commercialAdjustmentPct,
    history,
    historySource: lots.source,
    cloudError,
    deboning,
    deboningIssues,
    deboningHistory,
    actions,
  };
}
