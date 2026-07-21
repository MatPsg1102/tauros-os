// Registro serializável da sessão operacional (espelha operator_sessions do
// schema congelado — datas em ISO-8601 para persistência local estável).

import type { LocalSyncStatus } from '../sync/status.js';

export const ENTITY_OPERATOR_SESSION = 'operator_sessions' as const;

/** Estado de sincronização derivado da fila (nomenclatura de UI mapeada). */
export type SessionSyncStatus = LocalSyncStatus;

/**
 * Subconjunto de session_status exercido pelo cliente (7.2). REJECTED e
 * NEEDS_REVIEW são desfechos do servidor e chegam pelo syncStatus da fila.
 */
export type OperatorSessionStatus = 'ACTIVE' | 'CLOSED_LOCAL' | 'CLOSED_CONFIRMED';

/** session_end_reason do schema congelado (sem valores novos). */
export type SessionEndReason = 'SWITCH' | 'LOGOUT' | 'EXPIRED' | 'STORE_SWITCH';

export interface OperatorSessionRecord {
  readonly id: string;
  readonly storeId: string;
  readonly membershipId: string | null;
  readonly actorProfileId: string;
  readonly actorEmployeeId: string;
  readonly deviceId: string;
  /** Horário do CLIENTE (clock port) — o servidor preenche opened_at. */
  readonly clientOpenedAt: string;
  readonly openedOffline: boolean;
  readonly status: OperatorSessionStatus;
  /** Data operacional civil (YYYY-MM-DD) no fuso da LOJA — exibição/escopo. */
  readonly operationalDate: string;
  readonly authorizationValidUntil: string;
  readonly permissionModelVersion: number;
  readonly configVersionRef: string | null;
  readonly idempotencyKey: string;
  readonly syncStatus: SessionSyncStatus;
  /** Correlação de auditoria (RA-QUEUE-01: id definitivo gerado no cliente). */
  readonly auditCorrelationId: string;
  /** Horário do CLIENTE no fechamento — o servidor preenche closed_at (7.2). */
  readonly clientClosedAt: string | null;
  readonly closedOffline: boolean;
  readonly endReason: SessionEndReason | null;
  /**
   * Chave de idempotência da OPERAÇÃO de fechamento (distinta da abertura):
   * a fila é endereçada por operação, não por linha.
   */
  readonly closeIdempotencyKey: string | null;
  /** Estado de sincronização da operação de fechamento (7.2). */
  readonly closeSyncStatus: SessionSyncStatus | null;
}

/** Payload da operação enfileirada (contrato de sincronização do slice). */
export interface OpenSessionQueuePayload {
  readonly record: OperatorSessionRecord;
}

/** Payload do fechamento — só o necessário para o servidor concluir (7.2). */
export interface CloseSessionQueuePayload {
  readonly sessionId: string;
  readonly storeId: string;
  readonly actorEmployeeId: string;
  readonly clientClosedAt: string;
  readonly closedOffline: boolean;
  readonly endReason: SessionEndReason;
  readonly operationalDate: string;
}
