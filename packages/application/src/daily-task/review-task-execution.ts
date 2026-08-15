// Use case: CONFERIR uma execução enviada (Operação Compartilhada) —
// aprovar ou devolver. Capability oficial task.review revalidada AQUI
// (ocultação visual não é controle); reviewer ≠ executor no domínio.
// Aprovar → DONE (único terminal); devolver → NEEDS_CORRECTION com motivo,
// preservando execução/evidência/histórico (reenvio = nova execução na
// cadeia supersedes). Auditoria direta admin.action (catálogo congelado).

import { decideReviewExecution, type TaskReviewOutcome } from '@tauros/domain';
import {
  CAPABILITY_TASK_REVIEW,
  ENTITY_TASK_EXECUTION,
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type DailyTaskRecord,
  type DailyTaskRepositoryPort,
  type EffectiveAuthorization,
  type IdGeneratorPort,
  type SharedOperationEnqueuePort,
  type TaskExecutionRecord,
  type TaskExecutionReview,
  type WorkforceAuditPort,
} from '@tauros/contracts';

export interface ReviewTaskExecutionInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  readonly dailyTaskId: string;
  readonly outcome: TaskReviewOutcome;
  /** Motivo curto — obrigatório na devolução. */
  readonly note: string | null;
  readonly reviewedOffline: boolean;
}

export type ReviewTaskExecutionFailureCode =
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'TASK_NOT_FOUND'
  | 'EXECUTION_NOT_FOUND'
  | 'TASK_NOT_IN_REVIEW'
  | 'REVIEWER_IS_EXECUTOR'
  | 'REASON_REQUIRED'
  | 'ALREADY_REVIEWED_DIFFERENTLY'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type ReviewTaskExecutionResult =
  | {
      readonly kind: 'reviewed';
      readonly execution: TaskExecutionRecord;
      readonly task: DailyTaskRecord;
    }
  | { readonly kind: 'already-reviewed'; readonly outcome: TaskReviewOutcome }
  | {
      readonly kind: 'failed';
      readonly code: ReviewTaskExecutionFailureCode;
      readonly detail: string;
    };

