// Domínio: criação de JORNADA (ShiftDefinition — janela de horário).
// Jornada ≠ padrão de escala: aqui só existe a janela HH:MM–HH:MM; QUAIS
// dias se trabalha é assunto do padrão cíclico. Janela com fim menor que o
// início representa turno que vira o dia (aceito pelo modelo). PURO.

export interface CreateShiftDefinitionCommand {
  /** UUID definitivo gerado no cliente (id generator port). */
  readonly definitionId: string;
  readonly storeId: string;
  /** Nome exibido; vazio ⇒ derivado da janela ("HH:MM–HH:MM"). */
  readonly name: string;
  readonly startTime: string;
  readonly endTime: string;
  /** Horário do cliente (clock port da aplicação). */
  readonly clientCreatedAt: Date;
  readonly idempotencyKey: string;
}

export type CreateShiftDefinitionRejectionCode =
  'INVALID_TIME' | 'EMPTY_WINDOW' | 'NAME_TOO_LONG' | 'INVALID_COMMAND';

export interface CreatedShiftDefinition {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly clientCreatedAt: Date;
  readonly idempotencyKey: string;
}

export type CreateShiftDefinitionDecision =
  | { readonly kind: 'create'; readonly definition: CreatedShiftDefinition }
  /** Mesma janela na loja (chave natural) — converge, não duplica. */
  | { readonly kind: 'already-created'; readonly definitionId: string }
  | {
      readonly kind: 'rejected';
      readonly code: CreateShiftDefinitionRejectionCode;
      readonly detail: string;
    };

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NAME_LENGTH = 60;

export function decideCreateShiftDefinition(
  command: CreateShiftDefinitionCommand,
  existingDefinitionId: string | null,
): CreateShiftDefinitionDecision {
  if (existingDefinitionId !== null) {
    return { kind: 'already-created', definitionId: existingDefinitionId };
  }

  const required: readonly (readonly [string, string])[] = [
    ['definitionId', command.definitionId],
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

  if (!TIME_OF_DAY.test(command.startTime) || !TIME_OF_DAY.test(command.endTime)) {
    return { kind: 'rejected', code: 'INVALID_TIME', detail: 'horário deve estar em HH:MM' };
  }
  if (command.startTime === command.endTime) {
    return { kind: 'rejected', code: 'EMPTY_WINDOW', detail: 'início e fim não podem ser iguais' };
  }

  const name =
    command.name.trim() === '' ? `${command.startTime}–${command.endTime}` : command.name.trim();
  if (name.length > MAX_NAME_LENGTH) {
    return {
      kind: 'rejected',
      code: 'NAME_TOO_LONG',
      detail: `nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres`,
    };
  }

  return {
    kind: 'create',
    definition: {
      id: command.definitionId,
      storeId: command.storeId,
      name,
      startTime: command.startTime,
      endTime: command.endTime,
      clientCreatedAt: command.clientCreatedAt,
      idempotencyKey: command.idempotencyKey,
    },
  };
}
