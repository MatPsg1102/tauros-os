// Domínio: criação de posição operacional (Gestão de Equipe). POSIÇÃO é o
// papel operacional oficial de atribuição (operational_positions,
// target_position_id) — dado configurável (ADR-019). Nome nunca embute a
// equipe; a UNICIDADE da chave por loja é resolvida pela aplicação (port).
// PURO: sem relógio real, aleatoriedade ou infra.

export interface CreatePositionCommand {
  /** UUID definitivo gerado no cliente (id generator port). */
  readonly positionId: string;
  readonly storeId: string;
  readonly name: string;
  /** Chave estável derivada do nome (aplicação) — unique por loja. */
  readonly key: string;
  /** Horário do cliente (clock port da aplicação). */
  readonly clientCreatedAt: Date;
  readonly idempotencyKey: string;
}

export type CreatePositionRejectionCode = 'NAME_REQUIRED' | 'INVALID_COMMAND';

export interface CreatedPosition {
  readonly id: string;
  readonly storeId: string;
  readonly key: string;
  readonly name: string;
  readonly clientCreatedAt: Date;
  readonly idempotencyKey: string;
}

export type CreatePositionDecision =
  /** Nova posição deve ser criada e sincronizada. */
  | { readonly kind: 'create'; readonly position: CreatedPosition }
  /** Mesma chave natural já existe na loja (não é erro — converge). */
  | { readonly kind: 'already-created'; readonly positionId: string }
  /** Invariante violada — nada deve ser persistido nem enfileirado. */
  | {
      readonly kind: 'rejected';
      readonly code: CreatePositionRejectionCode;
      readonly detail: string;
    };

const MAX_NAME_LENGTH = 80;

/**
 * Regras de domínio (invariáveis): nome obrigatório e legível; a chave
 * derivada não pode ser vazia (nome sem nenhum caractere aproveitável).
 * Posição com a MESMA chave na loja é a MESMA posição (converge, sem
 * duplicata silenciosa).
 */
export function decideCreatePosition(
  command: CreatePositionCommand,
  existingPositionId: string | null,
): CreatePositionDecision {
  // chave natural já existente: duplo clique e nome repetido convergem
  if (existingPositionId !== null) {
    return { kind: 'already-created', positionId: existingPositionId };
  }

  const required: readonly (readonly [string, string])[] = [
    ['positionId', command.positionId],
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

  const name = command.name.trim();
  if (name === '') {
    return { kind: 'rejected', code: 'NAME_REQUIRED', detail: 'a posição precisa de um nome' };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      kind: 'rejected',
      code: 'NAME_REQUIRED',
      detail: `nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres`,
    };
  }
  if (command.key.trim() === '') {
    return {
      kind: 'rejected',
      code: 'NAME_REQUIRED',
      detail: 'o nome precisa conter letras ou números',
    };
  }

  return {
    kind: 'create',
    position: {
      id: command.positionId,
      storeId: command.storeId,
      key: command.key,
      name,
      clientCreatedAt: command.clientCreatedAt,
      idempotencyKey: command.idempotencyKey,
    },
  };
}