export class ReviewTaskExecutionUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly repository: DailyTaskRepositoryPort,
    private readonly queue: SharedOperationEnqueuePort,
    private readonly audit: WorkforceAuditPort,
  ) {}

  async execute(input: ReviewTaskExecutionInput): Promise<ReviewTaskExecutionResult> {
    const now = this.clock.now();
    const auth = input.authorization;
    const source = input.reviewedOffline ? 'client-offline' : 'client-online';

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
    // ADR-018: a APLICAÇÃO revalida a capability — UI hiding ≠ authorization
    if (!auth.permissions.includes(CAPABILITY_TASK_REVIEW)) {
      await this.audit.record({
        eventType: 'access.denied',
        occurredAt: now,
        storeId: auth.storeId,
        actorProfileId: auth.operatorProfileId,
        entityType: ENTITY_TASK_EXECUTION,
        entityId: null,
        deviceId: input.deviceId,
        correlationId: auth.sessionId,
        source,
        result: 'rejected',
        errorCode: CAPABILITY_TASK_REVIEW,
      });
      return { kind: 'failed', code: 'PERMISSION_DENIED', detail: 'capability ausente' };
    }

    const task = await this.repository.byId(input.dailyTaskId);
    if (task === null || task.storeId !== auth.storeId) {
      return { kind: 'failed', code: 'TASK_NOT_FOUND', detail: 'tarefa não encontrada' };
    }
    const execution =
      task.lastExecutionId !== null
        ? await this.repository.executionById(task.lastExecutionId)
        : null;

    const decision = decideReviewExecution(
      {
        executionId: execution?.id ?? '',
        storeId: auth.storeId,
        outcome: input.outcome,
        note: input.note,
        reviewerProfileId: auth.operatorProfileId,
        reviewerEmployeeId: auth.operatorEmployeeId,
        reviewedAt: now,
      },
      execution === null
        ? null
        : {
            id: execution.id,
            storeId: execution.storeId,
            dailyTaskId: execution.dailyTaskId,
            performedByEmployeeId: execution.performedByEmployeeId,
            existingReviewOutcome: execution.review?.outcome ?? null,
          },
      { id: task.id, status: task.status },
    );

    if (decision.kind === 'already-reviewed') {
      // AUTO-REPARO: conferência anexada mas atualização da tarefa perdida
      // (falha entre attachExecutionReview e save) — reaplica o desfecho.
      if (task.status === 'AWAITING_REVIEW') {
        await this.repository.save({
          ...task,
          status: decision.outcome === 'APPROVED' ? 'DONE' : 'NEEDS_CORRECTION',
        });
      }
      return { kind: 'already-reviewed', outcome: decision.outcome };
    }
    if (decision.kind === 'rejected') {
      switch (decision.code) {
        case 'EXECUTION_NOT_FOUND':
          return { kind: 'failed', code: 'EXECUTION_NOT_FOUND', detail: decision.detail };
        case 'TASK_NOT_IN_REVIEW':
          return { kind: 'failed', code: 'TASK_NOT_IN_REVIEW', detail: decision.detail };
        case 'REVIEWER_IS_EXECUTOR':
          return { kind: 'failed', code: 'REVIEWER_IS_EXECUTOR', detail: decision.detail };
        case 'REASON_REQUIRED':
          return { kind: 'failed', code: 'REASON_REQUIRED', detail: decision.detail };
        case 'ALREADY_REVIEWED_DIFFERENTLY':
          return {
            kind: 'failed',
            code: 'ALREADY_REVIEWED_DIFFERENTLY',
            detail: decision.detail,
          };
        default:
          return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
      }
    }

    const review: TaskExecutionReview = {
      outcome: decision.review.outcome,
      reviewedByProfileId: decision.review.reviewedByProfileId,
      reviewedByEmployeeId: decision.review.reviewedByEmployeeId,
      reviewedAt: decision.review.reviewedAt.toISOString(),
      note: decision.review.note,
    };
    const reviewedExecution: TaskExecutionRecord = {
      ...(execution as TaskExecutionRecord),
      review,
    };

    // 1) intenção durável PRIMEIRO; 2) estado local; 3) auditoria direta
    try {
      await this.queue.enqueueReviewExecution({
        queueItemId: this.ids.uuid(),
        // conferência da MESMA execução com o MESMO desfecho converge
        idempotencyKey: `task-review:${auth.storeId}:${reviewedExecution.id}:${review.outcome}`,
        execution: reviewedExecution,
      });
    } catch (error) {
      await this.audit.record({
        eventType: 'admin.action',
        occurredAt: now,
        storeId: auth.storeId,
        actorProfileId: auth.operatorProfileId,
        entityType: ENTITY_TASK_EXECUTION,
        entityId: reviewedExecution.id,
        deviceId: input.deviceId,
        correlationId: reviewedExecution.id,
        source,
        result: 'failure',
        errorCode: 'ENQUEUE_FAILED',
      });
      return {
        kind: 'failed',
        code: 'ENQUEUE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao enfileirar',
      };
    }

    const updatedTask: DailyTaskRecord = {
      ...task,
      status: decision.review.resultingTaskStatus,
      syncStatus: 'queued',
    };
    try {
      await this.repository.attachExecutionReview(reviewedExecution.id, review);
      await this.repository.save(updatedTask);
    } catch (error) {
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao persistir localmente',
      };
    }

    await this.audit.record({
      eventType: 'admin.action',
      occurredAt: now,
      storeId: auth.storeId,
      actorProfileId: auth.operatorProfileId,
      entityType: ENTITY_TASK_EXECUTION,
      entityId: reviewedExecution.id,
      deviceId: input.deviceId,
      correlationId: reviewedExecution.id,
      source,
      result: 'success',
    });

    return { kind: 'reviewed', execution: reviewedExecution, task: updatedTask };
  }
}
