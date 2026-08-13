// Domínio: REGRA de materialização de uma definição recorrente numa data
// operacional. PURA — recebe o veredito da escala como booleano; NÃO conhece
// 12x36, calendário nem infraestrutura. A aplicação computa o dia da semana e
// consulta a escala oficial (ShiftSchedulePort) antes de chamar aqui.

import { ALL_WEEKDAYS, type TaskRecurrence, type Weekday } from '@tauros/contracts';

/** Regra vigente de uma definição para fins de materialização. */
export interface MaterializationRule {
  readonly recurrence: TaskRecurrence;
  /** Data civil YYYY-MM-DD do início da vigência. */
  readonly effectiveFrom: string;
}

/** Contexto da data avaliada — tudo já resolvido pela aplicação. */
export interface MaterializationContext {
  /** Data civil YYYY-MM-DD (fuso da LOJA) sendo materializada. */
  readonly workDate: string;
  readonly weekday: Weekday;
  /** Veredito da escala oficial (só relevante em WHEN_SCHEDULED). */
  readonly isScheduled: boolean;
}

/**
 * Dia da semana civil de uma data YYYY-MM-DD, determinístico e sem fuso do
 * dispositivo (a data já é civil da loja). 1970-01-01 foi uma quinta (THU).
 */
export function weekdayOf(workDate: string): Weekday {
  const [y, m, d] = workDate.split('-').map(Number) as [number, number, number];
  // UTC evita qualquer influência do fuso local — a data já é civil.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Dom..6=Sáb
  const MON_FIRST: readonly Weekday[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return MON_FIRST[dow] ?? 'MON';
}

/**
 * A definição deve materializar uma ocorrência nesta data?
 * - nunca antes da data inicial de vigência;
 * - ONCE: apenas na própria data inicial;
 * - WEEKDAYS: nos dias da semana escolhidos;
 * - WHEN_SCHEDULED: quando a posição alvo está escalada (veredito externo).
 */
export function shouldMaterialize(
  rule: MaterializationRule,
  context: MaterializationContext,
): boolean {
  if (context.workDate < rule.effectiveFrom) return false;
  const recurrence = rule.recurrence;
  if (recurrence.kind === 'ONCE') return context.workDate === rule.effectiveFrom;
  if (recurrence.kind === 'WEEKDAYS') return recurrence.weekdays.includes(context.weekday);
  return context.isScheduled; // WHEN_SCHEDULED
}

/** Recorrência "todo dia" — default de compatibilidade (fonte sem regra). */
export const EVERY_DAY: TaskRecurrence = { kind: 'WEEKDAYS', weekdays: ALL_WEEKDAYS };
