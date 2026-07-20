// Parsing numérico próprio (6.3.4 §6) — NÃO depende do parsing inconsistente
// de input[type=number]. Separadores por locale via Intl (fronteira testável).
// Regex linear (sem backtracking exponencial — §21).

export interface NumberParseResult {
  /** Valor numérico válido, ou null (vazio OU inválido — nunca zero implícito). */
  readonly value: number | null;
  /** true quando há texto que não representa número válido dentro das regras. */
  readonly invalid: boolean;
}

export interface NumberLocaleInfo {
  readonly decimal: string;
  readonly group: string;
}

const localeCache = new Map<string, NumberLocaleInfo>();

/** Separadores decimais/de milhar do locale, via Intl.NumberFormat. */
export function numberLocaleInfo(locale: string): NumberLocaleInfo {
  const cached = localeCache.get(locale);
  if (cached !== undefined) return cached;
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
  const group = parts.find((p) => p.type === 'group')?.value ?? '';
  const info: NumberLocaleInfo = { decimal, group };
  localeCache.set(locale, info);
  return info;
}

export interface ParseNumberOptions {
  readonly locale: string;
  readonly allowNegative: boolean;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}

/** Texto digitado → resultado. Vazio ⇒ { value: null, invalid: false }. */
export function parseNumberText(text: string, options: ParseNumberOptions): NumberParseResult {
  const trimmed = text.trim();
  if (trimmed === '') return { value: null, invalid: false };

  const { decimal, group } = numberLocaleInfo(options.locale);
  let normalized = trimmed;
  if (group !== '') normalized = normalized.split(group).join('');
  // NBSP/espaço fino usados como agrupador em alguns locales:
  normalized = normalized.replace(/[\s\u00A0\u202F]/g, '');
  normalized = normalized.split(decimal).join('.');
  // tolera dígito com '.' quando o locale usa ',' (entrada de teclado numérico)
  if (decimal !== '.' && normalized.includes('.')) {
    const dots = normalized.split('.').length - 1;
    if (dots > 1) return { value: null, invalid: true };
  }

  if (!/^-?\d+(\.\d*)?$/.test(normalized)) return { value: null, invalid: true };
  if (normalized.startsWith('-') && !options.allowNegative) return { value: null, invalid: true };

  const value = Number(normalized);
  if (!Number.isFinite(value)) return { value: null, invalid: true };
  if (options.min !== undefined && value < options.min) return { value, invalid: true };
  if (options.max !== undefined && value > options.max) return { value, invalid: true };
  return { value, invalid: false };
}

/** Número → texto no locale (sem agrupamento — campo de edição). */
export function formatNumberText(value: number | null, locale: string): string {
  if (value === null) return '';
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 12,
  }).format(value);
}
