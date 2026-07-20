// Implementação de REFERÊNCIA em memória (repo + query + export + cadeia)
// para testes unitários. A autoridade real é o banco (migration + trigger);
// esta implementação espelha o mesmo comportamento observável.

import type { AuditEvent } from './audit-event.js';
import { CHAIN_GENESIS, hashEvent, type ChainedAuditEvent } from './audit-integrity.js';
import type {
  AuditExportPort,
  AuditPage,
  AuditQueryFilter,
  AuditQueryPort,
  AuditRepositoryPort,
} from './audit-ports.js';

export class MemoryAuditRepository implements AuditRepositoryPort, AuditQueryPort, AuditExportPort {
  private readonly rows: ChainedAuditEvent[] = [];
  private readonly heads = new Map<string, string>(); // partição (storeId) → last hash
  private seq = 0;

  constructor(private readonly clock: () => Date) {}

  /** Append-only, idempotente por eventId; recordedAt AUTORITATIVO aqui. */
  append(event: AuditEvent): Promise<{ recordedAt: string; duplicate: boolean }> {
    const existing = this.rows.find((r) => r.event.eventId === event.eventId);
    if (existing) {
      return Promise.resolve({ recordedAt: existing.event.recordedAt!, duplicate: true });
    }
    const partition = event.storeId ?? '__global__';
    const previousHash = this.heads.get(partition) ?? CHAIN_GENESIS;
    this.seq += 1;
    const recorded: AuditEvent = {
      ...event,
      recordedAt: new Date(this.clock().getTime() + this.seq).toISOString(),
    };
    const hash = hashEvent(previousHash, recorded);
    this.rows.push({ event: recorded, hash, previousHash });
    this.heads.set(partition, hash);
    return Promise.resolve({ recordedAt: recorded.recordedAt!, duplicate: false });
  }

  /** Ordenação AUTORITATIVA: recordedAt + eventId (determinística) — §10/§12. */
  query(filter: AuditQueryFilter, limit: number, cursor?: string): Promise<AuditPage> {
    const filtered = this.rows
      .map((r) => r.event)
      .filter((e) => this.matches(e, filter))
      .sort(
        (a, b) => a.recordedAt!.localeCompare(b.recordedAt!) || a.eventId.localeCompare(b.eventId),
      );

    const start = cursor ? filtered.findIndex((e) => `${e.recordedAt}|${e.eventId}` > cursor) : 0;
    const startIndex = start === -1 ? filtered.length : start;
    const page = filtered.slice(startIndex, startIndex + limit);
    const last = page[page.length - 1];
    return Promise.resolve({
      events: page,
      nextCursor:
        last && startIndex + limit < filtered.length ? `${last.recordedAt}|${last.eventId}` : null,
    });
  }

  /** Exportação estruturada (NDJSON canônico, uma linha por evento). */
  async exportNdjson(filter: AuditQueryFilter): Promise<string> {
    const all = await this.query(filter, Number.MAX_SAFE_INTEGER);
    return all.events.map((e) => JSON.stringify(e)).join('\n');
  }

  /** Cadeia da partição para verificação de integridade. */
  chainOf(storeId: string | null): readonly ChainedAuditEvent[] {
    const partition = storeId ?? '__global__';
    return this.rows.filter((r) => (r.event.storeId ?? '__global__') === partition);
  }

  /** Simulação de adulteração (SOMENTE testes de detecção). */
  tamper(eventId: string, mutate: (e: AuditEvent) => AuditEvent): void {
    const idx = this.rows.findIndex((r) => r.event.eventId === eventId);
    if (idx >= 0) {
      const row = this.rows[idx]!;
      this.rows[idx] = { ...row, event: mutate(row.event) };
    }
  }

  private matches(e: AuditEvent, f: AuditQueryFilter): boolean {
    return (
      (f.storeId === undefined || e.storeId === f.storeId) &&
      (f.actorId === undefined || e.actorId === f.actorId) &&
      (f.entityType === undefined || e.entityType === f.entityType) &&
      (f.entityId === undefined || e.entityId === f.entityId) &&
      (f.eventType === undefined || e.eventType === f.eventType) &&
      (f.result === undefined || e.result === f.result) &&
      (f.correlationId === undefined || e.correlationId === f.correlationId) &&
      (f.source === undefined || e.source === f.source) &&
      (f.sessionId === undefined || e.sessionId === f.sessionId) &&
      (f.deviceId === undefined || e.deviceId === f.deviceId) &&
      (f.from === undefined || (e.recordedAt ?? e.occurredAt) >= f.from) &&
      (f.to === undefined || (e.recordedAt ?? e.occurredAt) <= f.to)
    );
  }
}
