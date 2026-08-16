// Use case: registrar o desfecho de uma tarefa do dia (7.2) — concluir ou
// adiar. A execução é APPEND-ONLY (task_executions): correção entra como nova
// execução, nunca edição. A escrita de execução espelha a RLS congelada
// (insert = tenant; nenhuma capability específica — review.handle governa
// apenas a RESOLUÇÃO de revisão, fora deste slice).
//
// Ordem de efeitos e recuperação:
//   1. enqueue (intenção durável da execução);
//   2. save da execução (append-only);
//   3. atualização do estado da tarefa do dia.
// Auditoria durável vem do outbox pela ponte da fila (offline.operation.*),
// sem inventar tipo de evento fora do catálogo congelado.

import { decideTaskOutcome, type DailyTaskView, type TaskOutcomeKind } from '@tauros/domain';
import {
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type DailyTaskRecord,
  type DailyTaskRepositoryPort,
  type EffectiveAuthorization,
  type EvidenceRepositoryPort,
  type IdGeneratorPort,
  type TaskExecutionEnqueuePort,
  type TaskExecutionRecord,
} from '@tauros/contracts';

/** Versão do contrato de payload sincronizado desta entidade. */
const EXECUTION_SCHEMA_VERSION = 1;

export interface RecordTaskOutcomeInput {
  readonly authorization: EffectiveAuthorization;
  readonly dailyTaskId: string;
  /** Turno aberto que dá autoria à execução (ADR-014). */
  readonly operatorSessionId: string;
  readonly deviceId: string;
  readonly kind: TaskOutcomeKind;
  readonly numericValue: number | null;
  readonly notes: string | null;
  readonly hasEvidence: boolean;
  /**
   * Evidências REAIS capturadas nesta execução (Operação Compartilhada).
   * Opcional por compatibilidade: o quadro individual segue com o boolean.
   */
  readonly evidenceIds?: readonly string[];
  readonly performedOffline: boolean;
}

export type RecordTaskOutcomeFailureCode =
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'STORE_MISMATCH'
  | 'TASK_NOT_FOUND'
  | 'TASK_ALREADY_RESOLVED'
  | 'EVIDENCE_REQUIRED'
  | 'VALUE_REQUIRED'
  | 'SKIP_REASON_REQUIRED'
  | 'RETURNED_TASK_CANNOT_SKIP'
  | 'SESSION_REQUIRED'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type RecordTaskOutcomeResult =
  | {
      readonly kind: 'recorded';
      readonly execution: TaskExecutionRecord;
      readonly task: DailyTaskRecord;
    }
  | { readonly kind: 'already-recorded'; readonly execution: TaskExecutionRecord }
  | {
      readonly kind: 'failed';
      readonly code: RecordTaskOutcomeFailureCode;
      readonly detail: string;
    };

/**
 * Identidade determinística da operação (nunca timestamp/aleatório). O
 * REENVIO pós-devolução ancora a chave na execução substituída: cada rodada
 * de correção é UMA operação nova que converge no double-submit — sem jamais
 * colidir com a submissão original (que é preservada).
 */
export function taskOutcomeIdempotencyKeyFor(
  kind: TaskOutcomeKind,
  storeId: string,
  dailyTaskId: string,
  operatorEmployeeId: string,
  supersedesExecutionId: string | null = null,
): string {
  const verb = kind === 'complete' ? 'task-complete' : 'task-skip';
  const base = `${verb}:${storeId}:${dailyTaskId}:${operatorEmployeeId}`;
  return supersedesExecutionId === null ? base : `${base}:r:${supersedesExecutionId}`;
}

