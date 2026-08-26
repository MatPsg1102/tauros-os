// Formatação de APRESENTAÇÃO pt-BR (Frontend Experience V2) — a data
// operacional civil (YYYY-MM-DD, fuso da LOJA) nunca chega ao operador em
// ISO cru. Só formatação: nenhum cálculo de fuso ou de escala acontece aqui.

const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

/** '2026-08-25' → '25/08'. Entrada inválida/nula degrada para '—'. */
export function shortDateLabel(operationalDate: string | null): string {
  if (operationalDate === null || operationalDate.length < 10) return '—';
  return `${operationalDate.slice(8, 10)}/${operationalDate.slice(5, 7)}`;
}

/**
 * '2026-08-25' → 'seg · 25/08'. O dia da semana é derivado da PRÓPRIA data
 * civil (calendário puro — determinístico, sem relógio nem fuso do aparelho).
 */
export function operationalDateLabel(operationalDate: string | null): string {
  if (operationalDate === null || operationalDate.length < 10) return '—';
  const year = Number(operationalDate.slice(0, 4));
  const month = Number(operationalDate.slice(5, 7));
  const day = Number(operationalDate.slice(8, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '—';
  const weekday = WEEKDAY_SHORT[new Date(year, month - 1, day).getDay()];
  return `${weekday ?? ''} · ${shortDateLabel(operationalDate)}`.replace(/^ · /, '');
}
