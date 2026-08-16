// Use case: FONTE OFICIAL ÚNICA da presença PLANEJADA ("quem está escalado
// nesta loja, nesta data?"). Toda a resolução acontece no domínio
// (resolvePlannedDay) — UI, tarefas e controllers apenas perguntam aqui;
// nenhum outro módulo calcula escala. Resolve por loja + data + configuração
// DA LOJA (padrão vigente, âncora, offsets) — nunca uma regra global.
// Presença planejada ≠ presença real (comparecimento é extensão futura).

import {
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type EffectiveAuthorization,
  type PlannedScheduleDay,
  type ScheduleRepositoryPort,
  type WorkforceRepositoryPort,
} from '@tauros/contracts';

import { buildPlannedScheduleDay } from './planned-day-view.js';

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

    // resolução + enriquecimento compartilhados com a leitura device-local
    // do quadro (planned-day-view) — regra única, nunca duplicada
    const days: PlannedScheduleDay[] = input.operationalDates.map((operationalDate) =>
      buildPlannedScheduleDay(storeId, operationalDate, input.storeAnchorDate, {
        employees,
        assignments,
        teams,
        positions,
        definitions,
        patterns,
      }),
    );

    return { kind: 'loaded', days };
  }
}
