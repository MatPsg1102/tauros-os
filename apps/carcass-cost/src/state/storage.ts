// Persistência local — mesmo padrão do theme-storage do DS: envelope
// versionado, versão desconhecida rejeitada sem migração implícita, leitura e
// escrita protegidas por try/catch (localStorage pode estar indisponível).
// Todo valor lido é saneado campo a campo: storage corrompido nunca derruba o app.

import type { CostsForm, QuickForm, RealForm } from '../domain/validation.js';
import {
  DEFAULT_SETTINGS,
  initialState,
  type CalculatorMode,
  type CalculatorState,
  type DefaultSettings,
  type HistoryEntry,
} from './model.js';

export const STATE_STORAGE_KEY = 'tauros.carcass-cost.state.v1';
export const HISTORY_STORAGE_KEY = 'tauros.carcass-cost.history.v1';
export const HISTORY_LIMIT = 50;
const STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberOrNull(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mode(value: unknown, fallback: CalculatorMode): CalculatorMode {
  return value === 'quick' || value === 'real' ? value : fallback;
}

function feeKind(value: unknown, fallback: 'perKg' | 'perHead'): 'perKg' | 'perHead' {
  return value === 'perKg' || value === 'perHead' ? value : fallback;
}

function sanitizeQuick(value: unknown, fallback: QuickForm): QuickForm {
  const raw = isRecord(value) ? value : {};
  return {
    animals: numberOrNull(raw['animals'], fallback.animals),
    liveWeightKg: numberOrNull(raw['liveWeightKg'], fallback.liveWeightKg),
    livePricePerKg: numberOrNull(raw['livePricePerKg'], fallback.livePricePerKg),
    slaughterLossPct: numberOrNull(raw['slaughterLossPct'], fallback.slaughterLossPct),
    coolingTransformPct: numberOrNull(raw['coolingTransformPct'], fallback.coolingTransformPct),
  };
}

function sanitizeReal(value: unknown, fallback: RealForm): RealForm {
  const raw = isRecord(value) ? value : {};
  return {
    animals: numberOrNull(raw['animals'], fallback.animals),
    scaleWeightKg: numberOrNull(raw['scaleWeightKg'], fallback.scaleWeightKg),
    discountsKg: numberOrNull(raw['discountsKg'], fallback.discountsKg),
    slaughteredWeightKg: numberOrNull(raw['slaughteredWeightKg'], fallback.slaughteredWeightKg),
    chilledWeightKg: numberOrNull(raw['chilledWeightKg'], fallback.chilledWeightKg),
    livePricePerKg: numberOrNull(raw['livePricePerKg'], fallback.livePricePerKg),
  };
}

function sanitizeCosts(value: unknown, fallback: CostsForm): CostsForm {
  const raw = isRecord(value) ? value : {};
  return {
    slaughterFeeKind: feeKind(raw['slaughterFeeKind'], fallback.slaughterFeeKind),
    slaughterFeePerKg: numberOrNull(raw['slaughterFeePerKg'], fallback.slaughterFeePerKg),
    slaughterFeePerHead: numberOrNull(raw['slaughterFeePerHead'], fallback.slaughterFeePerHead),
    servicePerHead: numberOrNull(raw['servicePerHead'], fallback.servicePerHead),
    freight: numberOrNull(raw['freight'], fallback.freight),
  };
}

function sanitizeSettings(value: unknown): DefaultSettings {
  const raw = isRecord(value) ? value : {};
  return {
    animals: finiteNumber(raw['animals'], DEFAULT_SETTINGS.animals),
    livePricePerKg: finiteNumber(raw['livePricePerKg'], DEFAULT_SETTINGS.livePricePerKg),
    slaughterLossPct: finiteNumber(raw['slaughterLossPct'], DEFAULT_SETTINGS.slaughterLossPct),
    coolingTransformPct: finiteNumber(
      raw['coolingTransformPct'],
      DEFAULT_SETTINGS.coolingTransformPct,
    ),
    slaughterFeeKind: feeKind(raw['slaughterFeeKind'], DEFAULT_SETTINGS.slaughterFeeKind),
    slaughterFeePerKg: finiteNumber(raw['slaughterFeePerKg'], DEFAULT_SETTINGS.slaughterFeePerKg),
    slaughterFeePerHead: finiteNumber(
      raw['slaughterFeePerHead'],
      DEFAULT_SETTINGS.slaughterFeePerHead,
    ),
    servicePerHead: finiteNumber(raw['servicePerHead'], DEFAULT_SETTINGS.servicePerHead),
    freight: finiteNumber(raw['freight'], DEFAULT_SETTINGS.freight),
  };
}

function readEnvelope(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed['version'] !== STORAGE_VERSION) return null;
    return parsed['data'];
  } catch {
    return null;
  }
}

function writeEnvelope(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, data }));
  } catch {
    // Sem storage disponível o app segue funcionando, apenas sem persistir.
  }
}

export function loadState(): CalculatorState {
  const fallback = initialState();
  const data = readEnvelope(STATE_STORAGE_KEY);
  if (!isRecord(data)) return fallback;
  return {
    mode: mode(data['mode'], fallback.mode),
    quick: sanitizeQuick(data['quick'], fallback.quick),
    real: sanitizeReal(data['real'], fallback.real),
    costs: sanitizeCosts(data['costs'], fallback.costs),
    settings: sanitizeSettings(data['settings']),
  };
}

export function saveState(state: CalculatorState): void {
  writeEnvelope(STATE_STORAGE_KEY, state);
}

function sanitizeHistoryEntry(value: unknown): HistoryEntry | null {
  if (!isRecord(value)) return null;
  const { id, savedAt } = value;
  if (typeof id !== 'string' || typeof savedAt !== 'string') return null;
  const fallback = initialState();
  const summary = isRecord(value['summary']) ? value['summary'] : {};
  return {
    id,
    savedAt,
    mode: mode(value['mode'], 'quick'),
    quick: sanitizeQuick(value['quick'], fallback.quick),
    real: sanitizeReal(value['real'], fallback.real),
    costs: sanitizeCosts(value['costs'], fallback.costs),
    summary: {
      animals: numberOrNull(summary['animals'], null),
      referenceWeightKg: numberOrNull(summary['referenceWeightKg'], null),
      finalWeightKg: numberOrNull(summary['finalWeightKg'], null),
      livePricePerKg: numberOrNull(summary['livePricePerKg'], null),
      costPerKg: numberOrNull(summary['costPerKg'], null),
    },
  };
}

export function loadHistory(): readonly HistoryEntry[] {
  const data = readEnvelope(HISTORY_STORAGE_KEY);
  if (!Array.isArray(data)) return [];
  return data
    .map(sanitizeHistoryEntry)
    .filter((entry): entry is HistoryEntry => entry !== null)
    .slice(0, HISTORY_LIMIT);
}

export function saveHistory(entries: readonly HistoryEntry[]): void {
  writeEnvelope(HISTORY_STORAGE_KEY, entries.slice(0, HISTORY_LIMIT));
}
