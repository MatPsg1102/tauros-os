// Testes de domínio do fechamento (7.2) — determinísticos, sem relógio real.

import { describe, expect, it } from 'vitest';

import {
  decideCloseSession,
  type ClosableSessionView,
  type CloseSessionCommand,
} from './close-session.js';

const FIXED_NOW = new Date('2026-07-21T19:30:00.000Z');

const command: CloseSessionCommand = {
  sessionId: 'sess-1',
  storeId: 'store-1',
  actorEmployeeId: 'emp-1',
  deviceId: 'device-1',
  clientClosedAt: FIXED_NOW,
  operationalDate: '2026-07-21',
  closedOffline: false,
  endReason: 'LOGOUT',
  idempotencyKey: 'session-close:store-1:sess-1:device-1',
};

const active: ClosableSessionView = {
  id: 'sess-1',
  storeId: 'store-1',
  actorEmployeeId: 'emp-1',
  deviceId: 'device-1',
  operationalDate: '2026-07-21',
  status: 'ACTIVE',
  closeIdempotencyKey: null,
};

describe('decideCloseSession', () => {
  it('fecha uma sessão ACTIVE coerente', () => {
    const decision = decideCloseSession(command, active);
    expect(decision.kind).toBe('closed');
    if (decision.kind !== 'closed') return;
    expect(decision.session.status).toBe('CLOSED_LOCAL');
    expect(decision.session.endReason).toBe('LOGOUT');
    expect(decision.session.clientClosedAt).toBe(FIXED_NOW);
    expect(decision.session.idempotencyKey).toBe(command.idempotencyKey);
  });

  it('rejeita quando não existe sessão local', () => {
    const decision = decideCloseSession(command, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'SESSION_NOT_FOUND' });
  });

  it('rejeita fechar uma sessão já fechada com outra chave', () => {
    const decision = decideCloseSession(command, {
      ...active,
      status: 'CLOSED_LOCAL',
      closeIdempotencyKey: 'session-close:store-1:sess-1:outro-aparelho',
    });
    expect(decision).toMatchObject({ kind: 'rejected', code: 'SESSION_NOT_ACTIVE' });
  });

  it('replay do MESMO fechamento é idempotente, não erro', () => {
    const decision = decideCloseSession(command, {
      ...active,
      status: 'CLOSED_LOCAL',
      closeIdempotencyKey: command.idempotencyKey,
    });
    expect(decision).toEqual({ kind: 'already-closed', sessionId: 'sess-1' });
  });

  it('replay continua idempotente após confirmação do servidor', () => {
    const decision = decideCloseSession(command, {
      ...active,
      status: 'CLOSED_CONFIRMED',
      closeIdempotencyKey: command.idempotencyKey,
    });
    expect(decision).toEqual({ kind: 'already-closed', sessionId: 'sess-1' });
  });

  it('rejeita loja divergente', () => {
    const decision = decideCloseSession(command, { ...active, storeId: 'store-2' });
    expect(decision).toMatchObject({ kind: 'rejected', code: 'STORE_MISMATCH' });
  });

  it('rejeita funcionário divergente', () => {
    const decision = decideCloseSession(command, { ...active, actorEmployeeId: 'emp-9' });
    expect(decision).toMatchObject({ kind: 'rejected', code: 'OPERATOR_MISMATCH' });
  });

  it('rejeita data operacional divergente da abertura', () => {
    const decision = decideCloseSession(command, { ...active, operationalDate: '2026-07-20' });
    expect(decision).toMatchObject({ kind: 'rejected', code: 'OPERATIONAL_DATE_MISMATCH' });
  });

  it('rejeita sessão informada diferente da persistida', () => {
    const decision = decideCloseSession(command, { ...active, id: 'sess-outra' });
    expect(decision).toMatchObject({ kind: 'rejected', code: 'SESSION_NOT_FOUND' });
  });

  it('rejeita comando incompleto', () => {
    const decision = decideCloseSession({ ...command, deviceId: '  ' }, active);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_COMMAND' });
  });

  it('rejeita data operacional fora do formato civil', () => {
    const decision = decideCloseSession({ ...command, operationalDate: '21/07/2026' }, active);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_COMMAND' });
  });

  it('rejeita horário inválido', () => {
    const decision = decideCloseSession(
      { ...command, clientClosedAt: new Date('não é data') },
      active,
    );
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_COMMAND' });
  });

  it('é determinística: mesma entrada, mesma decisão', () => {
    expect(decideCloseSession(command, active)).toEqual(decideCloseSession(command, active));
  });
});
