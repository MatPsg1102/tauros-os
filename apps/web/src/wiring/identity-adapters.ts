// Adapters de Identidade Operacional (ADR-021) — implementam os ports de
// @tauros/contracts sobre a infraestrutura local. Vivem no wiring (composition
// root): único lugar, junto de adapters.ts, autorizado a montar infraestrutura.
//
// GARANTIAS DE SEGURANÇA (ADR-021 §5/§8):
//   • PIN em claro só existe dentro de upsert/verify e é descartado; NUNCA é
//     persistido nem devolvido.
//   • O verifier vive em STORE DEDICADO (operational_credentials), jamais na
//     fila operacional genérica, em snapshot, auditoria, log ou URL.
//   • O verifier NÃO é bearer credential: comprova conhecimento do PIN
//     localmente; a autoridade final permanece no servidor (revalidação no sync).

import type { ConfigResolver } from '@tauros/config-engine';
import type {
  CredentialProvisioningPort,
  CredentialStatus,
  CredentialVerification,
  EffectiveAuthorization,
  IdentityResult,
  IdentityVerificationInput,
  OperationalCredentialPort,
  OperationalCredentialRecord,
  OperatorIdentityPort,
  PinLockoutState,
  PinLockoutStorePort,
  PinPolicy,
  PinPolicyPort,
  ProvisioningResult,
  UpsertCredentialInput,
} from '@tauros/contracts';
import { PERMISSION_MODEL_VERSION } from '@tauros/contracts';
import { type LocalStorePort, type PinHasherPort } from '@tauros/infrastructure';

const CREDENTIALS = 'operational_credentials';
const LOCKOUTS = 'pin_lockouts';

const credKey = (storeId: string, employeeId: string): string => `${storeId}:${employeeId}`;
const lockKey = (storeId: string, employeeId: string, deviceId: string): string =>
  `${storeId}:${employeeId}:${deviceId}`;

/** Materializa a política de PIN a partir do Configuration Engine (Baseline §3). */
export class ConfigPinPolicy implements PinPolicyPort {
  constructor(private readonly config: ConfigResolver) {}

  async resolve(storeId: string): Promise<PinPolicy> {
    const [
      length,
      hashAlgo,
      kdfIterations,
      offlineValidityMs,
      maxAttempts,
      lockoutStepsMs,
      hardReauthAfter,
    ] = await Promise.all([
      this.config.resolve('auth.pin.length', storeId),
      this.config.resolve('auth.pin.hashAlgo', storeId),
      this.config.resolve('auth.pin.kdfIterations', storeId),
      this.config.resolve('auth.pin.offlineValidityMs', storeId),
      this.config.resolve('auth.pin.maxAttempts', storeId),
      this.config.resolve('auth.pin.lockoutStepsMs', storeId),
      this.config.resolve('auth.pin.hardReauthAfter', storeId),
    ]);
    return {
      length,
      hashAlgo,
      kdfIterations,
      offlineValidityMs,
      maxAttempts,
      lockoutStepsMs,
      hardReauthAfter,
    };
  }
}

/**
 * Armazenamento/verificação LOCAL da credencial. Deriva o verifier com o KDF
 * (iterações do Baseline no upsert; iterações GRAVADAS no verify — resiliente a
 * mudança de política). Nunca serializa o PIN.
 */
export class LocalOperationalCredentialStore implements OperationalCredentialPort {
  constructor(
    private readonly store: LocalStorePort,
    private readonly hasher: PinHasherPort,
    private readonly policy: PinPolicyPort,
    private readonly clock: () => Date,
  ) {}

  async upsert(input: UpsertCredentialInput): Promise<OperationalCredentialRecord> {
    const policy = await this.policy.resolve(input.storeId);
    const salt = this.hasher.generateSalt();
    const verifier = await this.hasher.derive(input.pin, salt, policy.kdfIterations);
    const now = this.clock().toISOString();
    const existing = await this.get(input.storeId, input.employeeId);
    const record: OperationalCredentialRecord = {
      employeeId: input.employeeId,
      storeId: input.storeId,
      salt,
      verifier,
      algorithm: this.hasher.algorithm,
      params: { iterations: policy.kdfIterations },
      status: input.status,
      // preserva a âncora de confirmação online de uma credencial já existente
      lastOnlineConfirmedAt: existing?.lastOnlineConfirmedAt ?? null,
      updatedAt: now,
      syncStatus: input.status === 'PROVISIONED' ? 'synced' : 'queued',
    };
    await this.store.transaction([CREDENTIALS], 'write', (tx) =>
      tx.put(CREDENTIALS, credKey(input.storeId, input.employeeId), record),
    );
    return record;
  }

