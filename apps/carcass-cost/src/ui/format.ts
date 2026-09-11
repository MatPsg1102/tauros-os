// Formatação de apresentação — o ÚNICO lugar onde se arredonda (2 casas).
// O domínio entrega números com precisão total; frações de rendimento/quebra
// chegam como 0–1 e viram % aqui.

const CURRENCY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DECIMAL = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DATE_TIME = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function formatBRL(value: number): string {
  return CURRENCY.format(value);
}

export function formatPerKg(value: number): string {
  return `${CURRENCY.format(value)}/kg`;
}

export function formatKg(value: number): string {
  return `${DECIMAL.format(value)} kg`;
}

/** Recebe fração 0–1 e apresenta como percentual com 2 casas. */
export function formatPct(fractionValue: number): string {
  return `${DECIMAL.format(fractionValue * 100)}%`;
}

/** Diferença em pontos percentuais (já em p.p.), com sinal e 2 casas. */
export function formatPoints(points: number): string {
  const sign = points > 0 ? '+' : '';
  return `${sign}${DECIMAL.format(points)} p.p.`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME.format(date);
}

/** Adaptadores da UI para o CurrencyInput (contrato em centavos inteiros). */
export function toMinorUnits(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100);
}

export function fromMinorUnits(value: number | null): number | null {
  return value === null ? null : value / 100;
}
