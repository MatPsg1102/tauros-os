// Identidade Operacional V1 (ADR-021) — testes dirigidos dos adapters locais:
// credencial de PIN (verifier), lockout progressivo, orquestração offline e o
// adapter DEV de fixtures — todos sobre o MESMO OperatorIdentityPort. Provas de
// segurança: PIN/salt/verifier nunca vazam para autorização/snapshot/fila.

import { describe, expect, it } from 'vitest';

import type { LocalAuthorizationSource } from '../src/wiring/identity-adapters.js';
import {
  ConfigPinPolicy,
  LocalCredentialIdentity,
  LocalOperationalCredentialStore,
  LocalPinLockoutStore,
  NullCredentialProvisioning,
} from '../src/wiring/identity-adapters.js';
import { FixtureOperatorIdentity } from '../src/wiring/fixtures.js';
import {
  ENTITY_OPERATIONAL_CREDENTIAL,
  type PinPolicy,
  type PinPolicyPort,
} from '@tauros/contracts';
import {
  captureSnapshot,
  MemoryLocalStore,
  Pbkdf2PinHasher,
  SnapshotSecurityError,
} from '@tauros/infrastructure';

import { APP_STATE_SCHEMA } from '../src/wiring/adapters.js';

const STORE = 'store-centro-0001';
const EMP = 'emp-9001';
const DEVICE = 'device-web-01';

// Política de teste (a real vem do Baseline via Config Engine): iterações
// baixas para velocidade; escada curta para exercitar o lockout.
const TEST_POLICY: PinPolicy = {
  length: 4,
  hashAlgo: 'PBKDF2-SHA256',
  kdfIterations: 1000,
  offlineValidityMs: 259_200_000,
  maxAttempts: 3,
  lockoutStepsMs: [1000, 5000],
  hardReauthAfter: 6,
};

class StubPinPolicy implements PinPolicyPort {
  constructor(private readonly policy: PinPolicy = TEST_POLICY) {}
  resolve(): Promise<PinPolicy> {
    return Promise.resolve(this.policy);
  }
}

const fixedClock = (iso: string) => (): Date => new Date(iso);

function build(nowIso = '2026-08-15T08:00:00.000Z', policy?: PinPolicy) {
  const store = new MemoryLocalStore(APP_STATE_SCHEMA);
  const hasher = new Pbkdf2PinHasher();
  const pol = new StubPinPolicy(policy);
  const clock = fixedClock(nowIso);
  const credentials = new LocalOperationalCredentialStore(store, hasher, pol, clock);
  const lockouts = new LocalPinLockoutStore(store, clock);
  return { store, credentials, lockouts, pol, clock };
}

const permissive: LocalAuthorizationSource = {
  forEmployee: () =>
    Promise.resolve({
      permissions: ['session.open', 'task.review'],
      profileId: null,
      membershipId: null,
    }),
};

describe('LocalOperationalCredentialStore', () => {
  it('1. cria credencial local sem armazenar o PIN em texto puro', async () => {
    const { credentials } = build();
    const record = await credentials.upsert({
      storeId: STORE,
      employeeId: EMP,
      pin: '4826',
      status: 'LOCAL_PENDING_PROVISIONING',
    });
    expect(record.status).toBe('LOCAL_PENDING_PROVISIONING');
    expect(record.verifier.length).toBeGreaterThan(0);
    // o PIN NUNCA aparece no registro serializado
    expect(JSON.stringify(record).includes('4826')).toBe(false);
    expect('pin' in record).toBe(false);
  });

  it('2. PIN correto verifica; 3. PIN errado falha; ausente é distinto', async () => {
    const { credentials } = build();
    await credentials.upsert({
      storeId: STORE,
      employeeId: EMP,
      pin: '4826',
      status: 'LOCAL_PENDING_PROVISIONING',
    });
    expect((await credentials.verify(STORE, EMP, '4826')).kind).toBe('valid');
    expect((await credentials.verify(STORE, EMP, '0000')).kind).toBe('invalid');
    expect((await credentials.verify(STORE, 'emp-nao-existe', '4826')).kind).toBe('absent');
  });
});

