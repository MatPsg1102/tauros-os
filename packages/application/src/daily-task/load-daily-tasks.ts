// Use case: carregar/materializar o quadro de tarefas do dia (7.2).
// Materialização LOCAL e idempotente a partir dos templates vigentes —
// releitura no mesmo dia NUNCA sobrescreve o desfecho já registrado.
// OVERDUE é derivado de due_at pelo domínio, jamais digitado.

import { isOverdue } from '@tauros/domain';
import {
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type DailyTaskRecord,
  type DailyTaskRepositoryPort,
  type EffectiveAuthorization,
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

function materialize(
  template: TaskTemplateSnapshot,
  input: LoadDailyTasksInput,
  storeId: string,
): DailyTaskRecord {
  const dueAt = new Date(
    input.operationalDayStart.getTime() + template.dueOffsetMinutes * 60 * 1000,
  );
  return {
    id: dailyTaskIdFor(storeId, input.workDate, template.templateId),
    storeId,
    templateId: template.templateId,
    workDate: input.workDate,
    dueAt: dueAt.toISOString(),
    status: 'PENDING',
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
  ) {}

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

    // materializa apenas o que ainda não existe (idempotente)
    const created = templates
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