export class RecordTaskOutcomeUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly repository: DailyTaskRepositoryPort,
    private readonly queue: TaskExecutionEnqueuePort,
    /** Metadados de evidência — opcional (o quadro individual não anexa). */
    private readonly evidence?: EvidenceRepositoryPort,
  ) {}

  async execute(input: RecordTaskOutcomeInput): Promise<RecordTaskOutcomeResult> {
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

    // REENVIO pós-devolução: nova operação ancorada na execução DEVOLVIDA
    // (independe de a tarefa já ter sido retomada — IN_PROGRESS). Primeira
    // submissão usa a chave clássica (compatível com a 7.2).
    let supersedesExecutionId: string | null = null;
    if (task !== null && task.lastExecutionId !== null && input.kind === 'complete') {
      const lastExecution = await this.repository.executionById(task.lastExecutionId);
      if (lastExecution?.review?.outcome === 'RETURNED') {
        supersedesExecutionId = task.lastExecutionId;
      }
    }
    const idempotencyKey = taskOutcomeIdempotencyKeyFor(
      input.kind,
      auth.storeId,
      input.dailyTaskId,
      auth.operatorEmployeeId,
      supersedesExecutionId,
    );
    // replay ANTES das demais checagens: não duplicar não depende do resto.
    // AUTO-REPARO: se a execução persistiu mas a atualização da tarefa se
    // perdeu (falha entre saveExecution e save), o replay reaplica o estado —
    // APENAS quando a tarefa ainda aponta o elo esperado (nunca regride um
    // desfecho posterior).
    const existing = await this.repository.executionByIdempotencyKey(auth.storeId, idempotencyKey);
    if (existing !== null) {
      const linksToPrevious =
        task !== null &&
        (task.lastExecutionId === null ||
          task.lastExecutionId === (existing.supersedesExecutionId ?? null));
      if (linksToPrevious && task.status !== existing.resultingStatus) {
        await this.repository.save({
          ...task,
          status: existing.resultingStatus,
          lastExecutionId: existing.id,
          syncStatus: existing.syncStatus,
        });
      }
      return { kind: 'already-recorded', execution: existing };
    }

    if (task === null) {
      return {
        kind: 'failed',
        code: 'TASK_NOT_FOUND',
        detail: 'tarefa não encontrada no dia deste aparelho',
      };
    }
    if (task.storeId !== auth.storeId) {
      return { kind: 'failed', code: 'STORE_MISMATCH', detail: 'tarefa pertence a outra loja' };
    }

    const evidenceIds = input.evidenceIds ?? [];
    const view: DailyTaskView = {
      id: task.id,
      storeId: task.storeId,
      workDate: task.workDate,
      status: task.status,
      requiresPhoto: task.template.requiresPhoto,
      requiresReview: task.template.requiresReview ?? false,
      startedByEmployeeId: task.startedByEmployeeId ?? null,
      expectedMin: task.expectedMinSnapshot,
      expectedMax: task.expectedMaxSnapshot,
    };

    const decision = decideTaskOutcome(
      {
        executionId: this.ids.uuid(),
        storeId: auth.storeId,
        dailyTaskId: input.dailyTaskId,
        operatorSessionId: input.operatorSessionId,
        performedByProfileId: auth.operatorProfileId,
        performedByEmployeeId: auth.operatorEmployeeId,
        deviceId: input.deviceId,
        eventTime: now,
        workDate: task.workDate,
        kind: input.kind,
        numericValue: input.numericValue,
        notes: input.notes,
        hasEvidence: input.hasEvidence || evidenceIds.length > 0,
        startedAt: task.startedAt != null ? new Date(task.startedAt) : null,
        idempotencyKey,
      },
      view,
      null,
    );

    if (decision.kind === 'already-recorded') {
      return { kind: 'failed', code: 'PERSISTENCE_FAILED', detail: 'execução ausente no replay' };
    }
    if (decision.kind === 'rejected') {
      switch (decision.code) {
        case 'TASK_NOT_FOUND':
          return { kind: 'failed', code: 'TASK_NOT_FOUND', detail: decision.detail };
        case 'TASK_ALREADY_RESOLVED':
          return { kind: 'failed', code: 'TASK_ALREADY_RESOLVED', detail: decision.detail };
        case 'EVIDENCE_REQUIRED':
          return { kind: 'failed', code: 'EVIDENCE_REQUIRED', detail: decision.detail };
        case 'VALUE_REQUIRED':
          return { kind: 'failed', code: 'VALUE_REQUIRED', detail: decision.detail };
        case 'SKIP_REASON_REQUIRED':
          return { kind: 'failed', code: 'SKIP_REASON_REQUIRED', detail: decision.detail };
        case 'RETURNED_TASK_CANNOT_SKIP':
          return { kind: 'failed', code: 'RETURNED_TASK_CANNOT_SKIP', detail: decision.detail };
        case 'SESSION_REQUIRED':
          return { kind: 'failed', code: 'SESSION_REQUIRED', detail: decision.detail };
        case 'STORE_MISMATCH':
          return { kind: 'failed', code: 'STORE_MISMATCH', detail: decision.detail };
        default:
          return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
      }
    }

    const recorded = decision.execution;
    const execution: TaskExecutionRecord = {
      id: recorded.id,
      storeId: recorded.storeId,
      dailyTaskId: recorded.dailyTaskId,
      operatorSessionId: recorded.operatorSessionId,
      executionSource: 'HUMAN',
      performedByProfileId: recorded.performedByProfileId,
      performedByEmployeeId: recorded.performedByEmployeeId,
      deviceId: recorded.deviceId,
      result: recorded.result,
      numericValue: recorded.numericValue,
      notes: recorded.notes,
      eventTime: recorded.eventTime.toISOString(),
      clientTimestamp: now.toISOString(),
      hasEvidence: recorded.hasEvidence,
      idempotencyKey: recorded.idempotencyKey,
      schemaVersion: EXECUTION_SCHEMA_VERSION,
      syncStatus: 'queued',
      resultingStatus: recorded.resultingStatus,
      startedAt: recorded.startedAt?.toISOString() ?? null,
      evidenceIds,
      supersedesExecutionId,
      review: null,
    };

    try {
      await this.queue.enqueueTaskExecution({ queueItemId: this.ids.uuid(), execution });
    } catch (error) {
      return {
        kind: 'failed',
        code: 'ENQUEUE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao enfileirar',
      };
    }

    try {
      await this.repository.saveExecution(execution);
    } catch (error) {
      // intenção durável já registrada — o boot reconcilia pela fila
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao registrar localmente',
      };
    }

    // vincula as evidências capturadas a ESTA execução (metadado local)
    if (this.evidence !== undefined && evidenceIds.length > 0) {
      const records = await this.evidence.byIds(evidenceIds);
      for (const record of records) {
        if (record.executionId === null) {
          await this.evidence.save({ ...record, executionId: execution.id });
        }
      }
    }

    const updated: DailyTaskRecord = {
      ...task,
      status: recorded.resultingStatus,
      lastExecutionId: execution.id,
      syncStatus: execution.syncStatus,
    };
    try {
      await this.repository.save(updated);
    } catch (error) {
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao atualizar a tarefa',
      };
    }

    return { kind: 'recorded', execution, task: updated };
  }
}
