// Snapshot de autorização (RA-QUEUE-01 §7 · ADR-014/018).
// Registra o contexto efetivo NO MOMENTO da operação offline.
// NÃO substitui a validação server-side: o servidor é a autoridade final.

export type AuthOrigin = 'online' | 'offline-pin';

export interface AuthorizationSnapshot {
  /** Identidade de plataforma opcional (ADR-021): null até provisionamento. */
  readonly operatorProfileId: string | null;
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
  readonly operatorProfileId: string | null;
  readonly operatorEmployeeId: string;
  readonly storeId: string;
  readonly sessionId: string;
  readonly permissions: readonly string[];
  readonly permissionModelVersion?: number;
  readonly configVersionRef?: string;
  readonly authOrigin: AuthOrigin;
}

// Campos que NUNCA podem existir num snapshot (§9 — segurança local). Inclui o
// material de credencial de PIN (ADR-021 §8): salt/verifier/hash jamais entram
// no snapshot, que carrega CONTEXTO de autorização, nunca o segredo/prova.
const FORBIDDEN_FIELD_PATTERN =
  /token|secret|password|senha|pin|credential|authorization|api[_-]?key|service[_-]?role|verifier|salt|hash/i;

export class SnapshotSecurityError extends Error {
  constructor(readonly offendingFields: readonly string[]) {
    super(
      `Snapshot rejeitado: campos proibidos [${offendingFields.join(', ')}]. ` +
        `O snapshot carrega CONTEXTO de autorização, nunca o segredo que a concedeu.`,
    );
    this.name = 'SnapshotSecurityError';
  }
}

/** Rejeita objetos externos que tentem embutir material de segredo. */
function assertNoSecretMaterial(input: object): void {
  const offending = Object.keys(input).filter((k) => FORBIDDEN_FIELD_PATTERN.test(k));
  if (offending.length > 0) throw new SnapshotSecurityError(offending);
}

/** Captura um snapshot com validade explícita (ttl vem da configuração). */
export function captureSnapshot(
  input: SnapshotInput,
  ttlMs: number,
  clock: () => Date,
): AuthorizationSnapshot {
  assertNoSecretMaterial(input);
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
