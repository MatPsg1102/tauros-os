// Transporte fake determinístico (7.1 §32) — substitui a Edge Function até o
// backend real, implementando o MESMO SyncTransportPort. Sem timers
// aleatórios. Suporta: sucesso, indisponibilidade, conflito, replay
// idempotente. Trocável pelo adapter real sem tocar UI/aplicação.

import type { OpenSessionQueuePayload } from '@tauros/contracts';
import type { QueueItem, SubmitOutcome, SyncTransportPort } from '@tauros/infrastructure';

interface ServerSession {
  readonly storeId: string;
  readonly actorEmployeeId: string;
  readonly idempotencyKey: string;
  readonly sessionId: string;
}

export class FakeSessionSyncTransport implements SyncTransportPort {
  /** "Servidor" em memória: sessões ativas por loja+funcionário. */
  private readonly serverSessions = new Map<string, ServerSession>();
  private readonly seenIdempotencyKeys = new Set<string>();
  /** Modo de indisponibilidade (cenário offline/backend fora). */
  available = true;
  submissions = 0;

  /** Pré-carrega um turno aberto "no dispositivo B" (cenário de conflito). */
  seedRemoteSession(session: ServerSession): void {
    this.serverSessions.set(this.scopeKey(session.storeId, session.actorEmployeeId), session);
    this.seenIdempotencyKeys.add(session.idempotencyKey);
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
    const payload = item.payload as OpenSessionQueuePayload;
    const record = payload.record;
    const scope = this.scopeKey(record.storeId, record.actorEmployeeId);
    const existing = this.serverSessions.get(scope);
    if (existing !== undefined && existing.idempotencyKey !== record.idempotencyKey) {
      return Promise.resolve({
        kind: 'conflict',
        classification: 'idempotency_divergence',
        remoteEvidence: { sessionId: existing.sessionId },
        message: 'turno já aberto em outro dispositivo',
      });
    }
    this.serverSessions.set(scope, {
      storeId: record.storeId,
      actorEmployeeId: record.actorEmployeeId,
      idempotencyKey: record.idempotencyKey,
      sessionId: record.id,
    });
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return Promise.resolve({ kind: 'persisted' });
  }

  private scopeKey(storeId: string, employeeId: string): string {
    return `${storeId}::${employeeId}`;
  }
}