  async get(storeId: string, employeeId: string): Promise<OperationalCredentialRecord | null> {
    const row = await this.store.transaction([CREDENTIALS], 'read', (tx) =>
      tx.get(CREDENTIALS, credKey(storeId, employeeId)),
    );
    return (row as OperationalCredentialRecord | undefined) ?? null;
  }

  async verify(storeId: string, employeeId: string, pin: string): Promise<CredentialVerification> {
    const record = await this.get(storeId, employeeId);
    if (record === null) return { kind: 'absent' };
    const candidate = await this.hasher.derive(pin, record.salt, record.params.iterations);
    return this.hasher.matches(candidate, record.verifier)
      ? { kind: 'valid' }
      : { kind: 'invalid' };
  }

  async updateStatus(storeId: string, employeeId: string, status: CredentialStatus): Promise<void> {
    await this.store.transaction([CREDENTIALS], 'write', async (tx) => {
      const current = (await tx.get(CREDENTIALS, credKey(storeId, employeeId))) as
        OperationalCredentialRecord | undefined;
      if (current === undefined) return;
      await tx.put(CREDENTIALS, credKey(storeId, employeeId), {
        ...current,
        status,
        updatedAt: this.clock().toISOString(),
      });
    });
  }

  async markOnlineConfirmed(storeId: string, employeeId: string, at: Date): Promise<void> {
    await this.store.transaction([CREDENTIALS], 'write', async (tx) => {
      const current = (await tx.get(CREDENTIALS, credKey(storeId, employeeId))) as
        OperationalCredentialRecord | undefined;
      if (current === undefined) return;
      await tx.put(CREDENTIALS, credKey(storeId, employeeId), {
        ...current,
        lastOnlineConfirmedAt: at.toISOString(),
        updatedAt: this.clock().toISOString(),
      });
    });
  }
}

/**
 * Estado de lockout LOCAL por (employee × device). Persistente (sobrevive
 * reload), NUNCA sincronizado, NUNCA contém PIN. A escada progressiva usa
 * exclusivamente os limiares do Baseline recebidos por parâmetro.
 */
export class LocalPinLockoutStore implements PinLockoutStorePort {
  constructor(
    private readonly store: LocalStorePort,
    private readonly clock: () => Date,
  ) {}

  async get(
    storeId: string,
    employeeId: string,
    deviceId: string,
  ): Promise<PinLockoutState | null> {
    const row = await this.store.transaction([LOCKOUTS], 'read', (tx) =>
      tx.get(LOCKOUTS, lockKey(storeId, employeeId, deviceId)),
    );
    return (row as PinLockoutState | undefined) ?? null;
  }

  async registerFailure(
    storeId: string,
    employeeId: string,
    deviceId: string,
    policy: { readonly maxAttempts: number; readonly lockoutStepsMs: readonly number[] },
  ): Promise<PinLockoutState> {
    return this.store.transaction([LOCKOUTS], 'write', async (tx) => {
      const current = (await tx.get(LOCKOUTS, lockKey(storeId, employeeId, deviceId))) as
        PinLockoutState | undefined;
      const now = this.clock();
      const consecutiveFailures = (current?.consecutiveFailures ?? 0) + 1;
      const totalFailures = (current?.totalFailures ?? 0) + 1;
      // lockout só a partir de maxAttempts; a duração sobe pela escada do Baseline
      let lockedUntil: string | null = current?.lockedUntil ?? null;
      if (consecutiveFailures >= policy.maxAttempts && policy.lockoutStepsMs.length > 0) {
        const stepIndex = Math.min(
          consecutiveFailures - policy.maxAttempts,
          policy.lockoutStepsMs.length - 1,
        );
        lockedUntil = new Date(
          now.getTime() + (policy.lockoutStepsMs[stepIndex] ?? 0),
        ).toISOString();
      }
      const next: PinLockoutState = {
        storeId,
        employeeId,
        deviceId,
        consecutiveFailures,
        totalFailures,
        lockedUntil,
        updatedAt: now.toISOString(),
      };
      await tx.put(LOCKOUTS, lockKey(storeId, employeeId, deviceId), next);
      return next;
    });
  }

  async reset(storeId: string, employeeId: string, deviceId: string): Promise<void> {
    await this.store.transaction([LOCKOUTS], 'write', async (tx) => {
      const current = (await tx.get(LOCKOUTS, lockKey(storeId, employeeId, deviceId))) as
        PinLockoutState | undefined;
      if (current === undefined) return;
      // preserva totalFailures (base do hard reauth) e zera a janela consecutiva
      await tx.put(LOCKOUTS, lockKey(storeId, employeeId, deviceId), {
        ...current,
        consecutiveFailures: 0,
        lockedUntil: null,
        updatedAt: this.clock().toISOString(),
      });
    });
  }
}

