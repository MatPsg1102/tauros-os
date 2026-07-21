// Use case: abrir sessão operacional (7.1). Orquestra autorização efetiva
// (ADR-018), política via Configuration Engine (ADR-019, adaptada por port),
// decisão de domínio, persistência local, auditoria e intenção durável de
// sincronização — SEM conhecer infraestrutura (ports de @tauros/contracts).
//
// Ordem de efeitos e recuperação (atomicidade sem transação distribuída):
//   1. enqueue (intenção durável — carrega o registro completo no payload);
//   2. save local (estado consultável);
//   3. audit (auth.login.success).
// Falha entre 1 e 2 é recuperável: o boot reconstrói o registro a partir do
// payload da fila (reconcileFromQueue no wiring — testado no slice vertical).
// Falha no enqueue ⇒ nada persistido (estado íntegro) + auditoria de falha.

import {
  decideOpenSession,
  type ActiveSessionView,
  type OpenSessionDecision,
} from '@tauros/domain';
import {
  CAPABILITY_SESSION_OPEN,
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

export interface OpenOperatorSessionInput {
  readonly authorization: EffectiveAuthorization;
  readonly membershipId: string | null;
  readonly deviceId: string;
  /** Fuso IANA da LOJA (dado oficial da loja — nunca o fuso do dispositivo). */
  readonly storeTimeZone: string;
  readonly openedOffline: boolean;
}

export type OpenOperatorSessionFailureCode =
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'STORE_MISMATCH'
  | 'CONFIG_UNAVAILABLE'
  | 'SESSION_ALREADY_ACTIVE'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type OpenOperatorSessionResult =
  | { readonly kind: 'opened'; readonly record: OperatorSessionRecord }
  | { readonly kind: 'already-open'; readonly record: OperatorSessionRecord }
  | {
      readonly kind: 'failed';
      readonly code: OpenOperatorSessionFailureCode;
      readonly detail: string;
    };

/** Data civil YYYY-MM-DD no fuso informado — determinística para (clock, tz). */
export function operationalDateFor(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
  return parts; // en-CA produz exatamente YYYY-MM-DD
}

export class OpenOperatorSessionUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly policy: SessionPolicyPort,
    private readonly repository: OperatorSessionRepositoryPort,
    private readonly queue: SessionEnqueuePort,
    private readonly audit: SessionAuditPort,
  ) {}

  async execute(input: OpenOperatorSessionInput): Promise<OpenOperatorSessionResult> {
    const now = this.clock.now();
    const auth = input.authorization;
    const source = input.openedOffline ? 'client-offline' : 'client-online';

    // ADR-018: a APLICAÇÃO revalida a capacidade (ocultação visual não é controle)
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
    if (!auth.permissions.includes(CAPABILITY_SESSION_OPEN)) {
      await this.audit.record({
        eventType: 'access.denied',
        occurredAt: now,
        storeId: auth.storeId,
        actorProfileId: auth.operatorProfileId,
        sessionId: null,
        deviceId: input.deviceId,
        correlationId: auth.sessionId,
        source,
        result: 'rejected',
        errorCode: CAPABILITY_SESSION_OPEN,
      });
      return { kind: 'failed', code: 'PERMISSION_DENIED', detail: 'capability ausente' };
    }

    let policyValues;
    try {
      policyValues = await this.policy.sessionOpeningPolicy(auth.storeId);
    } catch (error) {
      return {
        kind: 'failed',
        code: 'CONFIG_UNAVAILABLE',
        detail: error instanceof Error ? error.message : 'configuração indisponível',
      };
    }

    const operationalDate = operationalDateFor(now, input.storeTimeZone);
    const idempotencyKey = `session-open:${auth.storeId}:${auth.operatorEmployeeId}:${operationalDate}:${input.deviceId}`;

    const existing = await this.repository.findActive(auth.storeId, auth.operatorEmployeeId);
    const activeView: ActiveSessionView | null =
      existing === null
        ? null
        : {
            id: existing.id,
            storeId: existing.storeId,
            actorEmployeeId: existing.actorEmployeeId,
            idempotencyKey: existing.idempotencyKey,
            status: 'ACTIVE',
          };

    const decision: OpenSessionDecision = decideOpenSession(
      {
        sessionId: this.ids.uuid(),
        storeId: auth.storeId,
        membershipId: input.membershipId,
        actorProfileId: auth.operatorProfileId,
        actorEmployeeId: auth.operatorEmployeeId,
        deviceId: input.deviceId,
        clientOpenedAt: now,
        operationalDate,
        openedOffline: input.openedOffline,
        idempotencyKey,
      },
      activeView,
    );

    if (decision.kind === 'already-open') {
      // idempotência: reapresentação do mesmo comando devolve o estado atual
      return { kind: 'already-open', record: existing as OperatorSessionRecord };
    }
    if (decision.kind === 'rejected') {
      if (decision.code === 'SESSION_ALREADY_ACTIVE') {
        return { kind: 'failed', code: 'SESSION_ALREADY_ACTIVE', detail: decision.detail };
      }
      return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
    }

    const session = decision.session;
    const record: OperatorSessionRecord = {
      id: session.id,
      storeId: session.storeId,
      membershipId: session.membershipId,
      actorProfileId: session.actorProfileId,
      actorEmployeeId: session.actorEmployeeId,
      deviceId: session.deviceId,
      clientOpenedAt: session.clientOpenedAt.toISOString(),
      openedOffline: session.openedOffline,
      status: 'ACTIVE',
      operationalDate: session.operationalDate,
      authorizationValidUntil: auth.validUntil.toISOString(),
      permissionModelVersion: auth.permissionModelVersion ?? PERMISSION_MODEL_VERSION,
      configVersionRef: policyValues.configVersionRef,
      idempotencyKey: session.idempotencyKey,
      syncStatus: 'queued',
      auditCorrelationId: session.id,
      // campos de fechamento nascem vazios (7.2 os preenche)
      clientClosedAt: null,
      closedOffline: false,
      endReason: null,
      closeIdempotencyKey: null,
      closeSyncStatus: null,
    };

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local; 3) auditoria
    try {
      await this.queue.enqueueOpenSession({ queueItemId: this.ids.uuid(), record });
    } catch (error) {
      await this.audit.record({
        eventType: 'auth.login.failure',
        occurredAt: now,
        storeId: auth.storeId,
        actorProfileId: auth.operatorProfileId,
        sessionId: null,
        deviceId: input.deviceId,
        correlationId: record.auditCorrelationId,
        source,
        result: 'failure',
        errorCode: 'ENQUEUE_FAILED',
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
      // intenção durável já registrada — o boot reconcilia (recuperação testada)
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao persistir localmente',
      };
    }

    await this.audit.record({
      eventType: 'auth.login.success',
      occurredAt: now,
      storeId: auth.storeId,
      actorProfileId: auth.operatorProfileId,
      sessionId: record.id,
      deviceId: input.deviceId,
      correlationId: record.auditCorrelationId,
      source,
      result: 'success',
    });

    return { kind: 'opened', record };
  }
}
