// Identidade Operacional (ADR-021) — ports. A aplicação/UI dependem SOMENTE
// destes contratos; os adapters (KDF, IndexedDB, fixtures, backend) chegam
// pelo wiring. `employeeId` IDENTIFICA (obrigatório); PIN VERIFICA. O PIN nunca
// cruza a fronteira de um adapter sem ser descartado logo após a verificação.

import type { EffectiveAuthorization } from '../operator-session/ports.js';
import type { CredentialStatus, OperationalCredentialRecord, PinLockoutState } from './record.js';

/**
 * Política de PIN materializada pelo Configuration Engine (ADR-019/Baseline §3).
 * Nenhum valor numérico é decidido aqui — todos vêm do catálogo congelado
 * (auth.pin.*). A ADR define responsabilidade; o Baseline define valores.
 */
export interface PinPolicy {
  readonly length: number;
  readonly hashAlgo: string;
  readonly kdfIterations: number;
  readonly offlineValidityMs: number;
  readonly maxAttempts: number;
  readonly lockoutStepsMs: readonly number[];
  readonly hardReauthAfter: number;
}

export interface PinPolicyPort {
  resolve(storeId: string): Promise<PinPolicy>;
}

/** Pedido de identificação: employeeId identifica, PIN verifica. */
export interface IdentityVerificationInput {
  readonly storeId: string;
  readonly employeeId: string;
  /** PIN em claro — usado só para verificar e imediatamente descartado. */
  readonly pin: string;
  readonly deviceId: string;
}

export type IdentityRejectionCode =
  | 'INVALID_PIN'
  | 'LOCKED_OUT'
  | 'NO_CREDENTIAL'
  | 'OFFLINE_WINDOW_EXPIRED'
  | 'REAUTH_REQUIRED'
  | 'UNKNOWN_EMPLOYEE';

/**
 * Resultado da identificação. `verified` entrega a autorização efetiva já
 * resolvida (ADR-018) — PIN autentica, mas NÃO concede permissão: as
 * capabilities continuam vindo do resolver/snapshot. Rejeições são neutras
 * (não revelam se a credencial existe); `retryAfterMs` só quando em lockout.
 */
export type IdentityResult =
  | { readonly kind: 'verified'; readonly authorization: EffectiveAuthorization }
  | {
      readonly kind: 'rejected';
      readonly code: IdentityRejectionCode;
      readonly retryAfterMs?: number;
    };

/**
 * Fronteira ÚNICA de identificação para a aplicação/UI. Um adapter resolve a
 * identidade sem que o consumidor saiba se ela veio de fixture DEV, credencial
 * local ou backend real. NUNCA descobre identidade por PIN global: recebe o
 * employeeId selecionado e verifica o PIN daquele funcionário.
 */
export interface OperatorIdentityPort {
  verify(input: IdentityVerificationInput): Promise<IdentityResult>;
}

/** Entrada de criação/atualização local de credencial (PIN nunca é persistido). */
export interface UpsertCredentialInput {
  readonly storeId: string;
  readonly employeeId: string;
  /** PIN em claro — derivado para verifier e descartado; nunca armazenado. */
  readonly pin: string;
  /** Status inicial (offline ⇒ LOCAL_PENDING_PROVISIONING). */
  readonly status: CredentialStatus;
}

export type CredentialVerification =
  { readonly kind: 'valid' } | { readonly kind: 'invalid' } | { readonly kind: 'absent' };

/**
 * Armazenamento/verificação LOCAL da credencial (verifier). Deriva e compara o
 * verifier em memória; nunca expõe nem persiste o PIN. Store dedicado — não
 * compartilha object store com fila/evidência.
 */
export interface OperationalCredentialPort {
  upsert(input: UpsertCredentialInput): Promise<OperationalCredentialRecord>;
  get(storeId: string, employeeId: string): Promise<OperationalCredentialRecord | null>;
  verify(storeId: string, employeeId: string, pin: string): Promise<CredentialVerification>;
  updateStatus(storeId: string, employeeId: string, status: CredentialStatus): Promise<void>;
  /** Marca confirmação online (âncora da janela offline). */
  markOnlineConfirmed(storeId: string, employeeId: string, at: Date): Promise<void>;
}

/** Estado de lockout local por (employee × device). */
export interface PinLockoutStorePort {
  get(storeId: string, employeeId: string, deviceId: string): Promise<PinLockoutState | null>;
  /** Registra falha e devolve o estado atualizado (aplica a escada do Baseline). */
  registerFailure(
    storeId: string,
    employeeId: string,
    deviceId: string,
    policy: { readonly maxAttempts: number; readonly lockoutStepsMs: readonly number[] },
  ): Promise<PinLockoutState>;
  /** Zera o estado após sucesso. */
  reset(storeId: string, employeeId: string, deviceId: string): Promise<void>;
}

export type ProvisioningResult =
  | { readonly kind: 'provisioned' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'unavailable' };

/**
 * FRONTEIRA FUTURA de provisionamento server-side (ADR-021 §8). Promove a
 * credencial LOCAL_PENDING_PROVISIONING ao servidor, que passa a ser a fonte
 * do verifier. Material de credencial NUNCA trafega pela fila operacional
 * genérica — este canal é separado. Sem backend, o adapter local devolve
 * `unavailable`/`pending` sem forjar confirmação de servidor.
 */
export interface CredentialProvisioningPort {
  provision(storeId: string, employeeId: string): Promise<ProvisioningResult>;
}
