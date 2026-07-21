// Testes do use case de fechamento (7.2) — autorização efetiva, política,
// ordem de efeitos e recuperação. Sem relógio real, sem infraestrutura.

import { describe, expect, it } from 'vitest';

import type {
  EffectiveAuthorization,
  OperatorSessionRecord,
  SessionAuditInput,
  SessionCloseEnqueueInput,
} from '@tauros/contracts';
import { CAPABILITY_SESSION_CLOSE, PERMISSION_MODEL_VERSION } from '@tauros/contracts';

import { CloseOperatorSessionUseCase, closeIdempotencyKeyFor } from './close-operator-session.js';

const NOW = new Date('2026-07-21T19:30:00.000Z');

function authorization(overrides: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-1',
    operatorEmployeeId: 'emp-1',
    storeId: 'store-1',
    sessionId: 'platform:prof-1',
    permissions: [CAPABILITY_SESSION_CLOSE],
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: undefined,
    validUntil: new Date(NOW.getTime() + 3_600_000),
    origin: 'online',
    ...overrides,
  };
}

function activeRecord(overrides: Partial<OperatorSessionRecord> = {}): OperatorSessionRecord {
  return {
    id: 'sess-1',
    storeId: 'store-1',
    membershipId: 'memb-1',
    actorProfileId: 'prof-1',
    actorEmployeeId: 'emp-1',
    deviceId: 'device-1',
    clientOpenedAt: '2026-07-21T10:30:00.000Z',
    openedOffline: false,
    status: 'ACTIVE',
    operationalDate: '2026-07-21',
    authorizationValidUntil: new Date(NOW.getTime() + 3_600_000).toISOString(),
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: 'cfg-v1',
    idempotencyKey: 'session-open:store-1:emp-1:2026-07-21:device-1',
    syncStatus: 'synced',
    auditCorrelationId: 'sess-1',
    clientClosedAt: null,
    closedOffline: false,
    endReason: null,
    closeIdempotencyKey: null,
    closeSyncStatus: null,
    ...overrides,
  };
}

interface Harness {
  useCase: CloseOperatorSessionUseCase;
  saved: OperatorSessionRecord[];
  enqueued: SessionCloseEnqueueInput[];
  audits: SessionAuditInput[];
  stored: OperatorSessionRecord | null;
  failEnqueue: boolean;
  failSave: boolean;
  failPolicy: boolean;
}

function makeHarness(): Harness {
  const harness: Harness = {
    saved: [],
    enqueued: [],
    audits: [],
    stored: activeRecord(),
    failEnqueue: false,
    failSave: false,
    failPolicy: false,
    useCase: undefined as unknown as CloseOperatorSessionUseCase,
  };
  let idCounter = 0;
  harness.useCase = new CloseOperatorSessionUseCase(
    { now: () => NOW },
    { uuid: () => `uuid-${String(++idCounter).padStart(2, '0')}` },
    {
      sessionOpeningPolicy: () =>
        Promise.resolve({
          sessionAbsoluteMaxMs: 43_200_000,
          pinOfflineValidityMs: 86_400_000,
          configVersionRef: 'cfg-v1',
        }),
      sessionClosingPolicy: () => {
        if (harness.failPolicy) return Promise.reject(new Error('config source down'));
        return Promise.resolve({
          sessionAbsoluteMaxMs: 43_200_000,
          reauthOnAbsolute: true,
          configVersionRef: 'cfg-v1',
        });
      },
    },
    {
      findActive: () => Promise.resolve(harness.stored),
      byId: () => Promise.resolve(harness.stored),
      save: (record) => {
        if (harness.failSave) return Promise.reject(new Error('disk full'));
        harness.saved.push(record);
        harness.stored = record;
        return Promise.resolve();
      },
      updateSyncStatus: () => Promise.resolve(),
    },
    {
      enqueueOpenSession: () => Promise.resolve(),
      enqueueCloseSession: (input) => {
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

const input = {
  sessionId: 'sess-1',
  deviceId: 'device-1',
  storeTimeZone: 'America/Sao_Paulo',
  closedOffline: false,
  endReason: 'LOGOUT' as const,
};

describe('CloseOperatorSessionUseCase — caminho autorizado', () => {
  it('fecha o turno, enfileira e audita auth.session.ended', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });

    expect(result.kind).toBe('closed');
    if (result.kind !== 'closed') return;
    expect(result.record.status).toBe('CLOSED_LOCAL');
    expect(result.record.endReason).toBe('LOGOUT');
    expect(result.record.clientClosedAt).toBe(NOW.toISOString());
    expect(result.record.closeSyncStatus).toBe('queued');
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.saved).toHaveLength(1);
    expect(harness.audits.at(-1)?.eventType).toBe('auth.session.ended');
    expect(harness.audits.at(-1)?.operation).toBe('close');
  });

  it('preserva os dados da abertura ao fechar', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    if (result.kind !== 'closed') throw new Error('esperava closed');
    expect(result.record.clientOpenedAt).toBe('2026-07-21T10:30:00.000Z');
    expect(result.record.idempotencyKey).toBe('session-open:store-1:emp-1:2026-07-21:device-1');
  });

  it('usa chave de idempotência determinística (sem timestamp)', async () => {
    const harness = makeHarness();
    await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(harness.enqueued[0]?.idempotencyKey).toBe(
      closeIdempotencyKeyFor('store-1', 'sess-1', 'device-1'),
    );
    expect(harness.enqueued[0]?.idempotencyKey).toBe('session-close:store-1:sess-1:device-1');
  });

  it('fecha offline marcando a origem', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ origin: 'offline-snapshot' }),
      ...input,
      closedOffline: true,
    });
    if (result.kind !== 'closed') throw new Error('esperava closed');
    expect(result.record.closedOffline).toBe(true);
    expect(harness.audits.at(-1)?.source).toBe('client-offline');
  });
});

