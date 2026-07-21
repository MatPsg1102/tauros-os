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

/** Identidade determinística da operação (nunca timestamp/aleatório). */
export function taskOutcomeIdempotencyKeyFor(
  kind: TaskOutcomeKind,
  storeId: string,
  dailyTaskId: string,
  operatorEmployeeId: string,
): string {
  const verb = kind === 'complete' ? 'task-complete' : 'task-skip';
  return `${verb}:${storeId}:${dailyTaskId}:${operatorEmployeeId}`;
}

export class RecordTaskOutcomeUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly repository: DailyTaskRepositoryPort,
    private readonly queue: TaskExecutionEnqueuePort,
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

    // replay ANTES de qualquer outra checagem: a garantia de não duplicar não
    // pode depender do estado local da tarefa.
    const idempotencyKey = taskOutcomeIdempotencyKeyFor(
      input.kind,
      auth.storeId,
      input.dailyTaskId,
      auth.operatorEmployeeId,
    );
    const existing = await this.repository.executionByIdempotencyKey(auth.storeId, idempotencyKey);
    if (existing !== null) return { kind: 'already-recorded', execution: existing };

    const task = await this.repository.byId(input.dailyTaskId);
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

    const view: DailyTaskView = {
      id: task.id,
      storeId: task.storeId,
      workDate: task.workDate,
      status: task.status,
      requiresPhoto: task.template.requiresPhoto,
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
        hasEvidence: input.hasEvidence,
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
