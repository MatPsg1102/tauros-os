// Fronteira financeira do CurrencyInput (6.3.4 §7).
// Contrato interno: UNIDADE MÍNIMA inteira (centavos) — nunca float de reais.
// Intl.NumberFormat isolado aqui (testável); precisão vem da própria moeda.

export interface CurrencyContext {
  readonly locale: string;
  readonly currency: string;
}

const fractionCache = new Map<string, number>();

/** Casas decimais oficiais da moeda (BRL=2, JPY=0…), via Intl. */
export function currencyFractionDigits(ctx: CurrencyContext): number {
  const key = `${ctx.locale}|${ctx.currency}`;
  const cached = fractionCache.get(key);
  if (cached !== undefined) return cached;
  const digits =
    new Intl.NumberFormat(ctx.locale, {
      style: 'currency',
      currency: ctx.currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  fractionCache.set(key, digits);
  return digits;
}

/** Unidade mínima → texto formatado com símbolo (exibição no blur). */
export function formatMinorUnits(minor: number | null, ctx: CurrencyContext): string {
  if (minor === null) return '';
  const digits = currencyFractionDigits(ctx);
  return new Intl.NumberFormat(ctx.locale, {
    style: 'currency',
    currency: ctx.currency,
  }).format(minor / 10 ** digits);
}

/** Unidade mínima → texto de edição sem símbolo/agrupamento (foco). */
export function editTextFromMinorUnits(minor: number | null, ctx: CurrencyContext): string {
  if (minor === null) return '';
  const digits = currencyFractionDigits(ctx);
  return new Intl.NumberFormat(ctx.locale, {
    useGrouping: false,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits);
}

export interface CurrencyParseResult {
  /** Unidade mínima inteira, ou null (vazio OU inválido). */
  readonly valueInMinorUnits: number | null;
  readonly invalid: boolean;
}

/**
 * Texto (digitado ou colado, com ou sem símbolo/agrupadores) → unidade mínima.
 * Dígitos além da precisão da moeda são arredondados half-up (documentado).
 */
export function parseToMinorUnits(text: string, ctx: CurrencyContext): CurrencyParseResult {
  const trimmed = text.trim();
  if (trimmed === '') return { valueInMinorUnits: null, invalid: false };

  const parts = new Intl.NumberFormat(ctx.locale).formatToParts(12345.6);
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
  const group = parts.find((p) => p.type === 'group')?.value ?? '';

  // remove símbolo de moeda, código e espaços; preserva dígitos, sinal e separadores
  let cleaned = trimmed.replace(/[^\d.,\-\s  ]/g, '');
  cleaned = cleaned.replace(/[\s  ]/g, '');
  if (group !== '') cleaned = cleaned.split(group).join('');
  cleaned = cleaned.split(decimal).join('.');
  if (cleaned === '' || cleaned === '-') return { valueInMinorUnits: null, invalid: true };
  if (!/^-?\d+(\.\d*)?$/.test(cleaned)) return { valueInMinorUnits: null, invalid: true };

  const digits = currencyFractionDigits(ctx);
  const [intPart = '0', fracPart = ''] = cleaned.replace('-', '').split('.');
  const negative = cleaned.startsWith('-');
  const fracPadded = fracPart.padEnd(digits, '0');
  const fracUsed = fracPadded.slice(0, digits);
  const remainder = fracPadded.slice(digits);
  let minor = Number(intPart) * 10 ** digits + (digits > 0 ? Number(fracUsed) : 0);
  // arredondamento half-up do excedente de precisão
  if (remainder !== '' && Number(remainder[0]) >= 5) minor += 1;
  if (!Number.isSafeInteger(minor)) return { valueInMinorUnits: null, invalid: true };
  return { valueInMinorUnits: negative ? -minor : minor, invalid: false };
}
