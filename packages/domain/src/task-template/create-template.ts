// Domínio: criação de definição de tarefa pelo encarregado (Área do
// Encarregado). Modelo congelado + PLANEJAMENTO: atribuição por POSIÇÃO
// (target_position_id) agora OPCIONAL ("definir no dia"), data inicial de
// vigência, início/fim planejados e recorrência (ONCE | WEEKDAYS |
// WHEN_SCHEDULED). Sem atribuição por funcionário, descrição, prioridade nem
// horários REAIS de execução. PURO: sem relógio real, aleatoriedade ou infra.

import type { TaskRecurrence } from '@tauros/contracts';

/** task_frequency do schema congelado (sem valores novos). */
export type TemplateFrequency = 'ONCE' | 'DAILY' | 'PER_SHIFT' | 'HOURLY' | 'CUSTOM';

export interface CreateTemplateCommand {
  /** UUID definitivo gerado no cliente (id generator port). */
  readonly templateId: string;
  readonly storeId: string;
  readonly title: string;
  readonly frequency: TemplateFrequency;
  /** Posição responsável — null = "definir no dia" (sem responsável). */
  readonly targetPositionId: string | null;
  readonly requiresPhoto: boolean;
  /** Exige conferência do encarregado após a execução (default: não). */
  readonly requiresReview?: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  /** Horário do cliente (clock port da aplicação). */
  readonly clientCreatedAt: Date;
  /** Data civil YYYY-MM-DD do início da vigência. */
  readonly effectiveFrom: string;
  /** Minutos após o início do dia operacional do INÍCIO planejado. */
  readonly plannedStartMinutes: number;
  /** Minutos após o início do dia operacional do FIM máximo. */
  readonly dueOffsetMinutes: number;
  readonly recurrence: TaskRecurrence;
  readonly idempotencyKey: string;
}

export type CreateTemplateRejectionCode =
  | 'TITLE_REQUIRED'
  | 'ASSIGNMENT_REQUIRED'
  | 'INVALID_DUE_TIME'
  | 'INVALID_TIME_RANGE'
  | 'INVALID_DATE'
  | 'INVALID_RECURRENCE'
  | 'INVALID_RANGE'
  | 'INVALID_COMMAND';

export interface CreatedTemplate {
  readonly id: string;
  readonly storeId: string;
  readonly title: string;
  readonly frequency: TemplateFrequency;
  readonly targetPositionId: string | null;
  readonly requiresPhoto: boolean;
  readonly requiresReview: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  readonly active: true;
  readonly clientCreatedAt: Date;
  readonly effectiveFrom: string;
  readonly plannedStartMinutes: number;
  readonly dueOffsetMinutes: number;
  readonly recurrence: TaskRecurrence;
  readonly idempotencyKey: string;
}

export type CreateTemplateDecision =
  /** Nova definição deve ser criada e sincronizada. */
  | { readonly kind: 'create'; readonly template: CreatedTemplate }
  /** Reapresentação idempotente da MESMA criação (não é erro). */
  | { readonly kind: 'already-created'; readonly templateId: string }
  /** Invariante violada — nada deve ser persistido nem enfileirado. */
  | {
      readonly kind: 'rejected';
      readonly code: CreateTemplateRejectionCode;
      readonly detail: string;
    };

const MINUTES_IN_DAY = 24 * 60;
const MAX_TITLE_LENGTH = 120;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Minuto válido dentro do dia operacional [0, 1440). */
function validMinuteOfDay(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < MINUTES_IN_DAY;
}

/**
 * Regras de domínio (invariáveis — não são parâmetro de configuração):
 * título obrigatório e legível; atribuição por posição OPCIONAL, exceto em
 * WHEN_SCHEDULED (não há como perguntar "está escalado?" sem posição alvo);
 * data inicial civil válida; início/fim planejados dentro do dia com fim >
 * início; WEEKDAYS exige ao menos um dia; faixa esperada coerente.
 * Reapresentação com a mesma chave é reconhecida como a MESMA criação.
 */
