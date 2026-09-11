// Testes da persistência local — envelope versionado e saneamento defensivo.
import { beforeEach, describe, expect, it } from 'vitest';

import { initialState, type CalculatorState } from './model.js';
import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  STATE_STORAGE_KEY,
  loadHistory,
  loadState,
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
