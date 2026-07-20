// AuditDispatcher (§3/§9) — drena o outbox para o transporte com retry e
// idempotência: 'duplicate' do servidor = sucesso (dedupe por eventId).

import type { AuditEvent } from './audit-event.js';
import type { AuditBufferPort, AuditRetryPolicyPort, AuditTransportPort } from './audit-ports.js';

export interface DispatchReport {
  readonly dispatched: readonly string[];
  readonly deduplicated: readonly string[];
  readonly quarantined: readonly string[];
  readonly retriedLater: readonly string[];
}

export class AuditDispatcher {
  private readonly attempts = new Map<string, number>();

  constructor(
    private readonly buffer: AuditBufferPort,
    private readonly transport: AuditTransportPort,
    private readonly retry: AuditRetryPolicyPort,
  ) {}

  async dispatch(signal?: AbortSignal): Promise<DispatchReport> {
    const dispatched: string[] = [];
    const deduplicated: string[] = [];
    const quarantined: string[] = [];
    const retriedLater: string[] = [];

    for (const event of await this.buffer.pending()) {
      if (signal?.aborted) break;
      const outcome = await this.submitOnce(event);
      switch (outcome) {
        case 'accepted':
          dispatched.push(event.eventId);
          break;
        case 'duplicate':
          deduplicated.push(event.eventId);
          break;
        case 'rejected':
          quarantined.push(event.eventId);
          break;
        case 'retry-later':
          retriedLater.push(event.eventId);
          break;
      }
    }

    await this.buffer.markDispatched([...dispatched, ...deduplicated]);
    return { dispatched, deduplicated, quarantined, retriedLater };
  }

  private async submitOnce(
    event: AuditEvent,
  ): Promise<'accepted' | 'duplicate' | 'rejected' | 'retry-later'> {
    const attempt = (this.attempts.get(event.eventId) ?? 0) + 1;
    this.attempts.set(event.eventId, attempt);

    const outcome = await this.transport.submit(event);
    switch (outcome.kind) {
      case 'accepted':
        this.attempts.delete(event.eventId);
        return 'accepted';
      case 'duplicate':
        this.attempts.delete(event.eventId);
        return 'duplicate';
      case 'rejected':
        await this.buffer.quarantine(event.eventId, outcome.reason);
        return 'rejected';
      case 'transient': {
        const decision = await this.retry.decide(attempt, event.storeId);
        if (!decision.retry) {
          await this.buffer.quarantine(
            event.eventId,
            `Tentativas esgotadas (${attempt}): ${outcome.message}`,
          );
          return 'rejected';
        }
        return 'retry-later';
      }
    }
  }
}
