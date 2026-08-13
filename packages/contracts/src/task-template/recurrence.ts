// Recorrência de planejamento de tarefas (Área do Encarregado). É a REGRA de
// materialização de uma definição — distinta de task_frequency (cadência
// congelada, mantida por fidelidade de schema). Três semânticas operacionais:
//   ONCE           — ocorre só na data inicial (effectiveFrom).
//   WEEKDAYS       — ocorre nos dias da semana escolhidos (a partir da data).
//   WHEN_SCHEDULED — ocorre quando a POSIÇÃO alvo está efetivamente escalada
//                    (a regra 12x36 NÃO vive aqui: a escala é a fonte oficial).
// "Todos os dias" é apenas WEEKDAYS com os sete dias — sem enum redundante.

/** Dias da semana canônicos (ordem operacional Seg→Dom). */
export const ALL_WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export type Weekday = (typeof ALL_WEEKDAYS)[number];

export type TaskRecurrence =
  | { readonly kind: 'ONCE' }
  | { readonly kind: 'WEEKDAYS'; readonly weekdays: readonly Weekday[] }
  | { readonly kind: 'WHEN_SCHEDULED' };

export type RecurrenceKind = TaskRecurrence['kind'];
