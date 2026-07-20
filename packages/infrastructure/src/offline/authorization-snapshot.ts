// Snapshot de autorização (RA-QUEUE-01 §7 · ADR-014/018).
// Registra o contexto efetivo NO MOMENTO da operação offline.
// NÃO substitui a validação server-side: o servidor é a autoridade final.

export type AuthOrigin = 'online' | 'offline-pin';

export interface AuthorizationSnapshot {
  readonly operatorProfileId: string;
  readonly operatorEmployeeId: string;
  readonly storeId: string;
  readonly sessionId: string;
  readonly permissions: readonly string[];
  readonly permissionModelVersion: number | undefined;
  readonly configVersionRef: string | undefined;
  readonly capturedAt: Date;
  readonly validUntil: Date;
  readonly authOrigin: AuthOrigin;
}

export interface SnapshotInput {
  readonly operatorProfileId: string;
  readonly operatorEmployeeId: string;
  readonly storeId: string;
  readonly sessionId: string;
  readonly permissions: readonly string[];
  readonly permissionModelVersion?: number;
  readonly configVersionRef?: string;
  readonly authOrigin: AuthOrigin;
}

/** Captura um snapshot com validade explícita (ttl vem da configuração). */
export function captureSnapshot(
  input: SnapshotInput,
  ttlMs: number,
  clock: () => Date,
): AuthorizationSnapshot {
  const capturedAt = clock();
  return {
    operatorProfileId: input.operatorProfileId,
    operatorEmployeeId: input.operatorEmployeeId,
    storeId: input.storeId,
    sessionId: input.sessionId,
    permissions: [...input.permissions],
    permissionModelVersion: input.permissionModelVersion,
    configVersionRef: input.configVersionRef,
    capturedAt,
    validUntil: new Date(capturedAt.getTime() + ttlMs),
    authOrigin: input.authOrigin,
  };
}

/** Validade local do snapshot. Expirado ⇒ item vai para revisão, nunca envio cego. */
export function isSnapshotValid(snapshot: AuthorizationSnapshot, now: Date): boolean {
  return snapshot.validUntil.getTime() > now.getTime();
}
