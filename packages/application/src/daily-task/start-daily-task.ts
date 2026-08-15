// Use case: INICIAR a execução (Operação Compartilhada). Registra horário
// REAL de início e ATOR na ocorrência — autoria nunca vive só na UI. O ator
// é identificado just-in-time; a elegibilidade é a posição vigente dele ser
// o responsável efetivo. Idempotência determinística: duplo toque converge.
// Auditoria durável via outbox da fila (offline.operation.*).

import { currentAssignmentFor, decideStartDailyTask } from '@tauros/domain';
import {
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type DailyTaskRecord,
  type DailyTaskRepositoryPort,
  type EffectiveAuthorization,
  type IdGeneratorPort,
  type SharedOperationEnqueuePort,
  type WorkforceRepositoryPort,
} from '@tauros/contracts';

export interface StartDailyTaskInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  readonly dailyTaskId: string;
  /** Data operacional civil YYYY-MM-DD (fuso da loja). */
  readonly workDate: string;
  readonly startedOffline: boolean;
}

export type StartDailyTaskFailureCode =
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'TASK_NOT_FOUND'
  | 'TASK_UNASSIGNED'
  | 'NOT_ELIGIBLE'
  | 'ALREADY_STARTED_BY_OTHER'
  | 'TASK_NOT_STARTABLE'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type StartDailyTaskResult =
  | { readonly kind: 'started'; readonly task: DailyTaskRecord }
  | { readonly kind: 'already-started'; readonly task: DailyTaskRecord }
  | {
      readonly kind: 'failed';
      readonly code: StartDailyTaskFailureCode;
      readonly detail: string;
    };

/**
 * Identidade determinística do início (nunca timestamp/aleatório), ANCORADA
 * na rodada: a retomada pós-devolução parte da execução devolvida — chave
 * NOVA (o servidor recebe o novo início real); duplo toque na MESMA rodada
 * converge na mesma chave.
 */
export function taskStartIdempotencyKeyFor(
  storeId: string,
  dailyTaskId: string,
  actorEmployeeId: string,
  roundAnchorExecutionId: string | null = null,
): string {
  const base = `task-start:${storeId}:${dailyTaskId}:${actorEmployeeId}`;
  return roundAnchorExecutionId === null ? base : `${base}:r:${roundAnchorExecutionId}`;
}

export class StartDailyTaskUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly repository: DailyTaskRepositoryPort,
    private readonly workforce: WorkforceRepositoryPort,
    private readonly queue: SharedOperationEnqueuePort,
  ) {}

  async execute(input: StartDailyTaskInput): Promise<StartDailyTaskResult> {
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

    const task = await this.repository.byId(input.dailyTaskId);
    const assignments = await this.workforce.assignments(auth.storeId);
    const current = currentAssignmentFor(assignments, auth.operatorEmployeeId, input.workDate);

    const decision = decideStartDailyTask(
      {
        dailyTaskId: input.dailyTaskId,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        actorPositionId: current?.operationalPositionId ?? null,
        startedAt: now,
      },
      task === null
        ? null
        : {
            id: task.id,
            storeId: task.storeId,
            status: task.status,
            effectivePositionId: task.assignedPositionId ?? task.template.targetPositionId,
            startedByEmployeeId: task.startedByEmployeeId ?? null,
          },
    );

    if (decision.kind === 'already-started') {
      return { kind: 'already-started', task: task as DailyTaskRecord };
    }
    if (decision.kind === 'rejected') {
      switch (decision.code) {
        case 'TASK_NOT_FOUND':
          return { kind: 'failed', code: 'TASK_NOT_FOUND', detail: decision.detail };
        case 'TASK_UNASSIGNED':
          return { kind: 'failed', code: 'TASK_UNASSIGNED', detail: decision.detail };
        case 'NOT_ELIGIBLE':
          return { kind: 'failed', code: 'NOT_ELIGIBLE', detail: decision.detail };
        case 'ALREADY_STARTED_BY_OTHER':
          return { kind: 'failed', code: 'ALREADY_STARTED_BY_OTHER', detail: decision.detail };
        case 'TASK_NOT_STARTABLE':
          return { kind: 'failed', code: 'TASK_NOT_STARTABLE', detail: decision.detail };
        default:
          return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
      }
    }

    const updated: DailyTaskRecord = {
      ...(task as DailyTaskRecord),
      status: decision.patch.status,
      startedAt: decision.patch.startedAt.toISOString(),
      startedByEmployeeId: decision.patch.startedByEmployeeId,
      syncStatus: 'queued',
    };

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local
    try {
      await this.queue.enqueueStartDailyTask({
        queueItemId: this.ids.uuid(),
        idempotencyKey: taskStartIdempotencyKeyFor(
          auth.storeId,
          input.dailyTaskId,
          auth.operatorEmployeeId,
          // retomada pós-devolução ancora na execução devolvida
          (task as DailyTaskRecord).lastExecutionId,
        ),
        dailyTask: updated,
      });
    } catch (error) {
      return {
        kind: 'failed',
        code: 'ENQUEUE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao enfileirar',
      };
    }
    try {
      await this.repository.save(updated);
    } catch (error) {
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao persistir localmente',
      };
    }

    return { kind: 'started', task: updated };
  }
}
