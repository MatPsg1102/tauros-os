// Registro serializável da sessão operacional (espelha operator_sessions do
// schema congelado — datas em ISO-8601 para persistência local estável).

export const ENTITY_OPERATOR_SESSION = 'operator_sessions' as const;

/** Estado de sincronização derivado da fila (nomenclatura de UI mapeada). */
export type SessionSyncStatus = 'queued' | 'syncing' | 'synced' | 'conflict' | 'failed';

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
  readonly status: 'ACTIVE';
  /** Data operacional civil (YYYY-MM-DD) no fuso da LOJA — exibição/escopo. */
  readonly operationalDate: string;
  readonly authorizationValidUntil: string;
  readonly permissionModelVersion: number;
  readonly configVersionRef: string | null;
  readonly idempotencyKey: string;
  readonly syncStatus: SessionSyncStatus;
  /** Correlação de auditoria (RA-QUEUE-01: id definitivo gerado no cliente). */
  readonly auditCorrelationId: string;
}

/** Payload da operação enfileirada (contrato de sincronização do slice). */
export interface OpenSessionQueuePayload {
  readonly record: OperatorSessionRecord;
}