describe('LocalPinLockoutStore', () => {
  it('4. lockout progressivo usa exclusivamente a política do Baseline', async () => {
    const { lockouts } = build();
    // abaixo de maxAttempts (3): sem bloqueio
    let s = await lockouts.registerFailure(STORE, EMP, DEVICE, TEST_POLICY);
    s = await lockouts.registerFailure(STORE, EMP, DEVICE, TEST_POLICY);
    expect(s.lockedUntil).toBeNull();
    // 3ª falha: primeiro degrau (1000ms)
    s = await lockouts.registerFailure(STORE, EMP, DEVICE, TEST_POLICY);
    expect(s.lockedUntil).not.toBeNull();
    const first = new Date(s.lockedUntil!).getTime();
    // 4ª falha: segundo degrau (5000ms) — janela maior
    s = await lockouts.registerFailure(STORE, EMP, DEVICE, TEST_POLICY);
    const second = new Date(s.lockedUntil!).getTime();
    expect(second).toBeGreaterThan(first);
    expect(s.consecutiveFailures).toBe(4);
    // reset zera a janela mas preserva o total (base do hard reauth)
    await lockouts.reset(STORE, EMP, DEVICE);
    const after = await lockouts.get(STORE, EMP, DEVICE);
    expect(after?.consecutiveFailures).toBe(0);
    expect(after?.lockedUntil).toBeNull();
    expect(after?.totalFailures).toBe(4);
  });
});

describe('LocalCredentialIdentity (orquestração offline)', () => {
  async function seeded(nowIso: string, createdIso: string) {
    const ctx = build(nowIso);
    // credencial "criada" em createdIso (âncora da janela offline)
    const seedCtx = build(createdIso);
    await seedCtx.credentials.upsert({
      storeId: STORE,
      employeeId: EMP,
      pin: '4826',
      status: 'LOCAL_PENDING_PROVISIONING',
    });
    // reusa o MESMO store para enxergar a credencial semeada
    const identity = new LocalCredentialIdentity(
      new LocalOperationalCredentialStore(seedCtx.store, new Pbkdf2PinHasher(), ctx.pol, ctx.clock),
      new LocalPinLockoutStore(seedCtx.store, ctx.clock),
      ctx.pol,
      ctx.clock,
      permissive,
    );
    return { identity, store: seedCtx.store };
  }

  it('6. janela offline válida ⇒ verified; 8. profileId null; 9. employeeId autoria', async () => {
    const { identity } = await seeded('2026-08-16T08:00:00.000Z', '2026-08-15T08:00:00.000Z');
    const result = await identity.verify({
      storeId: STORE,
      employeeId: EMP,
      pin: '4826',
      deviceId: DEVICE,
    });
    expect(result.kind).toBe('verified');
    if (result.kind !== 'verified') throw new Error('esperava verified');
    expect(result.authorization.operatorProfileId).toBeNull();
    expect(result.authorization.membershipId).toBeNull();
    expect(result.authorization.operatorEmployeeId).toBe(EMP);
    expect(result.authorization.origin).toBe('offline-snapshot');
    // sessionId é identidade PRÓPRIA, nunca platform:<profileId>
    expect(result.authorization.sessionId.startsWith('platform:')).toBe(false);
  });

  it('7. janela offline expirada ⇒ rejected OFFLINE_WINDOW_EXPIRED', async () => {
    // criada > offlineValidityMs (72h) antes de agora
    const { identity } = await seeded('2026-08-20T08:00:00.000Z', '2026-08-15T08:00:00.000Z');
    const result = await identity.verify({
      storeId: STORE,
      employeeId: EMP,
      pin: '4826',
      deviceId: DEVICE,
    });
    expect(result).toEqual({ kind: 'rejected', code: 'OFFLINE_WINDOW_EXPIRED' });
  });

  it('PIN errado registra falha; verifier/hash NÃO vazam na autorização', async () => {
    const { identity } = await seeded('2026-08-15T09:00:00.000Z', '2026-08-15T08:00:00.000Z');
    const bad = await identity.verify({
      storeId: STORE,
      employeeId: EMP,
      pin: '0000',
      deviceId: DEVICE,
    });
    expect(bad.kind).toBe('rejected');
    const ok = await identity.verify({
      storeId: STORE,
      employeeId: EMP,
      pin: '4826',
      deviceId: DEVICE,
    });
    if (ok.kind !== 'verified') throw new Error('esperava verified');
    const serialized = JSON.stringify(ok.authorization);
    expect(serialized.includes('4826')).toBe(false);
    expect(/verifier|salt|pin_hash/i.test(serialized)).toBe(false);
  });
});

