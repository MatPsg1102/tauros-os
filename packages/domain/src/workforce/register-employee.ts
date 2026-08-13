// Domínio: cadastro de colaborador (Gestão de Equipe). Modelo congelado:
// COLABORADOR (employees) + VÍNCULO temporal (employee_assignments) com
// POSIÇÃO operacional e EQUIPE — conceitos distintos; a equipe nunca entra
// no nome da posição e nenhuma permissão deriva do papel ocupado (ADR-018).
// A EXISTÊNCIA da posição/equipe na loja é validada pela aplicação (ports).
// PURO: sem relógio real, aleatoriedade ou infra.

export interface RegisterEmployeeCommand {
  /** UUIDs definitivos gerados no cliente (id generator port). */
  readonly employeeId: string;
  readonly assignmentId: string;
  readonly storeId: string;
  readonly fullName: string;
  /** Data civil YYYY-MM-DD (fuso da loja) do início do vínculo. */
  readonly startDate: string;
  readonly positionId: string;
  readonly teamId: string;
  /** Horário do cliente (clock port da aplicação). */
  readonly clientCreatedAt: Date;
  readonly idempotencyKey: string;
}

export type RegisterEmployeeRejectionCode =
  'NAME_REQUIRED' | 'INVALID_DATE' | 'POSITION_REQUIRED' | 'TEAM_REQUIRED' | 'INVALID_COMMAND';

export interface RegisteredEmployee {
  readonly id: string;
  readonly storeId: string;
  readonly fullName: string;
  readonly active: true;
  readonly clientCreatedAt: Date;
  readonly idempotencyKey: string;
}

export interface RegisteredAssignment {
  readonly id: string;
  readonly storeId: string;
  readonly employeeId: string;
  readonly teamId: string;
  readonly operationalPositionId: string;
  readonly validFrom: string;
  readonly validUntil: null;
}

export type RegisterEmployeeDecision =
  /** Novo colaborador + vínculo devem ser criados e sincronizados. */
  | {
      readonly kind: 'register';
      readonly employee: RegisteredEmployee;
      readonly assignment: RegisteredAssignment;
    }
  /** Reapresentação idempotente do MESMO cadastro (não é erro). */
  | { readonly kind: 'already-registered'; readonly employeeId: string }
  /** Invariante violada — nada deve ser persistido nem enfileirado. */
  | {
      readonly kind: 'rejected';
      readonly code: RegisterEmployeeRejectionCode;
      readonly detail: string;
    };

const MAX_NAME_LENGTH = 120;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Regras de domínio (invariáveis): nome obrigatório e legível (trim, nunca
 * só espaços); data de início civil válida; posição e equipe obrigatórias
 * (referências — a existência é checada pela aplicação). Reapresentação com
 * a mesma chave é reconhecida como o MESMO cadastro (double-submit converge).
 */
export function decideRegisterEmployee(
  command: RegisterEmployeeCommand,
  existingEmployeeId: string | null,
): RegisterEmployeeDecision {
  // replay: a mesma chave de idempotência já produziu um cadastro
  if (existingEmployeeId !== null) {
    return { kind: 'already-registered', employeeId: existingEmployeeId };
  }

  const required: readonly (readonly [string, string])[] = [
    ['employeeId', command.employeeId],
    ['assignmentId', command.assignmentId],
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

  const fullName = command.fullName.trim();
  if (fullName === '') {
    return { kind: 'rejected', code: 'NAME_REQUIRED', detail: 'o colaborador precisa de um nome' };
  }
  if (fullName.length > MAX_NAME_LENGTH) {
    return {
      kind: 'rejected',
      code: 'NAME_REQUIRED',
      detail: `nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres`,
    };
  }

  if (!CIVIL_DATE.test(command.startDate)) {
    return { kind: 'rejected', code: 'INVALID_DATE', detail: 'data de início inválida' };
  }

  if (command.positionId.trim() === '') {
    return {
      kind: 'rejected',
      code: 'POSITION_REQUIRED',
      detail: 'o colaborador precisa de uma função/posição',
    };
  }
  if (command.teamId.trim() === '') {
    return {
      kind: 'rejected',
      code: 'TEAM_REQUIRED',
      detail: 'o colaborador precisa de uma equipe',
    };
  }

  return {
    kind: 'register',
    employee: {
      id: command.employeeId,
      storeId: command.storeId,
      fullName,
      active: true,
      clientCreatedAt: command.clientCreatedAt,
      idempotencyKey: command.idempotencyKey,
    },
    assignment: {
      id: command.assignmentId,
      storeId: command.storeId,
      employeeId: command.employeeId,
      teamId: command.teamId,
      operationalPositionId: command.positionId,
      validFrom: command.startDate,
      validUntil: null,
    },
  };
}
