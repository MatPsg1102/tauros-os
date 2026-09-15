// Testes da persistência local — envelope versionado e saneamento defensivo.
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_DEBONING, initialState, type CalculatorState } from './model.js';
import {
  DEBONING_HISTORY_STORAGE_KEY,
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  STATE_STORAGE_KEY,
  loadDeboningHistory,
  loadHistory,
  loadState,
  saveDeboningHistory,
  saveHistory,
  saveState,
} from './storage.js';

beforeEach(() => {
  localStorage.clear();
});

describe('loadState / saveState', () => {
  it('sem storage salvo retorna o estado inicial', () => {
    expect(loadState()).toEqual(initialState());
  });

  it('roundtrip preserva o estado exato', () => {
    const state: CalculatorState = {
      ...initialState(),
      mode: 'real',
      quick: { ...initialState().quick, avgLiveWeightKg: 115, livePricePerKg: 4.8 },
    };
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it('versão desconhecida é rejeitada sem migração implícita', () => {
    localStorage.setItem(
      STATE_STORAGE_KEY,
      JSON.stringify({ version: 99, data: { mode: 'real' } }),
    );
    expect(loadState()).toEqual(initialState());
  });

  it('envelope antigo (v3) é rejeitado — volta aos padrões novos com transformação', () => {
    localStorage.setItem(
      STATE_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        data: { mode: 'real', quick: { avgLiveWeightKg: 115 } },
      }),
    );
    const loaded = loadState();
    expect(loaded).toEqual(initialState());
    expect(loaded.settings.slaughterLossPct).toBe(17);
    expect(loaded.settings.coolingLossPct).toBe(2.5);
    expect(loaded.transformation.exportCarcassPricePerKg).toBe(7.7);
    expect(loaded.transformation.subproducts.jowl).toEqual({ weightKg: 2.5, pricePerKg: 12.99 });
  });

  it('JSON corrompido cai no estado inicial', () => {
    localStorage.setItem(STATE_STORAGE_KEY, '{corrompido');
    expect(loadState()).toEqual(initialState());
  });

  it('campos com tipo errado são saneados individualmente', () => {
    saveState(initialState());
    const raw = JSON.parse(localStorage.getItem(STATE_STORAGE_KEY) ?? '{}') as {
      data: { quick: Record<string, unknown>; costs: Record<string, unknown> };
    };
    raw.data.quick['avgLiveWeightKg'] = 'cento e quinze';
    raw.data.costs['fuelCost'] = 'um tanque';
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ version: 4, data: raw.data }));

    const loaded = loadState();
    expect(loaded.quick.avgLiveWeightKg).toBeNull();
    // Valor corrompido cai no padrão vigente (0), nunca derruba o app.
    expect(loaded.costs.fuelCost).toBe(0);
    // Campos íntegros sobrevivem.
    expect(loaded.quick.animals).toBe(110);
    expect(loaded.costs.driverDailyRate).toBe(150);
  });

  it('envelope v4 gravado ANTES da desossa carrega os padrões da desossa e preserva o restante', () => {
    saveState({
      ...initialState(),
      mode: 'real',
      quick: { ...initialState().quick, avgLiveWeightKg: 115 },
    });
    const raw = JSON.parse(localStorage.getItem(STATE_STORAGE_KEY) ?? '{}') as {
      data: Record<string, unknown>;
    };
    delete raw.data['deboning'];
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ version: 4, data: raw.data }));

    const loaded = loadState();
    expect(loaded.mode).toBe('real');
    expect(loaded.quick.avgLiveWeightKg).toBe(115);
    expect(loaded.transformation.subproducts.jowl).toEqual({ weightKg: 2.5, pricePerKg: 12.99 });
    expect(loaded.deboning).toEqual(DEFAULT_DEBONING);
    expect(loaded.deboning.products).toHaveLength(12);
  });

  it('roundtrip preserva a desossa editada (produto renomeado, adicionado e removido)', () => {
    const state = initialState();
    const edited: typeof state = {
      ...state,
      deboning: {
        carcassWeightKg: 1200,
        carcassValueBRL: 14000,
        products: [
          ...state.deboning.products
            .filter((p) => p.id !== 'osso')
            .map((p) =>
              p.id === 'pernil' ? { ...p, name: 'Pernil sem osso', pricePerKg: 16 } : p,
            ),
          { id: 'novo', name: 'Filezinho', weightKg: null, pricePerKg: 20 },
        ],
      },
    };
    saveState(edited);
    expect(loadState().deboning).toEqual(edited.deboning);
  });

  it('lista de produtos vazia gravada é respeitada — não ressuscita a estatística', () => {
    saveState({ ...initialState(), deboning: { ...DEFAULT_DEBONING, products: [] } });
    expect(loadState().deboning.products).toEqual([]);
  });

  it('produtos sem id, com id repetido ou com tipo errado são saneados', () => {
    saveState(initialState());
    const raw = JSON.parse(localStorage.getItem(STATE_STORAGE_KEY) ?? '{}') as {
      data: { deboning: Record<string, unknown> };
    };
    raw.data.deboning['products'] = [
      { id: 'pernil', name: 'Pernil', weightKg: 'muito', pricePerKg: 15 },
      { id: 'pernil', name: 'Duplicado', weightKg: 1, pricePerKg: 1 },
      { name: 'Sem id', weightKg: 1, pricePerKg: 1 },
      'lixo',
      { id: 'lombo', name: 42, weightKg: 142.1, pricePerKg: 19.8 },
    ];
    raw.data.deboning['carcassWeightKg'] = 'pesada';
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ version: 4, data: raw.data }));

    const loaded = loadState();
    expect(loaded.deboning.products).toEqual([
      { id: 'pernil', name: 'Pernil', weightKg: null, pricePerKg: 15 },
      { id: 'lombo', name: '', weightKg: 142.1, pricePerKg: 19.8 },
    ]);
    // Valor corrompido cai no padrão vigente, nunca derruba o app.
    expect(loaded.deboning.carcassWeightKg).toBe(1128.1);
  });

  it('roundtrip preserva a transformação editada', () => {
    const state = initialState();
    const edited: typeof state = {
      ...state,
      transformation: {
        ...state.transformation,
        exportCarcassPricePerKg: 8.2,
        subproducts: {
          ...state.transformation.subproducts,
          jowl: { weightKg: 2.5, pricePerKg: 15 },
        },
      },
    };
    saveState(edited);
    expect(loadState().transformation).toEqual(edited.transformation);
  });
});