describe('CloseOperatorSessionUseCase — autorização (ADR-018)', () => {
  it('nega sem a capability e audita access.denied', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ permissions: ['session.open'] }),
      ...input,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(harness.audits.at(-1)?.eventType).toBe('access.denied');
    expect(harness.enqueued).toHaveLength(0);
    expect(harness.saved).toHaveLength(0);
  });

  it('rejeita snapshot expirado', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ validUntil: new Date(NOW.getTime() - 1) }),
      ...input,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_EXPIRED' });
    expect(harness.enqueued).toHaveLength(0);
  });

  it('rejeita versão de modelo de permissão incompatível', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ permissionModelVersion: PERMISSION_MODEL_VERSION + 1 }),
      ...input,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_VERSION_INCOMPATIBLE' });
  });

  it('rejeita turno de outra loja', async () => {
    const harness = makeHarness();
    harness.stored = activeRecord({ storeId: 'store-9' });
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(result).toMatchObject({ kind: 'failed', code: 'STORE_MISMATCH' });
  });
});

describe('CloseOperatorSessionUseCase — configuração e estado', () => {
  it('falha explicitamente quando a configuração está indisponível', async () => {
    const harness = makeHarness();
    harness.failPolicy = true;
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(result).toMatchObject({ kind: 'failed', code: 'CONFIG_UNAVAILABLE' });
    expect(harness.enqueued).toHaveLength(0);
  });

  it('falha quando não há turno local', async () => {
    const harness = makeHarness();
    harness.stored = null;
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(result).toMatchObject({ kind: 'failed', code: 'SESSION_NOT_FOUND' });
  });

  it('replay do mesmo fechamento não duplica (idempotência)', async () => {
    const harness = makeHarness();
    const first = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(first.kind).toBe('closed');
    const second = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(second.kind).toBe('already-closed');
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.saved).toHaveLength(1);
  });

  it('recusa fechar um turno fechado por outra operação', async () => {
    const harness = makeHarness();
    harness.stored = activeRecord({
      status: 'CLOSED_CONFIRMED',
      closeIdempotencyKey: 'session-close:store-1:sess-1:outro-aparelho',
    });
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(result).toMatchObject({ kind: 'failed', code: 'SESSION_NOT_ACTIVE' });
  });
});

describe('CloseOperatorSessionUseCase — falhas intermediárias e recuperação', () => {
  it('falha de fila não persiste nada e audita a falha', async () => {
    const harness = makeHarness();
    harness.failEnqueue = true;
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(result).toMatchObject({ kind: 'failed', code: 'ENQUEUE_FAILED' });
    expect(harness.saved).toHaveLength(0);
    expect(harness.audits.at(-1)?.result).toBe('failure');
  });

  it('falha de persistência mantém a intenção durável enfileirada (recuperável)', async () => {
    const harness = makeHarness();
    harness.failSave = true;
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERSISTENCE_FAILED' });
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.enqueued[0]?.payload.sessionId).toBe('sess-1');
  });
});
