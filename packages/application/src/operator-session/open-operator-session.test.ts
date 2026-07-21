// Testes da camada de aplicação (7.1 §35) — fakes de ports, clock/id fixos.

import { beforeEach, describe, expect, it } from 'vitest';

import type {
  EffectiveAuthorization,
  OperatorSessionRecord,
  SessionAuditInput,
  SessionEnqueueInput,
  SessionOpeningPolicy,
} from '@tauros/contracts';

import { OpenOperatorSessionUseCase, operationalDateFor } from './open-operator-session.js';

const NOW = new Date('2026-07-21T23:30:00.000Z'); // 20:30 em São Paulo
const TZ = 'America/Sao_Paulo';

function auth(overrides: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-01',
    operatorEmployeeId: 'emp-01',
    storeId: 'store-01',
    sessionId: 'platform-sess-01',
    permissions: ['session.open'],
    permissionModelVersion: 1,
    configVersionRef: 'cfg-v1',
    validUntil: new Date('2026-07-22T23:30:00.000Z'),
    origin: 'online',
    ...overrides,
  };
}

interface Harness {
  useCase: OpenOperatorSessionUseCase;
  saved: OperatorSessionRecord[];
  enqueued: SessionEnqueueInput[];
  audits: SessionAuditInput[];
  activeSession: OperatorSessionRecord | null;
  failEnqueue: boolean;
  failSave: boolean;
  failPolicy: boolean;
}

function makeHarness(): Harness {
  const harness: Harness = {
    saved: [],
    enqueued: [],
    audits: [],
    activeSession: null,
    failEnqueue: false,
    failSave: false,
    failPolicy: false,
    useCase: undefined as unknown as OpenOperatorSessionUseCase,
  };
  let idCounter = 0;
  const policy: SessionOpeningPolicy = {
    sessionAbsoluteMaxMs: 43_200_000,
    pinOfflineValidityMs: 86_400_000,
    configVersionRef: 'cfg-v1',
  };
  harness.useCase = new OpenOperatorSessionUseCase(
    { now: () => NOW },
    { uuid: () => `uuid-${String(++idCounter).padStart(2, '0')}` },
    {
      sessionOpeningPolicy: () => {
        if (harness.failPolicy) return Promise.reject(new Error('config source down'));
        return Promise.resolve(policy);
      },
    },
    {
      findActive: () => Promise.resolve(harness.activeSession),
      save: (record) => {
        if (harness.failSave) return Promise.reject(new Error('disk full'));
        harness.saved.push(record);
        return Promise.resolve();
      },
      updateSyncStatus: () => Promise.resolve(),
    },
    {
      enqueueOpenSession: (input) => {
        if (harness.failEnqueue) return Promise.reject(new Error('queue down'));
        harness.enqueued.push(input);
        return Promise.resolve();
      },
    },
    {
      record: (input) => {
        harness.audits.push(input);
        return Promise.resolve();
      },
    },
  );
  return harness;
}

const baseInput = {
  membershipId: 'memb-01',
  deviceId: 'device-01',
  storeTimeZone: TZ,
  openedOffline: false,
};

let h: Harness;
beforeEach(() => {
  h = makeHarness();
});

describe('operationalDateFor', () => {
  it('perto da meia-noite: 23:30Z de 21/07 ainda é 21/07 em São Paulo', () => {
    expect(operationalDateFor(NOW, TZ)).toBe('2026-07-21');
  });
  it('depois da meia-noite local vira o dia seguinte', () => {
    expect(operationalDateFor(new Date('2026-07-22T03:10:00.000Z'), TZ)).toBe('2026-07-22');
  });
  it('fuso é da LOJA, não do dispositivo (UTC difere)', () => {
    expect(operationalDateFor(new Date('2026-07-22T01:00:00.000Z'), TZ)).toBe('2026-07-21');
    expect(operationalDateFor(new Date('2026-07-22T01:00:00.000Z'), 'UTC')).toBe('2026-07-22');
  });
});

