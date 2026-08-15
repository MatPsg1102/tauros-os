// Identidade Operacional (ADR-021) — modelos LOCAIS da credencial de PIN e do
// estado de lockout. Employee é a identidade operacional; a credencial é um
// conceito SEPARADO (relação 1:0..1). NUNCA guarda PIN em texto puro: só o
// verifier derivado (salt + KDF). O verifier local existe apenas para a
// verificação offline — jamais trafega pela fila operacional genérica, nem
// entra em AuthorizationSnapshot, auditoria, logs ou URLs.

import type { LocalSyncStatus } from '../sync/status.js';

/** Store local dedicado à credencial (nunca reutiliza store de fila/evidência). */
export const ENTITY_OPERATIONAL_CREDENTIAL = 'operational_credentials' as const;

/** Store local do estado de lockout por (employee × device) — nunca sincronizado. */
export const ENTITY_PIN_LOCKOUT = 'pin_lockouts' as const;

/**
 * Ciclo de vida da credencial (ADR-021 §7). Nasce LOCAL_PENDING_PROVISIONING
 * quando criada offline: vale SÓ no dispositivo de origem até o servidor
 * provisionar o verifier autorizado. Estados de bloqueio/reset acompanham a
 * decisão do encarregado autorizado ou do servidor.
 */
export type CredentialStatus =
  'LOCAL_PENDING_PROVISIONING' | 'PROVISIONED' | 'BLOCKED' | 'RESET_REQUIRED';

/**
 * Registro LOCAL da credencial. `verifier` é o hash derivado do PIN com `salt`
 * individual pelo KDF indicado em `algorithm`/`params` — NÃO é o PIN e NÃO
 * funciona como bearer credential (o servidor nunca compara igualdade de hash
 * recebido do cliente). `params` carrega apenas metadados públicos do KDF
 * (ex.: iterações do PBKDF2), nunca segredo.
 */
export interface OperationalCredentialRecord {
  readonly employeeId: string;
  readonly storeId: string;
  /** Salt aleatório por credencial, base64 — público, não é segredo. */
  readonly salt: string;
  /** Verifier derivado (hash), base64. Nunca o PIN. */
  readonly verifier: string;
  /** Identificador do KDF usado (ex.: 'PBKDF2-SHA256'). */
  readonly algorithm: string;
  /**
   * Metadados PÚBLICOS do KDF (nunca segredo). `iterations` cobre o PBKDF2 do
   * Baseline; um KDF futuro (argon2id) estende esta forma sem migração
   * destrutiva, pois cada credencial grava seu próprio algorithm/params.
   */
  readonly params: {
    readonly iterations: number;
    readonly [key: string]: number;
  };
  readonly status: CredentialStatus;
  /**
   * Último instante (ISO) em que a identidade foi confirmada ONLINE pelo
   * servidor — âncora da janela `auth.pin.offlineValidityMs`. null enquanto a
   * credencial nunca foi confirmada online (nasceu offline).
   */
  readonly lastOnlineConfirmedAt: string | null;
  readonly updatedAt: string;
  /** Estado de provisionamento/sync da credencial (nunca a fila genérica). */
  readonly syncStatus: LocalSyncStatus;
}

/**
 * Estado de lockout LOCAL por (employee × device). Persistente entre reloads,
 * NUNCA contém PIN e NUNCA é sincronizado nesta fase. Todos os limiares vêm do
 * Configuration Baseline (auth.pin.maxAttempts / lockoutStepsMs / hardReauthAfter).
 */
export interface PinLockoutState {
  readonly storeId: string;
  readonly employeeId: string;
  readonly deviceId: string;
  /** Erros consecutivos na janela corrente (zera no sucesso). */
  readonly consecutiveFailures: number;
  /** Erros totais acumulados (base do hard reauth online). */
  readonly totalFailures: number;
  /** Bloqueado até este instante (ISO); null = livre para tentar. */
  readonly lockedUntil: string | null;
  readonly updatedAt: string;
}
