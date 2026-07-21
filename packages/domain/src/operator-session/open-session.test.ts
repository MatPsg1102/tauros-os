// Testes de domínio (7.1 §34) — determinísticos, sem relógio real.

import { describe, expect, it } from 'vitest';

import {
  decideOpenSession,
  type ActiveSessionView,
  type OpenSessionCommand,
} from './open-session.js';

const FIXED_NOW = new Date('2026-07-21T09:30:00.000Z');

function command(overrides: Partial<OpenSessionCommand> = {}): OpenSessionCommand {
  return {
    sessionId: 'sess-0001',
    storeId: 'store-01',
    membershipId: 'memb-01',
    actorProfileId: 'prof-01',
    actorEmployeeId: 'emp-01',
    deviceId: 'device-01',
    clientOpenedAt: FIXED_NOW,
    operationalDate: '2026-07-21',
    openedOffline: false,
    idempotencyKey: 'open:store-01:emp-01:2026-07-21',
    ...overrides,
  };
}

const active: ActiveSessionView = {
  id: 'sess-prev',
  storeId: 'store-01',
  actorEmployeeId: 'emp-01',
  idempotencyKey: 'open:store-01:emp-01:2026-07-21',
  status: 'ACTIVE',
};

describe('decideOpenSession', () => {
  it('abre sessão válida com dados do comando (ator/loja/clock injetados)', () => {
    const decision = decideOpenSession(command(), null);
    expect(decision.kind).toBe('open');
    if (decision.kind === 'open') {
      expect(decision.session.id).toBe('sess-0001');
      expect(decision.session.status).toBe('ACTIVE');
      expect(decision.session.clientOpenedAt).toBe(FIXED_NOW);
      expect(decision.session.operationalDate).toBe('2026-07-21');
    }
  });

  it('IDEMPOTENTE: mesma idempotencyKey com sessão ativa ⇒ already-open', () => {
    const decision = decideOpenSession(command(), active);
    expect(decision).toEqual({ kind: 'already-open', sessionId: 'sess-prev' });
  });

  it('INVARIANTE: sessão ativa com outra chave ⇒ SESSION_ALREADY_ACTIVE', () => {
    const decision = decideOpenSession(
      command({ idempotencyKey: 'open:store-01:emp-01:outra' }),
      active,
    );
    expect(decision.kind).toBe('rejected');
    if (decision.kind === 'rejected') expect(decision.code).toBe('SESSION_ALREADY_ACTIVE');
  });

  it('campos obrigatórios vazios ⇒ INVALID_COMMAND (nada persiste)', () => {
    for (const field of ['sessionId', 'storeId', 'actorEmployeeId', 'deviceId'] as const) {
      const decision = decideOpenSession(command({ [field]: '  ' }), null);
      expect(decision.kind).toBe('rejected');
      if (decision.kind === 'rejected') expect(decision.code).toBe('INVALID_COMMAND');
    }
  });

  it('data operacional fora do canônico YYYY-MM-DD ⇒ rejeição orientada', () => {
    const decision = decideOpenSession(command({ operationalDate: '21/07/2026' }), null);
    expect(decision.kind).toBe('rejected');
    if (decision.kind === 'rejected') expect(decision.code).toBe('INVALID_OPERATIONAL_DATE');
  });

  it('clientOpenedAt inválido ⇒ rejeição (clock é responsabilidade externa)', () => {
    const decision = decideOpenSession(command({ clientOpenedAt: new Date('lixo') }), null);
    expect(decision.kind).toBe('rejected');
  });

  it('decisão OPEN é serializável de forma estável (JSON round-trip)', () => {
    const decision = decideOpenSession(command(), null);
    const roundTrip = JSON.parse(JSON.stringify(decision));
    expect(roundTrip.session.idempotencyKey).toBe('open:store-01:emp-01:2026-07-21');
  });
});