describe('loadHistory / saveHistory', () => {
  const entry = (id: string) => ({
    id,
    savedAt: '2026-09-10T12:00:00.000Z',
    mode: 'quick' as const,
    quick: initialState().quick,
    real: initialState().real,
    costs: initialState().costs,
    summary: {
      animals: 110,
      referenceWeightKg: 12_340,
      finalWeightKg: 9_180.96,
      livePricePerKg: 5,
      costPerKg: 7.24,
    },
  });

  it('roundtrip preserva as entradas', () => {
    saveHistory([entry('a'), entry('b')]);
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0]?.id).toBe('a');
  });

  it('entradas inválidas são descartadas sem derrubar as demais', () => {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({ version: 4, data: [entry('a'), { id: 42 }, 'lixo'] }),
    );
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe('a');
  });

  it('respeita o limite máximo de entradas', () => {
    const entries = Array.from({ length: HISTORY_LIMIT + 10 }, (_, i) => entry(`e${i}`));
    saveHistory(entries);
    expect(loadHistory()).toHaveLength(HISTORY_LIMIT);
  });
});

describe('loadDeboningHistory / saveDeboningHistory', () => {
  const entry = (id: string) => ({
    id,
    savedAt: '2026-09-14T12:00:00.000Z',
    deboning: DEFAULT_DEBONING,
    summary: {
      carcassWeightKg: 1128.1,
      carcassValueBRL: 13029.56,
      commercialValueBRL: 16829.5573,
      commercialGainBRL: 3799.9973,
      marginPct: 22.579,
      productCount: 12,
    },
  });

  it('roundtrip preserva as análises', () => {
    saveDeboningHistory([entry('a'), entry('b')]);
    const loaded = loadDeboningHistory();
    expect(loaded).toHaveLength(2);
    expect(loaded[0]).toEqual(entry('a'));
  });

  it('análise sem lista de produtos ou inválida é descartada sem derrubar as demais', () => {
    localStorage.setItem(
      DEBONING_HISTORY_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        data: [entry('a'), { id: 'b', savedAt: 'x', deboning: {} }, { id: 42 }, 'lixo'],
      }),
    );
    const loaded = loadDeboningHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe('a');
  });

  it('é independente do histórico de lotes (chaves distintas)', () => {
    saveDeboningHistory([entry('a')]);
    expect(loadHistory()).toEqual([]);
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  });

  it('respeita o limite máximo de análises', () => {
    const entries = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => entry(`d${i}`));
    saveDeboningHistory(entries);
    expect(loadDeboningHistory()).toHaveLength(HISTORY_LIMIT);
  });
});
