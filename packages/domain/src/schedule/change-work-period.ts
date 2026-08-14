// Domínio: troca de JORNADA do colaborador — o histórico é preservado por
// VIGÊNCIA: o vínculo vigente é FECHADO (validUntil = véspera) e um novo é
// aberto com a jornada nova; nada é sobrescrito. Equipe e posição seguem as
// mesmas — trocar jornada não muda equipe. PURO.

export interface CurrentAssignmentView {
  readonly id: string;
  readonly storeId: string;
  readonly employeeId: string;
  readonly teamId: string | null;
  readonly positionId: string | null;
  readonly shiftDefinitionId: string | null;
  readonly validFrom: string;
}

export interface ChangeWorkPeriodCommand {
  /** UUID definitivo do NOVO vínculo (id generator port). */
  readonly newAssignmentId: string;
  readonly current: CurrentAssignmentView | null;
  readonly newShiftDefinitionId: string;
  /** Data civil YYYY-MM-DD (fuso da loja) em que a jornada nova passa a valer. */
  readonly changeDate: string;
}

export type ChangeWorkPeriodRejectionCode =
  'NO_CURRENT_ASSIGNMENT' | 'INVALID_DATE' | 'INVALID_COMMAND';

export interface ClosedAssignmentPatch {
  readonly assignmentId: string;
  readonly validUntil: string;
}

export interface OpenedAssignment {
  readonly id: string;
  readonly storeId: string;
  readonly employeeId: string;
  readonly teamId: string | null;
  readonly positionId: string | null;
  readonly shiftDefinitionId: string;
  readonly validFrom: string;
  readonly validUntil: null;
}

export type ChangeWorkPeriodDecision =
  | {
      readonly kind: 'change';
      readonly closed: ClosedAssignmentPatch;
      readonly opened: OpenedAssignment;
    }
  /** A jornada vigente já é a pedida — reapresentação converge. */
  | { readonly kind: 'already-applied'; readonly assignmentId: string }
  | {
      readonly kind: 'rejected';
      readonly code: ChangeWorkPeriodRejectionCode;
      readonly detail: string;
    };

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Véspera civil de uma data YYYY-MM-DD (aritmética UTC, sem fuso). */
export function previousCivilDay(date: string): string {
  const utc = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  return new Date(utc - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function decideChangeWorkPeriod(command: ChangeWorkPeriodCommand): ChangeWorkPeriodDecision {
  if (command.newAssignmentId.trim() === '' || command.newShiftDefinitionId.trim() === '') {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'identificadores obrigatórios' };
  }
  if (!CIVIL_DATE.test(command.changeDate)) {
    return { kind: 'rejected', code: 'INVALID_DATE', detail: 'data da troca inválida' };
  }
  const current = command.current;
  if (current === null) {
    return {
      kind: 'rejected',
      code: 'NO_CURRENT_ASSIGNMENT',
      detail: 'colaborador sem vínculo vigente',
    };
  }
  if (current.shiftDefinitionId === command.newShiftDefinitionId) {
    return { kind: 'already-applied', assignmentId: current.id };
  }

  return {
    kind: 'change',
    closed: { assignmentId: current.id, validUntil: previousCivilDay(command.changeDate) },
    opened: {
      id: command.newAssignmentId,
      storeId: current.storeId,
      employeeId: current.employeeId,
      teamId: current.teamId,
      positionId: current.positionId,
      shiftDefinitionId: command.newShiftDefinitionId,
      validFrom: command.changeDate,
      validUntil: null,
    },
  };
}
