// Outbox durável de auditoria sobre o LocalStorePort (§3/§4).
// Sobrevive a crash/fechamento; quarentena para eventos inválidos.

import { validateAuditEvent, type AuditEvent } from './audit-event.js';
import type { AuditBufferPort } from './audit-ports.js';
import type { LocalStorePort } from '../offline/local-store.js';

const OUTBOX = 'audit_outbox';
const QUARANTINE = 'audit_quarantine';

interface OutboxRow {
  readonly event: AuditEvent;
  readonly appendedAt: string;
}

export class LocalAuditBuffer implements AuditBufferPort {
  constructor(
    private readonly store: LocalStorePort,
    private readonly clock: () => Date,
  ) {}

  async append(event: AuditEvent): Promise<void> {
    const validation = validateAuditEvent(event);
    if (!validation.ok) {
      await this.quarantineRaw(
        event.eventId ?? `invalid:${this.clock().getTime()}`,
        event,
        validation.reason,
      );
      return;
    }
    await this.store.transaction([OUTBOX], 'write', (tx) =>
      tx.put(OUTBOX, event.eventId, {
        event,
        appendedAt: this.clock().toISOString(),
      } satisfies OutboxRow),
    );
  }

  async pending(): Promise<readonly AuditEvent[]> {
    return this.store.transaction([OUTBOX, QUARANTINE], 'write', async (tx) => {
      const valid: AuditEvent[] = [];
      for (const raw of await tx.getAll(OUTBOX)) {
        const row = raw as OutboxRow;
        const validation = validateAuditEvent(row.event);
        if (validation.ok) {
          valid.push(validation.event);
        } else {
          const quarantineId =
            (row.event as { eventId?: string } | undefined)?.eventId ?? `q:${valid.length}`;
          await tx.put(QUARANTINE, quarantineId, {
            raw,
            reason: validation.reason,
            quarantinedAt: this.clock().toISOString(),
          });
          await tx.delete(OUTBOX, quarantineId);
        }
      }
      return valid.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    });
  }

  async markDispatched(eventIds: readonly string[]): Promise<void> {
    await this.store.transaction([OUTBOX], 'write', async (tx) => {
      for (const id of eventIds) await tx.delete(OUTBOX, id);
    });
  }

  async quarantine(eventId: string, reason: string): Promise<void> {
    await this.store.transaction([OUTBOX, QUARANTINE], 'write', async (tx) => {
      const raw = await tx.get(OUTBOX, eventId);
      if (raw !== undefined) {
        await tx.put(QUARANTINE, eventId, {
          raw,
          reason,
          quarantinedAt: this.clock().toISOString(),
        });
        await tx.delete(OUTBOX, eventId);
      }
    });
  }

  async quarantined(): Promise<readonly Record<string, unknown>[]> {
    return this.store.transaction(
      [QUARANTINE],
      'read',
      async (tx) => (await tx.getAll(QUARANTINE)) as Record<string, unknown>[],
    );
  }

  private async quarantineRaw(id: string, raw: unknown, reason: string): Promise<void> {
    await this.store.transaction([QUARANTINE], 'write', (tx) =>
      tx.put(QUARANTINE, id, { raw, reason, quarantinedAt: this.clock().toISOString() }),
    );
  }
}