describe('OpenOperatorSessionUseCase — autorização (ADR-018)', () => {
  it('ALLOW: capability presente abre e ordena efeitos enqueue→save→audit', async () => {
    const result = await h.useCase.execute({ authorization: auth(), ...baseInput });
    expect(result.kind).toBe('opened');
    expect(h.enqueued).toHaveLength(1);
    expect(h.saved).toHaveLength(1);
    expect(h.audits.map((a) => a.eventType)).toEqual(['auth.login.success']);
    const record = h.saved[0]!;
    expect(record.operationalDate).toBe('2026-07-21');
    expect(record.syncStatus).toBe('queued');
    expect(record.idempotencyKey).toBe('session-open:store-01:emp-01:2026-07-21:device-01');
    // payload da fila carrega o registro completo (recuperação possível)
    expect(h.enqueued[0]!.record).toEqual(record);
  });

  it('DENY: sem capability ⇒ nada persiste/enfileira + auditoria access.denied', async () => {
    const result = await h.useCase.execute({
      authorization: auth({ permissions: ['audit.read'] }),
      ...baseInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(h.enqueued).toHaveLength(0);
    expect(h.saved).toHaveLength(0);
    expect(h.audits.map((a) => a.eventType)).toEqual(['access.denied']);
    expect(h.audits[0]!.result).toBe('rejected');
  });

  it('snapshot expirado ⇒ SNAPSHOT_EXPIRED sem efeitos', async () => {
    const result = await h.useCase.execute({
      authorization: auth({ validUntil: new Date('2026-07-21T23:29:59.000Z') }),
      ...baseInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_EXPIRED' });
    expect(h.enqueued).toHaveLength(0);
  });

  it('permission_model_version incompatível ⇒ falha orientada', async () => {
    const result = await h.useCase.execute({
      authorization: auth({ permissionModelVersion: 2 }),
      ...baseInput,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_VERSION_INCOMPATIBLE' });
  });
});

describe('OpenOperatorSessionUseCase — configuração e domínio', () => {
  it('config indisponível ⇒ CONFIG_UNAVAILABLE sem efeitos', async () => {
    h.failPolicy = true;
    const result = await h.useCase.execute({ authorization: auth(), ...baseInput });
    expect(result).toMatchObject({ kind: 'failed', code: 'CONFIG_UNAVAILABLE' });
    expect(h.enqueued).toHaveLength(0);
  });

  it('sessão ativa de OUTRA abertura ⇒ SESSION_ALREADY_ACTIVE', async () => {
    h.activeSession = {
      id: 'sess-prev',
      storeId: 'store-01',
      actorEmployeeId: 'emp-01',
      idempotencyKey: 'outra-chave',
    } as OperatorSessionRecord;
    const result = await h.useCase.execute({ authorization: auth(), ...baseInput });
    expect(result).toMatchObject({ kind: 'failed', code: 'SESSION_ALREADY_ACTIVE' });
    expect(h.enqueued).toHaveLength(0);
  });

  it('IDEMPOTENTE: mesma chave (duplo clique/replay) ⇒ already-open sem novo efeito', async () => {
    const first = await h.useCase.execute({ authorization: auth(), ...baseInput });
    expect(first.kind).toBe('opened');
    h.activeSession = h.saved[0]!;
    const second = await h.useCase.execute({ authorization: auth(), ...baseInput });
    expect(second.kind).toBe('already-open');
    if (second.kind === 'already-open') expect(second.record.id).toBe(h.saved[0]!.id);
    expect(h.enqueued).toHaveLength(1); // nenhum item novo
    expect(h.saved).toHaveLength(1);
  });
});

describe('OpenOperatorSessionUseCase — falhas de efeito e recuperação', () => {
  it('enqueue falha ⇒ nada salvo + auditoria de falha (estado íntegro)', async () => {
    h.failEnqueue = true;
    const result = await h.useCase.execute({ authorization: auth(), ...baseInput });
    expect(result).toMatchObject({ kind: 'failed', code: 'ENQUEUE_FAILED' });
    expect(h.saved).toHaveLength(0);
    expect(h.audits.map((a) => a.eventType)).toEqual(['auth.login.failure']);
  });

  it('save falha APÓS enqueue ⇒ PERSISTENCE_FAILED com intenção durável mantida', async () => {
    h.failSave = true;
    const result = await h.useCase.execute({ authorization: auth(), ...baseInput });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERSISTENCE_FAILED' });
    expect(h.enqueued).toHaveLength(1); // recuperável no boot (reconcile)
  });

  it('offline: origem client-offline registrada e openedOffline no registro', async () => {
    const result = await h.useCase.execute({
      authorization: auth({ origin: 'offline-snapshot' }),
      ...baseInput,
      openedOffline: true,
    });
    expect(result.kind).toBe('opened');
    expect(h.saved[0]!.openedOffline).toBe(true);
    expect(h.audits[0]!.source).toBe('client-offline');
  });

  it('nenhum PIN/segredo aparece em auditoria (payload mínimo)', async () => {
    await h.useCase.execute({ authorization: auth(), ...baseInput });
    const serialized = JSON.stringify(h.audits);
    expect(serialized).not.toMatch(/pin|senha|token/i);
  });
});
