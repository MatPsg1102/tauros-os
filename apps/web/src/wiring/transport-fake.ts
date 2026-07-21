// Transporte fake determinístico (7.1 §32, ampliado na 7.2) — substitui a
// Edge Function até o backend real, implementando o MESMO SyncTransportPort.
// Sem timers aleatórios. Cenários CONTRATUAIS explícitos: sucesso,
// indisponibilidade, replay, conflito, rejeição de regra, turno já fechado e
// tarefa já concluída em outro aparelho. Trocável pelo adapter real sem tocar
// UI, controllers ou use cases — nenhuma condicional de fake vaza para fora.

import type {
  CloseSessionQueuePayload,
  OpenSessionQueuePayload,
  TaskExecutionQueuePayload,
} from '@tauros/contracts';
import { ENTITY_TASK_EXECUTION } from '@tauros/contracts';
import type { QueueItem, SubmitOutcome, SyncTransportPort } from '@tauros/infrastructure';

interface ServerSession {
  readonly storeId: string;
  readonly actorEmployeeId: string;
  readonly idempotencyKey: string;
  readonly sessionId: string;
  readonly closed: boolean;
}

export class FakeSessionSyncTransport implements SyncTransportPort {
  /** "Servidor" em memória: sessões ativas por loja+funcionário. */
  private readonly serverSessions = new Map<string, ServerSession>();
  private readonly seenIdempotencyKeys = new Set<string>();
  /** Execuções aceitas por (loja, tarefa) — base do conflito entre aparelhos. */
  private readonly serverExecutions = new Map<string, string>();
  /** Modo de indisponibilidade (cenário offline/backend fora). */
  available = true;
  submissions = 0;

  /** Pré-carrega um turno aberto "no dispositivo B" (cenário de conflito). */
  seedRemoteSession(session: Omit<ServerSession, 'closed'>): void {
    this.serverSessions.set(this.scopeKey(session.storeId, session.actorEmployeeId), {
      ...session,
      closed: false,
    });
    this.seenIdempotencyKeys.add(session.idempotencyKey);
  }

  /** Pré-carrega um turno JÁ FECHADO no servidor (cenário 7.2). */
  seedRemoteClosedSession(session: Omit<ServerSession, 'closed'>): void {
    this.serverSessions.set(this.scopeKey(session.storeId, session.actorEmployeeId), {
      ...session,
      closed: true,
    });
  }

  /** Pré-carrega uma tarefa concluída em OUTRO aparelho (cenário 7.2). */
  seedRemoteExecution(storeId: string, dailyTaskId: string, executionId: string): void {
    this.serverExecutions.set(this.taskKey(storeId, dailyTaskId), executionId);
  }

  submit(item: QueueItem): Promise<SubmitOutcome> {
    this.submissions += 1;
    if (!this.available) {
      return Promise.resolve({
        kind: 'transient',
        message: 'backend indisponível (fake)',
        authExpired: false,
      });
    }
    // replay idempotente: chave já aplicada ⇒ sucesso (dedupe = persisted)
    if (this.seenIdempotencyKeys.has(item.idempotencyKey)) {
      return Promise.resolve({ kind: 'persisted' });
    }
    if (item.entityType === ENTITY_TASK_EXECUTION) {
      return Promise.resolve(this.submitExecution(item));
    }
    if (item.operation === 'update') {
      return Promise.resolve(this.submitSessionClose(item));
    }
    return Promise.resolve(this.submitSessionOpen(item));
  }

  private submitSessionOpen(item: QueueItem): SubmitOutcome {
    const payload = item.payload as OpenSessionQueuePayload;
    const record = payload.record;
    const scope = this.scopeKey(record.storeId, record.actorEmployeeId);
    const existing = this.serverSessions.get(scope);
    if (existing !== undefined && existing.idempotencyKey !== record.idempotencyKey) {
      return {
        kind: 'conflict',
        classification: 'idempotency_divergence',
        remoteEvidence: { sessionId: existing.sessionId },
        message: 'turno já aberto em outro dispositivo',
      };
    }
    this.serverSessions.set(scope, {
      storeId: record.storeId,
      actorEmployeeId: record.actorEmployeeId,
      idempotencyKey: record.idempotencyKey,
      sessionId: record.id,
      closed: false,
    });
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitSessionClose(item: QueueItem): SubmitOutcome {
    const payload = item.payload as CloseSessionQueuePayload;
    const scope = this.scopeKey(payload.storeId, payload.actorEmployeeId);
    const existing = this.serverSessions.get(scope);
    if (existing === undefined) {
      // rejeição de regra: nunca reenviar (o servidor não conhece este turno)
      return { kind: 'rejected', message: 'turno inexistente no servidor' };
    }
    if (existing.closed) {
      // já fechado lá: desfecho de conflito, o local é preservado p/ revisão
      return {
        kind: 'conflict',
        classification: 'idempotency_divergence',
        remoteEvidence: { sessionId: existing.sessionId },
        message: 'turno já fechado em outro dispositivo',
      };
    }
    this.serverSessions.set(scope, { ...existing, closed: true });
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitExecution(item: QueueItem): SubmitOutcome {
    const payload = item.payload as TaskExecutionQueuePayload;
    const execution = payload.execution;
    const key = this.taskKey(execution.storeId, execution.dailyTaskId);
    const remote = this.serverExecutions.get(key);
    if (remote !== undefined && remote !== execution.id) {
      return {
        kind: 'conflict',
        classification: 'idempotency_divergence',
        remoteEvidence: { executionId: remote },
        message: 'tarefa já concluída em outro dispositivo',
      };
    }
    this.serverExecutions.set(key, execution.id);
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private scopeKey(storeId: string, employeeId: string): string {
    return `${storeId}::${employeeId}`;
  }

  private taskKey(storeId: string, dailyTaskId: string): string {
    return `${storeId}::${dailyTaskId}`;
  }
}
