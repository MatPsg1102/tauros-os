// Persistência local das estatísticas de pesos e dos campos novos da desossa
// (nome da análise, referência da estatística): roundtrip, saneamento e
// compatibilidade com registros gravados antes desta versão (sem migração).
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_DEBONING_PRODUCTS, statisticFromForm } from '../domain/deboning.js';
import { DEFAULT_DEBONING, initialState } from './model.js';
import {
  DEBONING_HISTORY_STORAGE_KEY,
  DEBONING_STATISTICS_STORAGE_KEY,
  STATE_STORAGE_KEY,
  loadDeboningHistory,
  loadDeboningStatistics,
  loadState,
  saveDeboningHistory,
  saveDeboningStatistics,
  saveState,
} from './storage.js';

const STATISTIC = statisticFromForm(DEFAULT_DEBONING, {
  id: 'stat-x',
  supplier: 'Frigorífico X',
  kind: 'porco-mineiro',
});

beforeEach(() => {
  localStorage.clear();
});

describe('estatísticas de pesos (localStorage)', () => {
  it('sem nada salvo devolve lista vazia', () => {
    expect(loadDeboningStatistics()).toEqual([]);
  });

  it('roundtrip preserva as estatísticas exatas', () => {
    const other = {
      ...STATISTIC,
      id: 'stat-y',
      supplier: 'Frigorífico Y',
      kind: 'carcaca' as const,
    };
    saveDeboningStatistics([STATISTIC, other]);
    expect(loadDeboningStatistics()).toEqual([STATISTIC, other]);
  });

  it('descarta estatística inválida (tipo desconhecido, sem fornecedor, lixo) sem perder as demais', () => {
    localStorage.setItem(
      DEBONING_STATISTICS_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        data: [
          STATISTIC,
          { ...STATISTIC, id: 'k', kind: 'frango' },
          { ...STATISTIC, id: 's', supplier: '' },
          { id: 'p', supplier: 'Z', kind: 'carcaca', products: 'x' },
          'lixo',
        ],
      }),
    );
    const loaded = loadDeboningStatistics();
    expect(loaded.map((statistic) => statistic.id)).toEqual(['stat-x', 'p']);
    expect(loaded[1]?.products).toEqual([]);
    expect(loaded[1]?.carcassWeightKg).toBeNull();
  });

  it('chave própria: não interfere no histórico de desossas', () => {
    saveDeboningStatistics([STATISTIC]);
    expect(loadDeboningHistory()).toEqual([]);
    expect(localStorage.getItem(DEBONING_HISTORY_STORAGE_KEY)).toBeNull();
  });
});

describe('desossa salva com nome e estatística', () => {
  const entry = {
    id: 'a',
    savedAt: '2026-09-17T12:00:00.000Z',
    name: 'Frigorífico X — Semana 38',
    deboning: {
      ...DEFAULT_DEBONING,
      statistic: { id: 'stat-x', supplier: 'Frigorífico X', kind: 'porco-mineiro' as const },
    },
    summary: {
      carcassWeightKg: 1128.1,
      carcassValueBRL: 13029.56,
      commercialValueBRL: 16829.5573,
      commercialGainBRL: 3799.9973,
      marginPct: 22.579,
      productCount: 12,
    },
  };

  it('roundtrip preserva nome, data e referência da estatística', () => {
    saveDeboningHistory([entry]);
    expect(loadDeboningHistory()[0]).toEqual(entry);
  });

  it('registro ANTIGO (sem nome e sem estatística) continua abrindo com fallback seguro', () => {
    const old = {
      id: 'antiga',
      savedAt: '2026-09-10T09:30:00.000Z',
      deboning: {
        carcassWeightKg: 1000,
        carcassCostPerKg: 11,
        products: DEFAULT_DEBONING_PRODUCTS.slice(0, 2),
      },
      summary: entry.summary,
    };
    localStorage.setItem(DEBONING_HISTORY_STORAGE_KEY, JSON.stringify({ version: 4, data: [old] }));
    const loaded = loadDeboningHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.name).toBe('');
    expect(loaded[0]?.deboning.statistic).toBeNull();
    expect(loaded[0]?.deboning.products).toHaveLength(2);
    expect(loaded[0]?.savedAt).toBe('2026-09-10T09:30:00.000Z');
  });

  it('referência inválida na análise vira null sem descartar a análise', () => {
    localStorage.setItem(
      DEBONING_HISTORY_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        data: [{ ...entry, deboning: { ...entry.deboning, statistic: { id: 'x' } } }],
      }),
    );
    expect(loadDeboningHistory()[0]?.deboning.statistic).toBeNull();
  });
});

describe('estado da desossa com estatística', () => {
  it('estado antigo sem `statistic` carrega com pesos manuais (null)', () => {
    saveState(initialState());
    const raw = JSON.parse(localStorage.getItem(STATE_STORAGE_KEY) ?? '{}') as {
      data: { deboning: Record<string, unknown> };
    };
    delete raw.data.deboning['statistic'];
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ version: 4, data: raw.data }));
    expect(loadState().deboning.statistic).toBeNull();
    expect(loadState().deboning.products).toHaveLength(12);
  });

  it('estado com estatística selecionada faz roundtrip', () => {
    const state = initialState();
    saveState({
      ...state,
      deboning: {
        ...state.deboning,
        statistic: { id: 'stat-x', supplier: 'Frigorífico X', kind: 'carcaca' },
      },
    });
    expect(loadState().deboning.statistic).toEqual({
      id: 'stat-x',
      supplier: 'Frigorífico X',
      kind: 'carcaca',
    });
  });
});
