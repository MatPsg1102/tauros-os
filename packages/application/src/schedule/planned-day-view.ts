// Read model PURO da presença planejada: registros da loja → PlannedScheduleDay.
// Extraído do LoadPlannedScheduleUseCase (UI Operacional V1.1) para que a
// MESMA montagem sirva ao use case identificado (/encarregado) e à leitura
// device-local do quadro compartilhado (/operacao) — a resolução em si segue
// exclusivamente em resolvePlannedDay (o ÚNICO resolver de escala, no domínio).

import { resolvePlannedDay } from '@tauros/domain';
import type {
  EmployeeAssignmentRecord,
  EmployeeRecord,
  OperationalPositionRecord,
  PlannedScheduleDay,
  ShiftDefinitionRecord,
  ShiftPatternRecord,
  TeamRecord,
} from '@tauros/contracts';

export interface PlannedScheduleDaySources {
  readonly employees: readonly EmployeeRecord[];
  readonly assignments: readonly EmployeeAssignmentRecord[];
  readonly teams: readonly TeamRecord[];
  readonly positions: readonly OperationalPositionRecord[];
  readonly definitions: readonly ShiftDefinitionRecord[];
  readonly patterns: readonly ShiftPatternRecord[];
}

/**
 * Resolve e ENRIQUECE (nomes, posição, jornada) a presença planejada de
 * (loja, data operacional). 'unconfigured' é estado explícito — nunca chute.
 */
export function buildPlannedScheduleDay(
  storeId: string,
  operationalDate: string,
  anchorDate: string | null,
  sources: PlannedScheduleDaySources,
): PlannedScheduleDay {
  const teamNameById = new Map(sources.teams.map((team) => [team.id, team.name]));
  const employeeById = new Map(sources.employees.map((employee) => [employee.id, employee]));
  const positionById = new Map(sources.positions.map((position) => [position.id, position]));
  const definitionById = new Map(
    sources.definitions.map((definition) => [definition.id, definition]),
  );

  const decision = resolvePlannedDay({
    storeId,
    operationalDate,
    anchorDate,
    patterns: sources.patterns.map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      effectiveFrom: pattern.effectiveFrom,
      effectiveUntil: pattern.effectiveUntil,
      days: pattern.days,
    })),
    teams: sources.teams.map((team) => ({
      id: team.id,
      name: team.name,
      rotationOffset: team.rotationOffset,
    })),
    employees: sources.employees.map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      active: employee.active,
    })),
    assignments: sources.assignments.map((assignment) => ({
      employeeId: assignment.employeeId,
      teamId: assignment.teamId,
      positionId: assignment.operationalPositionId,
      shiftDefinitionId: assignment.shiftDefinitionId,
      validFrom: assignment.validFrom,
      validUntil: assignment.validUntil,
    })),
  });

  if (decision.kind === 'unconfigured') {
    return {
      storeId,
      operationalDate,
      status: 'unconfigured',
      patternName: null,
      scheduledTeams: [],
      employees: [],
    };
  }

  return {
    storeId,
    operationalDate,
    status: 'resolved',
    patternName: decision.patternName,
    scheduledTeams: decision.scheduledTeamIds.map((teamId) => ({
      teamId,
      teamName: teamNameById.get(teamId) ?? teamId,
    })),
    employees: decision.employees.map((planned) => {
      const definition =
        planned.shiftDefinitionId !== null
          ? definitionById.get(planned.shiftDefinitionId)
          : undefined;
      return {
        employeeId: planned.employeeId,
        fullName: employeeById.get(planned.employeeId)?.fullName ?? planned.employeeId,
        teamId: planned.teamId,
        positionId: planned.positionId,
        positionName:
          planned.positionId !== null ? (positionById.get(planned.positionId)?.name ?? null) : null,
        workPeriod:
          definition === undefined
            ? null
            : {
                shiftDefinitionId: definition.id,
                name: definition.name,
                startTime: definition.startTime,
                endTime: definition.endTime,
              },
      };
    }),
  };
}
