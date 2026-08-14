// Use case: FONTE OFICIAL ÚNICA da presença PLANEJADA ("quem está escalado
// nesta loja, nesta data?"). Toda a resolução acontece no domínio
// (resolvePlannedDay) — UI, tarefas e controllers apenas perguntam aqui;
// nenhum outro módulo calcula escala. Resolve por loja + data + configuração
// DA LOJA (padrão vigente, âncora, offsets) — nunca uma regra global.
// Presença planejada ≠ presença real (comparecimento é extensão futura).

import { resolvePlannedDay } from '@tauros/domain';
import {
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type EffectiveAuthorization,
  type PlannedScheduleDay,
  type ScheduleRepositoryPort,
  type WorkforceRepositoryPort,
} from '@tauros/contracts';

export interface LoadPlannedScheduleInput {
  readonly authorization: EffectiveAuthorization;
  /** Âncora da rotação da LOJA (stores.shift_anchor_date); null = sem escala. */
  readonly storeAnchorDate: string | null;
  /** Datas operacionais YYYY-MM-DD (fuso da loja) a resolver, em ordem. */
  readonly operationalDates: readonly string[];
}

export type LoadPlannedScheduleFailureCode = 'SNAPSHOT_EXPIRED' | 'SNAPSHOT_VERSION_INCOMPATIBLE';

export type LoadPlannedScheduleResult =
  | { readonly kind: 'loaded'; readonly days: readonly PlannedScheduleDay[] }
  | {
      readonly kind: 'failed';
      readonly code: LoadPlannedScheduleFailureCode;
      readonly detail: string;
    };

export class LoadPlannedScheduleUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly workforce: WorkforceRepositoryPort,
    private readonly schedule: ScheduleRepositoryPort,
  ) {}

  async execute(input: LoadPlannedScheduleInput): Promise<LoadPlannedScheduleResult> {
    const now = this.clock.now();
    const auth = input.authorization;
    if (auth.validUntil.getTime() <= now.getTime()) {
      return { kind: 'failed', code: 'SNAPSHOT_EXPIRED', detail: 'autorização offline expirada' };
    }
    if (
      auth.permissionModelVersion !== undefined &&
      auth.permissionModelVersion !== PERMISSION_MODEL_VERSION
    ) {
      return {
        kind: 'failed',
        code: 'SNAPSHOT_VERSION_INCOMPATIBLE',
        detail: `permission_model_version ${String(auth.permissionModelVersion)} incompatível`,
      };
    }

    const storeId = auth.storeId;
    const [employees, assignments, teams, positions, definitions, patterns] = await Promise.all([
      this.workforce.employees(storeId),
      this.workforce.assignments(storeId),
      this.workforce.teams(storeId),
      this.workforce.positions(storeId),
      this.schedule.definitions(storeId),
      this.schedule.patterns(storeId),
    ]);

    const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const positionById = new Map(positions.map((position) => [position.id, position]));
    const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));

    const days: PlannedScheduleDay[] = input.operationalDates.map((operationalDate) => {
      const decision = resolvePlannedDay({
        storeId,
        operationalDate,
        anchorDate: input.storeAnchorDate,
        patterns: patterns.map((pattern) => ({
          id: pattern.id,
          name: pattern.name,
          effectiveFrom: pattern.effectiveFrom,
          effectiveUntil: pattern.effectiveUntil,
          days: pattern.days,
        })),
        teams: teams.map((team) => ({
          id: team.id,
          name: team.name,
          rotationOffset: team.rotationOffset,
        })),
        employees: employees.map((employee) => ({
          id: employee.id,
          fullName: employee.fullName,
          active: employee.active,
        })),
        assignments: assignments.map((assignment) => ({
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
          status: 'unconfigured' as const,
          patternName: null,
          scheduledTeams: [],
          employees: [],
        };
      }

      return {
        storeId,
        operationalDate,
        status: 'resolved' as const,
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
              planned.positionId !== null
                ? (positionById.get(planned.positionId)?.name ?? null)
                : null,
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
    });

    return { kind: 'loaded', days };
  }
}
