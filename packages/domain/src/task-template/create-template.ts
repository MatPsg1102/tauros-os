// Domínio: criação de definição de tarefa pelo encarregado (Área do
// Encarregado). Modelo congelado: task_templates com atribuição por POSIÇÃO
// (target_position_id) — não existe atribuição por funcionário, descrição nem
// prioridade. PURO: sem relógio real, sem aleatoriedade, sem infraestrutura.

/** task_frequency do schema congelado (sem valores novos). */
export type TemplateFrequency = 'ONCE' | 'DAILY' | 'PER_SHIFT' | 'HOURLY' | 'CUSTOM';

export interface CreateTemplateCommand {
  /** UUID definitivo gerado no cliente (id generator port). */
  readonly templateId: string;
  readonly storeId: string;
  readonly title: string;
  readonly frequency: TemplateFrequency;
  /** Posição operacional responsável — unidade OFICIAL de atribuição. */
  readonly targetPositionId: string;
  readonly requiresPhoto: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  /** Horário do cliente (clock port da aplicação). */
  readonly clientCreatedAt: Date;
  /** Minutos após o início do dia operacional em que a tarefa vence. */
  readonly dueOffsetMinutes: number;
  readonly idempotencyKey: string;
}

export type CreateTemplateRejectionCode =
  | 'TITLE_REQUIRED'
  | 'ASSIGNMENT_REQUIRED'
  | 'INVALID_DUE_TIME'
  | 'INVALID_RANGE'
  | 'INVALID_COMMAND';

export interface CreatedTemplate {
  readonly id: string;
  readonly storeId: string;
  readonly title: string;
  readonly frequency: TemplateFrequency;
  readonly targetPositionId: string;
  readonly requiresPhoto: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  readonly active: true;
  readonly clientCreatedAt: Date;
  readonly dueOffsetMinutes: number;
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

/**
 * Regras de domínio (invariáveis — não são parâmetro de configuração):
 * título obrigatório e legível; atribuição por posição obrigatória neste
 * fluxo; vencimento dentro do dia operacional; faixa esperada coerente.
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

  if (command.targetPositionId.trim() === '') {
    return {
      kind: 'rejected',
      code: 'ASSIGNMENT_REQUIRED',
      detail: 'a tarefa precisa de uma posição responsável',
    };
  }

  if (
    !Number.isInteger(command.dueOffsetMinutes) ||
    command.dueOffsetMinutes < 0 ||
    command.dueOffsetMinutes >= MINUTES_IN_DAY
  ) {
    return {
      kind: 'rejected',
      code: 'INVALID_DUE_TIME',
      detail: 'o horário limite deve estar dentro do dia operacional',
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
      targetPositionId: command.targetPositionId,
      requiresPhoto: command.requiresPhoto,
      expectedMin: command.expectedMin,
      expectedMax: command.expectedMax,
      active: true,
      clientCreatedAt: command.clientCreatedAt,
      dueOffsetMinutes: command.dueOffsetMinutes,
      idempotencyKey: command.idempotencyKey,
    },
  };
}