/**
 * Resolve as permissões/identidade de plataforma de um funcionário para montar
 * a autorização efetiva. No piloto (sem backend) as permissões vêm de um
 * snapshot local conhecido; profileId/membershipId são null até provisionamento
 * real (ADR-021 — nunca UUID fictício). PIN autentica, NÃO autoriza: as
 * capabilities continuam vindo daqui, jamais do PIN/posição/cargo.
 */
export interface LocalAuthorizationSource {
  forEmployee(
    storeId: string,
    employeeId: string,
  ): Promise<{
    readonly permissions: readonly string[];
    readonly profileId: string | null;
    readonly membershipId: string | null;
  } | null>;
}

/**
 * Orquestra a identificação OFFLINE (ADR-021 §6): lockout → credencial →
 * verificação → janela offline → autorização efetiva (origin offline-snapshot).
 * NÃO substitui a autoridade do servidor: o sync revalida toda ação.
 */
export class LocalCredentialIdentity implements OperatorIdentityPort {
  constructor(
    private readonly credentials: OperationalCredentialPort,
    private readonly lockouts: PinLockoutStorePort,
    private readonly policy: PinPolicyPort,
    private readonly clock: () => Date,
    private readonly authorization: LocalAuthorizationSource,
  ) {}

  async verify(input: IdentityVerificationInput): Promise<IdentityResult> {
    const { storeId, employeeId, pin, deviceId } = input;
    const policy = await this.policy.resolve(storeId);
    const now = this.clock();

    const lock = await this.lockouts.get(storeId, employeeId, deviceId);
    if (lock?.lockedUntil != null) {
      const until = new Date(lock.lockedUntil).getTime();
      if (until > now.getTime()) {
        return { kind: 'rejected', code: 'LOCKED_OUT', retryAfterMs: until - now.getTime() };
      }
    }

    const credential = await this.credentials.get(storeId, employeeId);
    if (credential === null) return { kind: 'rejected', code: 'NO_CREDENTIAL' };
    if (credential.status === 'BLOCKED' || credential.status === 'RESET_REQUIRED') {
      return { kind: 'rejected', code: 'REAUTH_REQUIRED' };
    }

    const verification = await this.credentials.verify(storeId, employeeId, pin);
    if (verification.kind !== 'valid') {
      const state = await this.lockouts.registerFailure(storeId, employeeId, deviceId, policy);
      if (state.totalFailures >= policy.hardReauthAfter) {
        return { kind: 'rejected', code: 'REAUTH_REQUIRED' };
      }
      if (state.lockedUntil != null) {
        const retry = new Date(state.lockedUntil).getTime() - now.getTime();
        return { kind: 'rejected', code: 'LOCKED_OUT', retryAfterMs: Math.max(0, retry) };
      }
      return { kind: 'rejected', code: 'INVALID_PIN' };
    }

    // janela offline: âncora = última confirmação online OU, para credencial
    // criada offline (LOCAL_PENDING_PROVISIONING), o instante de criação.
    const anchor = credential.lastOnlineConfirmedAt ?? credential.updatedAt;
    const anchorMs = new Date(anchor).getTime();
    if (now.getTime() - anchorMs > policy.offlineValidityMs) {
      return { kind: 'rejected', code: 'OFFLINE_WINDOW_EXPIRED' };
    }

    await this.lockouts.reset(storeId, employeeId, deviceId);

    const resolved = await this.authorization.forEmployee(storeId, employeeId);
    const validUntil = new Date(
      Math.min(now.getTime() + policy.offlineValidityMs, anchorMs + policy.offlineValidityMs),
    );
    const auth: EffectiveAuthorization = {
      operatorEmployeeId: employeeId,
      operatorProfileId: resolved?.profileId ?? null,
      membershipId: resolved?.membershipId ?? null,
      storeId,
      // identidade PRÓPRIA da sessão local — NUNCA platform:<profileId> (ADR-021)
      sessionId: `local-identity:${storeId}:${employeeId}:${deviceId}`,
      permissions: resolved?.permissions ?? [],
      permissionModelVersion: PERMISSION_MODEL_VERSION,
      configVersionRef: undefined,
      validUntil,
      origin: 'offline-snapshot',
    };
    return { kind: 'verified', authorization: auth };
  }
}

/**
 * Fronteira FUTURA de provisionamento (ADR-021 §8). Sem backend real, devolve
 * `unavailable` sem forjar confirmação de servidor — a credencial permanece
 * LOCAL_PENDING_PROVISIONING até o adapter server-side existir.
 */
export class NullCredentialProvisioning implements CredentialProvisioningPort {
  // sem backend: fronteira futura — não forja confirmação de servidor
  provision(): Promise<ProvisioningResult> {
    return Promise.resolve({ kind: 'unavailable' });
  }
}
