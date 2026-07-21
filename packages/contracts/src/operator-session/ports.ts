// Ports do vertical slice de abertura de sessão (7.1).
// application depende SOMENTE de domain+contracts (regra congelada);
// os adapters chegam pelo wiring da aplicação (infrastructure/config-engine).

import type { OperatorSessionRecord, SessionSyncStatus } from './record.js';

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

export interface SessionPolicyPort {
  sessionOpeningPolicy(storeId: string): Promise<SessionOpeningPolicy>;
}

export interface OperatorSessionRepositoryPort {
  /** Sessão ACTIVE do funcionário nesta loja (invariante de unicidade). */
  findActive(storeId: string, actorEmployeeId: string): Promise<OperatorSessionRecord | null>;
  save(record: OperatorSessionRecord): Promise<void>;
  updateSyncStatus(id: string, status: SessionSyncStatus): Promise<void>;
}

export interface SessionEnqueueInput {
  readonly queueItemId: string;
  readonly record: OperatorSessionRecord;
}

export interface SessionEnqueuePort {
  /** Registra a intenção durável de sincronização (fila oficial). */
  enqueueOpenSession(input: SessionEnqueueInput): Promise<void>;
}

export interface SessionAuditInput {
  readonly eventType: 'auth.login.success' | 'auth.login.failure' | 'access.denied';
  readonly occurredAt: Date;
  readonly storeId: string;
  readonly actorProfileId: string;
  readonly sessionId: string | null;
  readonly deviceId: string;
  readonly correlationId: string;
  readonly source: 'client-online' | 'client-offline';
  readonly result: 'success' | 'failure' | 'rejected';
  readonly errorCode?: string;
}

export interface SessionAuditPort {
  record(input: SessionAuditInput): Promise<void>;
}
