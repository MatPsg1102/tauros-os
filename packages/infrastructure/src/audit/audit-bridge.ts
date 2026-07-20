// Ponte offline → auditoria (§4). SEM ciclo: audit importa tipos do offline;
// o offline NUNCA importa audit. A ponte é um TechnicalEventPort que promove
// eventos conforme a política e alimenta o outbox durável.

import type { TechnicalEvent, TechnicalEventPort } from '../offline/events.js';
import type { QueueItem } from '../offline/queue-item.js';
import type { AuditBufferPort } from './audit-ports.js';
import type { AuditEventFactory } from './audit-factory.js';
import type { AuditPolicy } from './audit-policy.js';

/** Resolve o item da fila para enriquecer o evento (injetável; sem ciclo). */
export type QueueItemLookup = (queueItemId: string) => Promise<QueueItem | undefined>;

export class AuditingEventBridge implements TechnicalEventPort {
  /** Promoções pendentes (assíncronas) — aguardáveis em flush(). */
  private inflight: Promise<void> = Promise.resolve();

  constructor(
    private readonly inner: TechnicalEventPort,
    private readonly policy: AuditPolicy,
    private readonly factory: AuditEventFactory,
    private readonly buffer: AuditBufferPort,
    private readonly lookup: QueueItemLookup,
  ) {}

  emit(event: TechnicalEvent): void {
    this.inner.emit(event);
    if (!this.policy.shouldPromote(event)) return;
    const task = (async () => {
      const item = event.queueItemId ? await this.lookup(event.queueItemId) : undefined;
      const audit = this.factory.fromTechnicalEvent(event, item);
      if (audit) await this.buffer.append(audit);
    })().catch(() => {
      // Falha de promoção nunca derruba o fluxo técnico; o evento técnico
      // original já foi emitido e o item permanece consultável na fila.
    });
    this.inflight = this.inflight.then(() => task);
  }

  /** Aguarda promoções pendentes (testes/shutdown ordenado). */
  flush(): Promise<void> {
    return this.inflight;
  }
}
