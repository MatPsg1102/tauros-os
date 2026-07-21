// Ports do vertical slice de abertura de sessão (7.1).
// application depende SOMENTE de domain+contracts (regra congelada);
// os adapters chegam pelo wiring da aplicação (infrastructure/config-engine).

import type {
  CloseSessionQueuePayload,
  OperatorSessionRecord,
  SessionSyncStatus,
} from './record.js';

export interface ClockPort {
  now(): Date;
}

export interface IdGeneratorPort {
  /** UUID definitivo gerado no cliente (RA-QUEUE-01). */
  uuid(): string;
}

/** Snapshot de autorização efetiva disponível à aplicação (ADR-018). */
export interface EffectiveAuthorization {
  readonly operatorProfileId: string;
  readonly operatorEmployeeId: string;
  readonly storeId: string;
  readonly sessionId: string;
  readonly permissions: readonly string[];
  readonly permissionModelVersion: number | undefined;
  readonly configVersionRef: string | undefined;
  readonly validUntil: Date;
  readonly origin: 'online' | 'offline-snapshot';
}

/** Política efetiva materializada pelo Configuration Engine (ADR-019). */
export interface SessionOpeningPolicy {
  readonly sessionAbsoluteMaxMs: number;
  readonly pinOfflineValidityMs: number;
  readonly configVersionRef: string | null;
}

/** Política de fechamento materializada pelo Configuration Engine (7.2). */
export interface SessionClosingPolicy {
  readonly sessionAbsoluteMaxMs: number;
  /** session.reauthOnAbsolute — reautenticar ao estourar o limite absoluto. */
  readonly reauthOnAbsolute: boolean;
  readonly configVersionRef: string | null;
}

export interface SessionPolicyPort {
  sessionOpeningPolicy(storeId: string): Promise<SessionOpeningPolicy>;
  sessionClosingPolicy(storeId: string): Promise<SessionClosingPolicy>;
}

export interface OperatorSessionRepositoryPort {
  /** Sessão ACTIVE do funcionário nesta loja (invariante de unicidade). */
  findActive(storeId: string, actorEmployeeId: string): Promise<OperatorSessionRecord | null>;
  byId(id: string): Promise<OperatorSessionRecord | null>;
  save(record: OperatorSessionRecord): Promise<void>;
  updateSyncStatus(id: string, status: SessionSyncStatus): Promise<void>;
}

export interface SessionEnqueueInput {
  readonly queueItemId: string;
  readonly record: OperatorSessionRecord;
}

export interface SessionCloseEnqueueInput {
  readonly queueItemId: string;
  readonly sessionId: string;
  readonly idempotencyKey: string;
  readonly payload: CloseSessionQueuePayload;
}

export interface SessionEnqueuePort {
  /** Registra a intenção durável de sincronização (fila oficial). */
  enqueueOpenSession(input: SessionEnqueueInput): Promise<void>;
  /** Fechamento enfileirado APÓS a abertura (ordem garantida pelo DAG). */
  enqueueCloseSession(input: SessionCloseEnqueueInput): Promise<void>;
}

export interface SessionAuditInput {
  readonly eventType:
    'auth.login.success' | 'auth.login.failure' | 'access.denied' | 'auth.session.ended';
  readonly occurredAt: Date;
  readonly storeId: string;
  readonly actorProfileId: string;
  readonly sessionId: string | null;
  readonly deviceId: string;
  readonly correlationId: string;
  readonly source: 'client-online' | 'client-offline';
  readonly result: 'success' | 'failure' | 'rejected';
  readonly errorCode?: string;
  /** Operação sobre a entidade auditada (default: 'open'). */
  readonly operation?: 'open' | 'close';
}

export interface SessionAuditPort {
  record(input: SessionAuditInput): Promise<void>;
}
