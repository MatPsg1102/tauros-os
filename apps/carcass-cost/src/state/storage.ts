// Persistência local — mesmo padrão do theme-storage do DS: envelope
// versionado, versão desconhecida rejeitada sem migração implícita, leitura e
// escrita protegidas por try/catch (localStorage pode estar indisponível).
// Todo valor lido é saneado campo a campo: storage corrompido nunca derruba o app.

import type { DeboningForm, DeboningProductForm } from '../domain/deboning.js';
import { SUBPRODUCT_KEYS, type SubproductKey } from '../domain/transformation.js';
import type { CostsForm, QuickForm, RealForm } from '../domain/validation.js';
import {
  DEFAULT_SETTINGS,
  initialState,
  type CalculatorMode,
  type CalculatorState,
  type DeboningHistoryEntry,
  type DefaultSettings,
  type HistoryEntry,
  type TransformationForm,
} from './model.js';

export const STATE_STORAGE_KEY = 'tauros.carcass-cost.state.v1';
export const HISTORY_STORAGE_KEY = 'tauros.carcass-cost.history.v1';
export const DEBONING_HISTORY_STORAGE_KEY = 'tauros.carcass-cost.deboning-history.v1';
export const HISTORY_LIMIT = 50;
// v4: aba Transformação (subprodutos + preço da carcaça de exportação) e o
// ajuste comercial deixou de ser campo (vem do indicador). Envelope anterior
// é rejeitado — sem migração implícita (o app volta aos padrões).
// A Desossa entrou como sub-árvore ADITIVA do mesmo envelope: um v4 gravado
// antes dela não muda de significado — `deboning` ausente cai nos padrões
// pelo saneamento campo a campo, e o restante do estado é preservado.
const STORAGE_VERSION = 4;

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

function sanitizeQuick(value: unknown, fallback: QuickForm): QuickForm {
  const raw = isRecord(value) ? value : {};
  return {
    animals: numberOrNull(raw['animals'], fallback.animals),
    avgLiveWeightKg: numberOrNull(raw['avgLiveWeightKg'], fallback.avgLiveWeightKg),
    livePricePerKg: numberOrNull(raw['livePricePerKg'], fallback.livePricePerKg),
    slaughterLossPct: numberOrNull(raw['slaughterLossPct'], fallback.slaughterLossPct),
    coolingLossPct: numberOrNull(raw['coolingLossPct'], fallback.coolingLossPct),
  };
}

function sanitizeTransformation(value: unknown, fallback: TransformationForm): TransformationForm {
  const raw = isRecord(value) ? value : {};
  const rawSubs = isRecord(raw['subproducts']) ? raw['subproducts'] : {};
  const subproducts = Object.fromEntries(
    SUBPRODUCT_KEYS.map((key) => {
      const item = isRecord(rawSubs[key]) ? rawSubs[key] : {};
      const fb = fallback.subproducts[key];
      return [
        key,
        {
          weightKg: numberOrNull(item['weightKg'], fb.weightKg),
          pricePerKg: numberOrNull(item['pricePerKg'], fb.pricePerKg),
        },
      ];
    }),
  ) as Record<SubproductKey, TransformationForm['subproducts'][SubproductKey]>;
  return {
    subproducts,
    exportCarcassPricePerKg: numberOrNull(
      raw['exportCarcassPricePerKg'],
      fallback.exportCarcassPricePerKg,
    ),
  };
}

// Produto sem id (string não vazia) é descartado; id repetido fica com a
// primeira ocorrência (id é a chave de edição/remoção na tela).
function sanitizeDeboningProducts(value: unknown): readonly DeboningProductForm[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const products: DeboningProductForm[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = item['id'];
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    products.push({
      id,
      name: typeof item['name'] === 'string' ? item['name'] : '',
      weightKg: numberOrNull(item['weightKg'], null),
      pricePerKg: numberOrNull(item['pricePerKg'], null),
    });
  }
  return products;
}

