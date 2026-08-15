// Use case: atribuição SITUACIONAL de uma ocorrência do dia a uma posição
// (Área do Encarregado). Mesma espinha dos slices: autorização efetiva
// (ADR-018, capability config.write), validação da posição via port, decisão
// de domínio, fila (intenção durável, auditada operacionalmente pela ponte) e
// persistência local. Atribuir a ocorrência de HOJE NÃO altera a definição.
//
// Ordem de efeitos e recuperação:
//   1. enqueue (intenção durável — carrega a ocorrência atualizada);
//   2. save local (estado consultável).
// Falha entre 1 e 2 é recuperável: o boot reconstrói pelo payload da fila.

import { decideAssignDailyTask } from '@tauros/domain';
import {
  CAPABILITY_CONFIG_WRITE,
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type DailyTaskAssignEnqueuePort,
  type DailyTaskAuditPort,
  type DailyTaskRecord,
  type DailyTaskRepositoryPort,
  type EffectiveAuthorization,
  type IdGeneratorPort,
  type TeamDirectoryPort,
} from '@tauros/contracts';

export interface AssignDailyTaskInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  readonly dailyTaskId: string;
  readonly positionId: string;
  readonly assignedOffline: boolean;
}

export type AssignDailyTaskFailureCode =
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'UNKNOWN_POSITION'
  | 'TASK_NOT_FOUND'
  | 'POSITION_REQUIRED'
  | 'NOT_ASSIGNABLE'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type AssignDailyTaskResult =
  | { readonly kind: 'assigned'; readonly dailyTask: DailyTaskRecord }
  | { readonly kind: 'already-assigned'; readonly dailyTask: DailyTaskRecord }
  | {
      readonly kind: 'failed';
      readonly code: AssignDailyTaskFailureCode;
      readonly detail: string;
    };

export class AssignDailyTaskUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly team: TeamDirectoryPort,
    private readonly repository: DailyTaskRepositoryPort,
    private readonly queue: DailyTaskAssignEnqueuePort,
    private readonly audit: DailyTaskAuditPort,
  ) {}

  async execute(input: AssignDailyTaskInput): Promise<AssignDailyTaskResult> {
    const now = this.clock.now();
    const auth = input.authorization;
    const source = input.assignedOffline ? 'client-offline' : 'client-online';

    // ADR-018: a APLICAÇÃO revalida a capacidade (ocultação visual não é controle)
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
    if (!auth.permissions.includes(CAPABILITY_CONFIG_WRITE)) {
      await this.audit.record({
        eventType: 'access.denied',
        occurredAt: now,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        actorProfileId: auth.operatorProfileId,
        dailyTaskId: input.dailyTaskId,
        deviceId: input.deviceId,
        correlationId: auth.sessionId,
        source,
        result: 'rejected',
        errorCode: CAPABILITY_CONFIG_WRITE,
      });
      return { kind: 'failed', code: 'PERMISSION_DENIED', detail: 'capability ausente' };
    }

    // a posição precisa existir na loja (ID OFICIAL)
    const positions = await this.team.positions(auth.storeId);
    if (!positions.some((position) => position.id === input.positionId)) {
      return {
        kind: 'failed',
        code: 'UNKNOWN_POSITION',
        detail: 'posição responsável não encontrada nesta loja',
      };
    }

    const task = await this.repository.byId(input.dailyTaskId);
    if (task === null || task.storeId !== auth.storeId) {
      return { kind: 'failed', code: 'TASK_NOT_FOUND', detail: 'ocorrência não encontrada' };
    }

    const decision = decideAssignDailyTask(
      { dailyTaskId: input.dailyTaskId, positionId: input.positionId },
      {
        currentAssignedPositionId: task.assignedPositionId,
        isResolved: task.status === 'DONE' || task.status === 'SKIPPED',
      },
    );
    if (decision.kind === 'rejected') {
      return { kind: 'failed', code: decision.code, detail: decision.detail };
    }
    if (decision.kind === 'already-assigned') {
      return { kind: 'already-assigned', dailyTask: task };
    }

    const updated: DailyTaskRecord = {
      ...task,
      assignedPositionId: decision.positionId,
      syncStatus: 'queued',
    };

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local
    try {
      await this.queue.enqueueAssignDailyTask({ queueItemId: this.ids.uuid(), dailyTask: updated });
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
      // intenção durável já registrada — o boot reconcilia pela fila
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao persistir localmente',
      };
    }

    return { kind: 'assigned', dailyTask: updated };
  }
}
