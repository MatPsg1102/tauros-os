// AuditEventFactory (6.2.8 §3/§4/§9) — constrói eventos canônicos a partir dos
// eventos técnicos da fila offline (ponte SEM dependência circular: audit →
// offline, nunca o inverso) e de entradas diretas.
//
// Idempotência (§9): eventId é DETERMINÍSTICO — derivado de
// (correlationId, eventType, attempt). Retry/timeout/resposta perdida/
// reprocessamento produzem o MESMO eventId ⇒ dedupe lógico no servidor.
// Fases múltiplas legítimas compartilham correlationId com eventId distinto.

import type { TechnicalEvent } from '../offline/events.js';
import type { QueueItem } from '../offline/queue-item.js';
import { AUDIT_SCHEMA_VERSION, type AuditEvent } from './audit-event.js';
import type { AuditPolicy } from './audit-policy.js';
import type { AuditSanitizer } from './audit-sanitizer.js';

/** Chaves de metadados técnicos permitidas em eventos promovidos (allowlist). */
const PROMOTED_METADATA_ALLOWLIST = ['removed', 'database', 'reason'] as const;

/** Derivação estável de identidade (não-criptográfica; unicidade lógica). */
export function deterministicEventId(
  correlationId: string,
  eventType: string,
  attempt: number | null,
): string {
  return `aud:${correlationId}:${eventType}:${attempt ?? 0}`;
}

export interface DirectAuditInput {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly storeId: string | null;
  readonly actorId: string | null;
  readonly actorType: AuditEvent['actorType'];
  readonly sessionId?: string | null;
  readonly deviceId?: string | null;
  readonly correlationId: string;
  readonly causationId?: string | null;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  readonly operation?: string | null;
  readonly source: AuditEvent['source'];
  readonly result: AuditEvent['result'];
  readonly errorCode?: string | null;
  readonly error?: unknown;
  readonly configVersionRef?: string | null;
  readonly attempt?: number | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly metadataAllowlist?: readonly string[];
}

export class AuditEventFactory {
  constructor(
    private readonly policy: AuditPolicy,
    private readonly sanitizer: AuditSanitizer,
    private readonly clock: () => Date,
  ) {}

  /**
   * Ponte offline (§4): promove um evento técnico + item da fila ao evento
   * canônico, preservando correlação, tentativa, autorização e os horários
   * distintos (ação ≠ envio ≠ persistência — recordedAt fica com o servidor).
   */
  fromTechnicalEvent(technical: TechnicalEvent, item: QueueItem | undefined): AuditEvent | null {
    if (!this.policy.shouldPromote(technical)) return null;
    const eventType = this.policy.promotedType(technical);
    const correlationId = technical.correlationId ?? item?.idempotencyKey ?? technical.eventId;
    const attempt = technical.attempt ?? item?.attemptCount ?? null;

    return {
      eventId: deterministicEventId(correlationId, eventType, attempt),
      eventType,
      schemaVersion: AUDIT_SCHEMA_VERSION,
      // momento da AÇÃO: o event_time original do item quando existir
      occurredAt: (item?.createdAt ?? technical.timestamp).toISOString(),
      clientMonotonicMs: null,
      sentAt: this.clock().toISOString(),
      recordedAt: null, // AUTORITATIVO: só o servidor preenche (§5/§10)
      storeId: technical.storeId ?? item?.trace.storeId ?? null,
      actorId: item?.authorization.operatorProfileId ?? null,
      actorType: item ? 'human' : 'system',
      sessionId: technical.sessionId ?? item?.trace.sessionId ?? null,
      deviceId: item?.trace.deviceId ?? null,
      correlationId,
      causationId: technical.queueItemId ?? null,
      idempotencyKey: item?.idempotencyKey ?? correlationId,
      entityType: item?.entityType ?? null,
      entityId: item?.entityId ?? null,
      operation: item?.operation ?? null,
      source: 'client-offline',
      executionSource: item ? 'HUMAN' : null,
      previousState: technical.previousState ?? null,
      nextState: technical.nextState ?? null,
      result: this.resultFor(technical),
      errorCode: technical.error?.name ?? null,
      error: technical.error ? this.sanitizer.sanitizeError(technical.error) : null,
      authorizationRef: item
        ? {
            sessionId: item.authorization.sessionId,
            permissionModelVersion: item.authorization.permissionModelVersion ?? null,
            authOrigin: item.authorization.authOrigin,
          }
        : null,
      configVersionRef: item?.authorization.configVersionRef ?? null,
      queueItemId: technical.queueItemId ?? item?.id ?? null,
      attempt,
      metadata: this.sanitizer.sanitizeMetadata(technical.metadata, PROMOTED_METADATA_ALLOWLIST),
    };
  }

  /** Eventos diretos (autenticação, config, admin — §13). */
  fromDirect(input: DirectAuditInput): AuditEvent {
    return {
      eventId: deterministicEventId(input.correlationId, input.eventType, input.attempt ?? null),
      eventType: input.eventType,
      schemaVersion: AUDIT_SCHEMA_VERSION,
      occurredAt: input.occurredAt.toISOString(),
      clientMonotonicMs: null,
      sentAt: this.clock().toISOString(),
      recordedAt: null,
      storeId: input.storeId,
      actorId: input.actorId,
      actorType: input.actorType,
      sessionId: input.sessionId ?? null,
      deviceId: input.deviceId ?? null,
      correlationId: input.correlationId,
      causationId: input.causationId ?? null,
      idempotencyKey: input.correlationId,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      operation: input.operation ?? null,
      source: input.source,
      executionSource: null,
      previousState: null,
      nextState: null,
      result: input.result,
      errorCode: input.errorCode ?? null,
      error: input.error !== undefined ? this.sanitizer.sanitizeError(input.error) : null,
      authorizationRef: null,
      configVersionRef: input.configVersionRef ?? null,
      queueItemId: null,
      attempt: input.attempt ?? null,
      metadata: this.sanitizer.sanitizeMetadata(input.metadata, input.metadataAllowlist ?? []),
    };
  }

  private resultFor(technical: TechnicalEvent): AuditEvent['result'] {
    switch (technical.eventType) {
      case 'sync_finished':
        return 'success';
      case 'conflict_detected':
        return 'conflict';
      case 'review_required':
        return 'review';
      case 'item_failed':
      case 'item_discarded':
        return 'rejected';
      case 'item_quarantined':
      case 'cycle_detected':
        return 'failure';
      default:
        return 'success';
    }
  }
}