// Lista de produtos: ausente → padrão da estatística; presente (mesmo vazia,
// após o operador remover tudo) → respeitada. Nunca ressuscita produto removido.
// A chave antiga `carcassValueBRL` (valor digitado, #54) é simplesmente
// ignorada: o valor inicial passou a derivar de peso × custo do kg.
function sanitizeDeboning(value: unknown, fallback: DeboningForm): DeboningForm {
  const raw = isRecord(value) ? value : {};
  return {
    carcassWeightKg: numberOrNull(raw['carcassWeightKg'], fallback.carcassWeightKg),
    carcassCostPerKg: numberOrNull(raw['carcassCostPerKg'], fallback.carcassCostPerKg),
    products: Array.isArray(raw['products'])
      ? sanitizeDeboningProducts(raw['products'])
      : fallback.products,
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
    slaughterFeePerHead: numberOrNull(raw['slaughterFeePerHead'], fallback.slaughterFeePerHead),
    servicePerHead: numberOrNull(raw['servicePerHead'], fallback.servicePerHead),
    driverDailyRate: numberOrNull(raw['driverDailyRate'], fallback.driverDailyRate),
    fuelCost: numberOrNull(raw['fuelCost'], fallback.fuelCost),
  };
}

function sanitizeSettings(value: unknown): DefaultSettings {
  const raw = isRecord(value) ? value : {};
  return {
    animals: finiteNumber(raw['animals'], DEFAULT_SETTINGS.animals),
    livePricePerKg: finiteNumber(raw['livePricePerKg'], DEFAULT_SETTINGS.livePricePerKg),
    slaughterLossPct: finiteNumber(raw['slaughterLossPct'], DEFAULT_SETTINGS.slaughterLossPct),
    coolingLossPct: finiteNumber(raw['coolingLossPct'], DEFAULT_SETTINGS.coolingLossPct),
    slaughterFeePerHead: finiteNumber(
      raw['slaughterFeePerHead'],
      DEFAULT_SETTINGS.slaughterFeePerHead,
    ),
    servicePerHead: finiteNumber(raw['servicePerHead'], DEFAULT_SETTINGS.servicePerHead),
    driverDailyRate: finiteNumber(raw['driverDailyRate'], DEFAULT_SETTINGS.driverDailyRate),
    fuelCost: finiteNumber(raw['fuelCost'], DEFAULT_SETTINGS.fuelCost),
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
    transformation: sanitizeTransformation(data['transformation'], fallback.transformation),
    deboning: sanitizeDeboning(data['deboning'], fallback.deboning),
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

// Uma análise salva sem lista de produtos não faz sentido reabrir: a
// sub-árvore `deboning` é obrigatória (sem fallback para a estatística).
function sanitizeDeboningHistoryEntry(value: unknown): DeboningHistoryEntry | null {
  if (!isRecord(value)) return null;
  const { id, savedAt } = value;
  if (typeof id !== 'string' || typeof savedAt !== 'string') return null;
  const deboning = value['deboning'];
  if (!isRecord(deboning) || !Array.isArray(deboning['products'])) return null;
  const summary = isRecord(value['summary']) ? value['summary'] : {};
  const products = sanitizeDeboningProducts(deboning['products']);
  return {
    id,
    savedAt,
    deboning: {
      carcassWeightKg: numberOrNull(deboning['carcassWeightKg'], null),
      carcassCostPerKg: numberOrNull(deboning['carcassCostPerKg'], null),
      products,
    },
    summary: {
      carcassWeightKg: numberOrNull(summary['carcassWeightKg'], null),
      carcassValueBRL: numberOrNull(summary['carcassValueBRL'], null),
      commercialValueBRL: numberOrNull(summary['commercialValueBRL'], null),
      commercialGainBRL: numberOrNull(summary['commercialGainBRL'], null),
      marginPct: numberOrNull(summary['marginPct'], null),
      productCount: products.length,
    },
  };
}

export function loadDeboningHistory(): readonly DeboningHistoryEntry[] {
  const data = readEnvelope(DEBONING_HISTORY_STORAGE_KEY);
  if (!Array.isArray(data)) return [];
  return data
    .map(sanitizeDeboningHistoryEntry)
    .filter((entry): entry is DeboningHistoryEntry => entry !== null)
    .slice(0, HISTORY_LIMIT);
}

export function saveDeboningHistory(entries: readonly DeboningHistoryEntry[]): void {
  writeEnvelope(DEBONING_HISTORY_STORAGE_KEY, entries.slice(0, HISTORY_LIMIT));
}