export function decideCreateTemplate(
  command: CreateTemplateCommand,
  existingTemplateId: string | null,
): CreateTemplateDecision {
  // replay: a mesma chave de idempotência já produziu uma definição
  if (existingTemplateId !== null) {
    return { kind: 'already-created', templateId: existingTemplateId };
  }

  const required: readonly (readonly [string, string])[] = [
    ['templateId', command.templateId],
    ['storeId', command.storeId],
    ['idempotencyKey', command.idempotencyKey],
  ];
  for (const [name, value] of required) {
    if (value.trim() === '') {
      return { kind: 'rejected', code: 'INVALID_COMMAND', detail: `campo obrigatório: ${name}` };
    }
  }
  if (Number.isNaN(command.clientCreatedAt.getTime())) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'clientCreatedAt inválido' };
  }

  const title = command.title.trim();
  if (title === '') {
    return { kind: 'rejected', code: 'TITLE_REQUIRED', detail: 'a tarefa precisa de um título' };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      kind: 'rejected',
      code: 'TITLE_REQUIRED',
      detail: `título deve ter no máximo ${MAX_TITLE_LENGTH} caracteres`,
    };
  }

  // atribuição por posição: opcional, EXCETO quando a recorrência depende da
  // escala da posição (WHEN_SCHEDULED) — aí a posição alvo é indispensável.
  const targetPositionId =
    command.targetPositionId !== null && command.targetPositionId.trim() !== ''
      ? command.targetPositionId
      : null;
  if (command.recurrence.kind === 'WHEN_SCHEDULED' && targetPositionId === null) {
    return {
      kind: 'rejected',
      code: 'ASSIGNMENT_REQUIRED',
      detail: '"quando estiver escalado" exige uma posição responsável',
    };
  }

  if (command.recurrence.kind === 'WEEKDAYS' && command.recurrence.weekdays.length === 0) {
    return {
      kind: 'rejected',
      code: 'INVALID_RECURRENCE',
      detail: 'escolha ao menos um dia da semana',
    };
  }

  if (!CIVIL_DATE.test(command.effectiveFrom)) {
    return { kind: 'rejected', code: 'INVALID_DATE', detail: 'data inicial inválida' };
  }

  if (
    !validMinuteOfDay(command.plannedStartMinutes) ||
    !validMinuteOfDay(command.dueOffsetMinutes)
  ) {
    return {
      kind: 'rejected',
      code: 'INVALID_DUE_TIME',
      detail: 'os horários devem estar dentro do dia operacional',
    };
  }
  if (command.dueOffsetMinutes <= command.plannedStartMinutes) {
    return {
      kind: 'rejected',
      code: 'INVALID_TIME_RANGE',
      detail: 'o fim máximo deve ser maior que o início planejado',
    };
  }

  if (
    command.expectedMin !== null &&
    command.expectedMax !== null &&
    command.expectedMin > command.expectedMax
  ) {
    return {
      kind: 'rejected',
      code: 'INVALID_RANGE',
      detail: 'a faixa esperada está invertida (mínimo maior que máximo)',
    };
  }

  return {
    kind: 'create',
    template: {
      id: command.templateId,
      storeId: command.storeId,
      title,
      frequency: command.frequency,
      targetPositionId,
      requiresPhoto: command.requiresPhoto,
      requiresReview: command.requiresReview ?? false,
      expectedMin: command.expectedMin,
      expectedMax: command.expectedMax,
      active: true,
      clientCreatedAt: command.clientCreatedAt,
      effectiveFrom: command.effectiveFrom,
      plannedStartMinutes: command.plannedStartMinutes,
      dueOffsetMinutes: command.dueOffsetMinutes,
      recurrence: command.recurrence,
      idempotencyKey: command.idempotencyKey,
    },
  };
}
