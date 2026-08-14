// Ports da Escala Operacional. A aplicação depende SÓ destes contratos;
// adapters (IndexedDB, fila, auditoria) chegam pelo wiring. O read model é
// PRESENÇA PLANEJADA ("deveria trabalhar") — nunca presença REAL
// (comparecimento/falta/atestado são extensão futura, fora deste contrato).

import type { EmployeeAssignmentRecord, OperationalPositionRecord } from '../workforce/record.js';
import type { ShiftDefinitionRecord, ShiftPatternRecord } from './record.js';

export interface ScheduleRepositoryPort {
  definitions(storeId: string): Promise<readonly ShiftDefinitionRecord[]>;
  /** Busca pela chave NATURAL (storeId + janela) — duplicata converge. */
  definitionByWindow(
    storeId: string,
    startTime: string,
    endTime: string,
  ): Promise<ShiftDefinitionRecord | null>;
  saveDefinition(record: ShiftDefinitionRecord): Promise<void>;
  updateDefinitionSyncStatus(
    id: string,
    status: ShiftDefinitionRecord['syncStatus'],
  ): Promise<void>;
  patterns(storeId: string): Promise<readonly ShiftPatternRecord[]>;
  savePattern(record: ShiftPatternRecord): Promise<void>;
}

export interface CreateShiftDefinitionEnqueueInput {
  readonly queueItemId: string;
  readonly definition: ShiftDefinitionRecord;
}

export interface ChangeWorkPeriodEnqueueInput {
  readonly queueItemId: string;
  readonly idempotencyKey: string;
  readonly closedAssignment: EmployeeAssignmentRecord;
  readonly openedAssignment: EmployeeAssignmentRecord;
}

export interface ScheduleEnqueuePort {
  enqueueCreateShiftDefinition(input: CreateShiftDefinitionEnqueueInput): Promise<void>;
  enqueueChangeWorkPeriod(input: ChangeWorkPeriodEnqueueInput): Promise<void>;
}

// ===== Read model: presença PLANEJADA do dia (fonte oficial única) =====

/** Janela de trabalho planejada do colaborador na data. */
export interface PlannedWorkPeriodView {
  readonly shiftDefinitionId: string;
  readonly name: string;
  readonly startTime: string;
  readonly endTime: string;
}

/** Colaborador ESCALADO (planejado) na data — não afirma comparecimento. */
export interface PlannedEmployeeView {
  readonly employeeId: string;
  readonly fullName: string;
  readonly teamId: string;
  readonly positionId: string | null;
  readonly positionName: string | null;
  /** null = vínculo sem jornada declarada (anterior à Escala V1). */
  readonly workPeriod: PlannedWorkPeriodView | null;
}

export interface PlannedTeamView {
  readonly teamId: string;
  readonly teamName: string;
}

/**
 * Presença planejada resolvida para (loja, data operacional).
 * 'unconfigured' = a loja não tem padrão vigente/âncora para a data — estado
 * explícito, nunca um chute.
 */
export interface PlannedScheduleDay {
  readonly storeId: string;
  readonly operationalDate: string;
  readonly status: 'resolved' | 'unconfigured';
  readonly patternName: string | null;
  readonly scheduledTeams: readonly PlannedTeamView[];
  readonly employees: readonly PlannedEmployeeView[];
}

/** Insumos da resolução — carregados pelos repositórios da loja. */
export interface ScheduleResolutionSources {
  readonly positions: readonly OperationalPositionRecord[];
  readonly definitions: readonly ShiftDefinitionRecord[];
  readonly patterns: readonly ShiftPatternRecord[];
}
