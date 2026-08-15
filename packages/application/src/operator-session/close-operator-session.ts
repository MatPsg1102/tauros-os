// Use case: fechar a sessão operacional (7.2). Mesma espinha da abertura —
// autorização efetiva (ADR-018), política via Configuration Engine (ADR-019,
// por port), decisão de domínio, persistência local, fila e auditoria — SEM
// conhecer infraestrutura.
//
// Ordem de efeitos e recuperação (atomicidade sem transação distribuída):
//   1. enqueue (intenção durável do fechamento);
//   2. save local (sessão passa a CLOSED_LOCAL);
//   3. audit (auth.session.ended).
// Falha entre 1 e 2 é recuperável: o boot reconcilia pelo payload da fila.

import {
  decideCloseSession,
  type ClosableSessionView,
  type CloseSessionDecision,
  type SessionEndReason,
} from '@tauros/domain';
import {
  CAPABILITY_SESSION_CLOSE,
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type EffectiveAuthorization,
  type IdGeneratorPort,
  type OperatorSessionRecord,
  type OperatorSessionRepositoryPort,
  type SessionAuditPort,
  type SessionEnqueuePort,
  type SessionPolicyPort,
} from '@tauros/contracts';

export interface CloseOperatorSessionInput {
  readonly authorization: EffectiveAuthorization;
  readonly sessionId: string;
  readonly deviceId: string;
  /** Fuso IANA da LOJA (dado oficial da loja — nunca o fuso do dispositivo). */
  readonly storeTimeZone: string;
  readonly closedOffline: boolean;
  readonly endReason: SessionEndReason;
}

export type CloseOperatorSessionFailureCode =
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'STORE_MISMATCH'
  | 'CONFIG_UNAVAILABLE'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_NOT_ACTIVE'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type CloseOperatorSessionResult =
  | { readonly kind: 'closed'; readonly record: OperatorSessionRecord }
  | { readonly kind: 'already-closed'; readonly record: OperatorSessionRecord }
  | {
      readonly kind: 'failed';
      readonly code: CloseOperatorSessionFailureCode;
      readonly detail: string;
    };

/** Identidade determinística da OPERAÇÃO de fechamento (nunca timestamp). */
export function closeIdempotencyKeyFor(
  storeId: string,
  sessionId: string,
  deviceId: string,
): string {
  return `session-close:${storeId}:${sessionId}:${deviceId}`;
}

