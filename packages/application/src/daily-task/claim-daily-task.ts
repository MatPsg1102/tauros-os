// Use case: ASSUMIR uma ocorrência sem responsável (Operação Compartilhada).
// Auto-serviço do operador identificado just-in-time: o gate é ELEGIBILIDADE
// (posição vigente + presença planejada oficial), nunca capability gerencial.
// Grava só na OCORRÊNCIA — template intacto; próxima ocorrência nasce sem
// responsável. Reutiliza a MESMA fila da atribuição situacional (a chave do
// adapter converge por tarefa+posição). Auditoria durável via outbox da fila.

import { currentAssignmentFor, decideClaimDailyTask } from '@tauros/domain';
import {
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type DailyTaskAssignEnqueuePort,
  type DailyTaskRecord,
  type DailyTaskRepositoryPort,
  type EffectiveAuthorization,
  type IdGeneratorPort,
  type ShiftSchedulePort,
  type WorkforceRepositoryPort,
} from '@tauros/contracts';

export interface ClaimDailyTaskInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  readonly dailyTaskId: string;
  /** Data operacional civil YYYY-MM-DD (fuso da loja). */
  readonly workDate: string;
  readonly claimedOffline: boolean;
}

export type ClaimDailyTaskFailureCode =
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'TASK_NOT_FOUND'
  | 'ALREADY_ASSIGNED'
  | 'ACTOR_WITHOUT_POSITION'
  | 'ACTOR_NOT_SCHEDULED'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type ClaimDailyTaskResult =
  | { readonly kind: 'claimed'; readonly task: DailyTaskRecord }
  | { readonly kind: 'already-claimed'; readonly task: DailyTaskRecord }
  | {
      readonly kind: 'failed';
      readonly code: ClaimDailyTaskFailureCode;
      readonly detail: string;
    };

export class ClaimDailyTaskUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly repository: DailyTaskRepositoryPort,
    private readonly workforce: WorkforceRepositoryPort,
    private readonly schedule: ShiftSchedulePort,
    private readonly queue: DailyTaskAssignEnqueuePort,
  ) {}

  async execute(input: ClaimDailyTaskInput): Promise<ClaimDailyTaskResult> {
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
    // posição VIGENTE do ator hoje (regra única de vigência de vínculo)
    const assignments = await this.workforce.assignments(auth.storeId);
    const current = currentAssignmentFor(assignments, auth.operatorEmployeeId, input.workDate);
    const actorPositionId = current?.operationalPositionId ?? null;
    // presença planejada oficial da POSIÇÃO do ator (fonte única da escala)
    const actorIsScheduled =
      actorPositionId !== null
        ? await this.schedule.isPositionScheduled(auth.storeId, actorPositionId, input.workDate)
        : false;

    const decision = decideClaimDailyTask(
      {
        dailyTaskId: input.dailyTaskId,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        actorPositionId,
        actorIsScheduled,
      },
      task === null
        ? null
        : {
            id: task.id,
            storeId: task.storeId,
            status: task.status,
            effectivePositionId: task.assignedPositionId ?? task.template.targetPositionId,
          },
    );

    if (decision.kind === 'already-claimed') {
      return { kind: 'already-claimed', task: task as DailyTaskRecord };
    }
    if (decision.kind === 'rejected') {
      switch (decision.code) {
        case 'TASK_NOT_FOUND':
          return { kind: 'failed', code: 'TASK_NOT_FOUND', detail: decision.detail };
        case 'ALREADY_ASSIGNED':
        case 'TASK_NOT_CLAIMABLE':
          return { kind: 'failed', code: 'ALREADY_ASSIGNED', detail: decision.detail };
        case 'ACTOR_WITHOUT_POSITION':
          return { kind: 'failed', code: 'ACTOR_WITHOUT_POSITION', detail: decision.detail };
        case 'ACTOR_NOT_SCHEDULED':
          return { kind: 'failed', code: 'ACTOR_NOT_SCHEDULED', detail: decision.detail };
        default:
          return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
      }
    }

    const updated: DailyTaskRecord = {
      ...(task as DailyTaskRecord),
      assignedPositionId: decision.assignedPositionId,
      syncStatus: 'queued',
    };

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local
    try {
      await this.queue.enqueueAssignDailyTask({
        queueItemId: this.ids.uuid(),
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

    return { kind: 'claimed', task: updated };
  }
}
