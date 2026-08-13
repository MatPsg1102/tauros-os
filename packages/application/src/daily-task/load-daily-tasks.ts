// Use case: carregar/materializar o quadro de tarefas do dia (7.2 + planejamento).
// Materialização LOCAL e idempotente a partir dos templates vigentes, agora
// governada pela RECORRÊNCIA da definição (ONCE | WEEKDAYS | WHEN_SCHEDULED) e
// pela data inicial de vigência. WHEN_SCHEDULED consulta a ESCALA oficial —
// releitura no mesmo dia NUNCA sobrescreve o desfecho já registrado.
// OVERDUE é derivado de due_at pelo domínio, jamais digitado.

import { EVERY_DAY, isOverdue, shouldMaterialize, weekdayOf } from '@tauros/domain';
import {
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type DailyTaskRecord,
  type DailyTaskRepositoryPort,
  type EffectiveAuthorization,
  type ShiftSchedulePort,
  type TaskTemplateSourcePort,
  type TaskTemplateSnapshot,
} from '@tauros/contracts';

export interface LoadDailyTasksInput {
  readonly authorization: EffectiveAuthorization;
  /** Data operacional civil YYYY-MM-DD no fuso da LOJA. */
  readonly workDate: string;
  /** Início do dia operacional (base do vencimento de cada tarefa). */
  readonly operationalDayStart: Date;
  readonly configVersionRef: string | null;
}

export type LoadDailyTasksFailureCode =
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'STORE_MISMATCH'
  | 'CONFIG_UNAVAILABLE'
  | 'PERSISTENCE_FAILED';

export type LoadDailyTasksResult =
  | { readonly kind: 'loaded'; readonly tasks: readonly DailyTaskRecord[] }
  | {
      readonly kind: 'failed';
      readonly code: LoadDailyTasksFailureCode;
      readonly detail: string;
    };

/**
 * Identidade local determinística da materialização do dia. O id definitivo
 * de daily_tasks é gerado pelo servidor: a reconciliação com ele é pendência
 * registrada (mesma classe do transporte fake).
 */
export function dailyTaskIdFor(storeId: string, workDate: string, templateId: string): string {
  return `daily-task:${storeId}:${workDate}:${templateId}`;
}

function minutesToIso(dayStart: Date, minutes: number): string {
  return new Date(dayStart.getTime() + minutes * 60 * 1000).toISOString();
}

function materialize(
  template: TaskTemplateSnapshot,
  input: LoadDailyTasksInput,
  storeId: string,
): DailyTaskRecord {
  const plannedStartMinutes = template.plannedStartMinutes;
  return {
    id: dailyTaskIdFor(storeId, input.workDate, template.templateId),
    storeId,
    templateId: template.templateId,
    workDate: input.workDate,
    plannedStartAt:
      plannedStartMinutes === undefined
        ? null
        : minutesToIso(input.operationalDayStart, plannedStartMinutes),
    dueAt: minutesToIso(input.operationalDayStart, template.dueOffsetMinutes),
    status: 'PENDING',
    // atribuição situacional começa vazia: o responsável efetivo é
    // template.targetPositionId (null ⇒ "sem responsável" até o encarregado atribuir)
    assignedPositionId: null,
    expectedMinSnapshot: template.expectedMin,
    expectedMaxSnapshot: template.expectedMax,
    configVersionRef: input.configVersionRef,
    template,
    lastExecutionId: null,
    syncStatus: null,
  };
}

export class LoadDailyTasksUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly templates: TaskTemplateSourcePort,
    private readonly repository: DailyTaskRepositoryPort,
    private readonly schedule: ShiftSchedulePort,
  ) {}

  /** A definição materializa nesta data? Aplica a recorrência (ou o default). */
  private async applies(
    template: TaskTemplateSnapshot,
    input: LoadDailyTasksInput,
    storeId: string,
  ): Promise<boolean> {
    const recurrence = template.recurrence ?? EVERY_DAY;
    const effectiveFrom = template.effectiveFrom ?? input.workDate;
    // WHEN_SCHEDULED depende da ESCALA da posição alvo; sem posição, não materializa
    let isScheduled = false;
    if (recurrence.kind === 'WHEN_SCHEDULED') {
      if (template.targetPositionId === null) return false;
      isScheduled = await this.schedule.isPositionScheduled(
        storeId,
        template.targetPositionId,
        input.workDate,
      );
    }
    return shouldMaterialize(
      { recurrence, effectiveFrom },
      { workDate: input.workDate, weekday: weekdayOf(input.workDate), isScheduled },
    );
  }

  async execute(input: LoadDailyTasksInput): Promise<LoadDailyTasksResult> {
    const now = this.clock.now();
    const auth = input.authorization;

    // ADR-018: revalidação na aplicação também na LEITURA do quadro.
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

    let templates: readonly TaskTemplateSnapshot[];
    try {
      templates = await this.templates.activeTemplates(auth.storeId);
    } catch (error) {
      return {
        kind: 'failed',
        code: 'CONFIG_UNAVAILABLE',
        detail: error instanceof Error ? error.message : 'definições de tarefa indisponíveis',
      };
    }

    const persisted = await this.repository.byWorkDate(auth.storeId, input.workDate);
    const byId = new Map(persisted.map((task) => [task.id, task]));

    // materializa apenas templates aplicáveis à data (recorrência/escala) e
    // ainda não materializados (idempotente). Uma ocorrência já existente
    // NUNCA é apagada por mudança de recorrência/escala — só deixa de nascer.
    const applicable: TaskTemplateSnapshot[] = [];
    for (const template of templates) {
      if (await this.applies(template, input, auth.storeId)) applicable.push(template);
    }
    const created = applicable
      .map((template) => materialize(template, input, auth.storeId))
      .filter((task) => !byId.has(task.id));
    if (created.length > 0) {
      try {
        await this.repository.saveAll(created);
      } catch (error) {
        return {
          kind: 'failed',
          code: 'PERSISTENCE_FAILED',
          detail: error instanceof Error ? error.message : 'falha ao materializar o dia',
        };
      }
    }

    const all = [...persisted, ...created];
    const withDerivedStatus = all.map((task) =>
      isOverdue(task.status, new Date(task.dueAt), now)
        ? { ...task, status: 'OVERDUE' as const }
        : task,
    );
    withDerivedStatus.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    return { kind: 'loaded', tasks: withDerivedStatus };
  }
}