export class CloseOperatorSessionUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly policy: SessionPolicyPort,
    private readonly repository: OperatorSessionRepositoryPort,
    private readonly queue: SessionEnqueuePort,
    private readonly audit: SessionAuditPort,
  ) {}

  async execute(input: CloseOperatorSessionInput): Promise<CloseOperatorSessionResult> {
    const now = this.clock.now();
    const auth = input.authorization;
    const source = input.closedOffline ? 'client-offline' : 'client-online';

    // ADR-018: a APLICAÇÃO revalida — ocultar o botão não é controle de acesso
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
    if (!auth.permissions.includes(CAPABILITY_SESSION_CLOSE)) {
      await this.audit.record({
        eventType: 'access.denied',
        occurredAt: now,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        actorProfileId: auth.operatorProfileId,
        sessionId: input.sessionId,
        deviceId: input.deviceId,
        correlationId: input.sessionId,
        source,
        result: 'rejected',
        errorCode: CAPABILITY_SESSION_CLOSE,
        operation: 'close',
      });
      return { kind: 'failed', code: 'PERMISSION_DENIED', detail: 'capability ausente' };
    }

    let policyValues;
    try {
      policyValues = await this.policy.sessionClosingPolicy(auth.storeId);
    } catch (error) {
      return {
        kind: 'failed',
        code: 'CONFIG_UNAVAILABLE',
        detail: error instanceof Error ? error.message : 'configuração indisponível',
      };
    }

    const existing = await this.repository.byId(input.sessionId);
    if (existing === null) {
      return {
        kind: 'failed',
        code: 'SESSION_NOT_FOUND',
        detail: 'turno não encontrado neste aparelho',
      };
    }
    if (existing.storeId !== auth.storeId) {
      return { kind: 'failed', code: 'STORE_MISMATCH', detail: 'turno pertence a outra loja' };
    }

    const idempotencyKey = closeIdempotencyKeyFor(auth.storeId, existing.id, existing.deviceId);
    const view: ClosableSessionView = {
      id: existing.id,
      storeId: existing.storeId,
      actorEmployeeId: existing.actorEmployeeId,
      deviceId: existing.deviceId,
      operationalDate: existing.operationalDate,
      status: existing.status,
      closeIdempotencyKey: existing.closeIdempotencyKey,
    };

    const decision: CloseSessionDecision = decideCloseSession(
      {
        sessionId: existing.id,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        deviceId: existing.deviceId,
        clientClosedAt: now,
        // fechamento pertence à MESMA data operacional da abertura
        operationalDate: existing.operationalDate,
        closedOffline: input.closedOffline,
        endReason: input.endReason,
        idempotencyKey,
      },
      view,
    );

    if (decision.kind === 'already-closed') {
      return { kind: 'already-closed', record: existing };
    }
    if (decision.kind === 'rejected') {
      if (decision.code === 'SESSION_NOT_ACTIVE') {
        return { kind: 'failed', code: 'SESSION_NOT_ACTIVE', detail: decision.detail };
      }
      if (decision.code === 'SESSION_NOT_FOUND') {
        return { kind: 'failed', code: 'SESSION_NOT_FOUND', detail: decision.detail };
      }
      if (decision.code === 'STORE_MISMATCH') {
        return { kind: 'failed', code: 'STORE_MISMATCH', detail: decision.detail };
      }
      return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
    }

    const closed = decision.session;
    const record: OperatorSessionRecord = {
      ...existing,
      status: 'CLOSED_LOCAL',
      clientClosedAt: closed.clientClosedAt.toISOString(),
      closedOffline: closed.closedOffline,
      endReason: closed.endReason,
      closeIdempotencyKey: closed.idempotencyKey,
      closeSyncStatus: 'queued',
      configVersionRef: policyValues.configVersionRef ?? existing.configVersionRef,
    };

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local; 3) auditoria
    try {
      await this.queue.enqueueCloseSession({
        queueItemId: this.ids.uuid(),
        sessionId: record.id,
        idempotencyKey: closed.idempotencyKey,
        payload: {
          sessionId: record.id,
          storeId: record.storeId,
          actorEmployeeId: record.actorEmployeeId,
          clientClosedAt: record.clientClosedAt ?? closed.clientClosedAt.toISOString(),
          closedOffline: record.closedOffline,
          endReason: closed.endReason,
          operationalDate: record.operationalDate,
        },
      });
    } catch (error) {
      await this.audit.record({
        eventType: 'auth.login.failure',
        occurredAt: now,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        actorProfileId: auth.operatorProfileId,
        sessionId: record.id,
        deviceId: input.deviceId,
        correlationId: record.auditCorrelationId,
        source,
        result: 'failure',
        errorCode: 'ENQUEUE_FAILED',
        operation: 'close',
      });
      return {
        kind: 'failed',
        code: 'ENQUEUE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao enfileirar',
      };
    }

    try {
      await this.repository.save(record);
    } catch (error) {
      // intenção durável já registrada — o boot reconcilia
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao persistir localmente',
      };
    }

    await this.audit.record({
      eventType: 'auth.session.ended',
      occurredAt: now,
      storeId: auth.storeId,
      actorEmployeeId: auth.operatorEmployeeId,
      actorProfileId: auth.operatorProfileId,
      sessionId: record.id,
      deviceId: input.deviceId,
      correlationId: record.auditCorrelationId,
      source,
      result: 'success',
      operation: 'close',
    });

    return { kind: 'closed', record };
  }
}