describe('FixtureOperatorIdentity (DEV) — mesmo OperatorIdentityPort', () => {
  function fixtureDeps() {
    const { lockouts, pol } = build();
    return {
      now: fixedClock('2026-08-15T08:00:00.000Z'),
      offlineValidityMs: () => Promise.resolve(259_200_000),
      online: () => Promise.resolve(true),
      lockouts,
      policy: pol,
    };
  }

  it('10. verifica PIN da fixture e devolve autorização; PIN errado rejeita', async () => {
    const identity = new FixtureOperatorIdentity(fixtureDeps());
    // Elber (emp-0004) tem PIN DEV de 6 dígitos (= comprimento do Baseline)
    const ok = await identity.verify({
      storeId: STORE,
      employeeId: 'emp-0004',
      pin: '123456',
      deviceId: DEVICE,
    });
    expect(ok.kind).toBe('verified');
    if (ok.kind !== 'verified') throw new Error('esperava verified');
    expect(ok.authorization.operatorEmployeeId).toBe('emp-0004');
    const bad = await identity.verify({
      storeId: STORE,
      employeeId: 'emp-0004',
      pin: '999999',
      deviceId: DEVICE,
    });
    expect(bad).toMatchObject({ kind: 'rejected', code: 'INVALID_PIN' });
  });

  it('10b. REGRESSÃO: identidade DEV sofre a MESMA escada de lockout do adapter real', async () => {
    const identity = new FixtureOperatorIdentity(fixtureDeps());
    // TEST_POLICY: maxAttempts pequenos — erra até travar
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await identity.verify({
        storeId: STORE,
        employeeId: 'emp-0004',
        pin: '000000',
        deviceId: DEVICE,
      });
    }
    // com lockout ativo, até o PIN CORRETO é rejeitado (força bruta inviável)
    const locked = await identity.verify({
      storeId: STORE,
      employeeId: 'emp-0004',
      pin: '123456',
      deviceId: DEVICE,
    });
    expect(locked).toMatchObject({ kind: 'rejected', code: 'LOCKED_OUT' });
  });
});

describe('Segurança — credencial fora de snapshot/fila', () => {
  it('11. captureSnapshot REJEITA material de credencial (verifier/salt/pin)', () => {
    const clock = fixedClock('2026-08-15T08:00:00.000Z');
    // um snapshot legítimo (só contexto de autorização) é aceito
    const ok = captureSnapshot(
      {
        operatorProfileId: null,
        operatorEmployeeId: EMP,
        storeId: STORE,
        sessionId: `local-identity:${STORE}:${EMP}:${DEVICE}`,
        permissions: ['session.open'],
        authOrigin: 'offline-pin',
      },
      1000,
      clock,
    );
    expect('verifier' in ok).toBe(false);
    expect('pin' in ok).toBe(false);
    // qualquer tentativa de embutir credencial é bloqueada por contrato
    expect(() =>
      captureSnapshot(
        {
          operatorProfileId: null,
          operatorEmployeeId: EMP,
          storeId: STORE,
          sessionId: 's',
          permissions: [],
          authOrigin: 'offline-pin',
          // @ts-expect-error campo proibido — o teste prova a rejeição
          verifier: 'AAAA',
        },
        1000,
        clock,
      ),
    ).toThrow(SnapshotSecurityError);
  });

  it('12. credencial vive em store DEDICADO, nunca na fila operacional genérica', async () => {
    // o entity id da credencial é próprio e distinto das entidades de fila
    expect(ENTITY_OPERATIONAL_CREDENTIAL).toBe('operational_credentials');
    const { credentials, store } = build();
    await credentials.upsert({
      storeId: STORE,
      employeeId: EMP,
      pin: '4826',
      status: 'LOCAL_PENDING_PROVISIONING',
    });
    // a credencial só é recuperável pelo seu store dedicado
    const rows = await store.transaction(['operational_credentials'], 'read', (tx) =>
      tx.getAll('operational_credentials'),
    );
    expect(rows).toHaveLength(1);
    // e o provisionamento é uma FRONTEIRA separada, não a fila
    const provisioning = new NullCredentialProvisioning();
    expect(await provisioning.provision(STORE, EMP)).toEqual({ kind: 'unavailable' });
  });
});

describe('ConfigPinPolicy — valores vêm do Configuration Engine', () => {
  it('resolve as 7 chaves auth.pin.* do Baseline (sem número hardcoded)', async () => {
    const { ConfigResolver } = await import('@tauros/config-engine');
    const resolver = new ConfigResolver(
      { loadStoreOverrides: () => Promise.resolve([]) },
      () => new Date(),
    );
    const policy = await new ConfigPinPolicy(resolver).resolve(STORE);
    expect(policy.length).toBe(6); // default do Baseline
    expect(policy.hashAlgo).toBe('argon2id');
    expect(policy.maxAttempts).toBe(5);
    expect(policy.lockoutStepsMs.length).toBeGreaterThan(0);
    expect(policy.hardReauthAfter).toBe(10);
  });
});
