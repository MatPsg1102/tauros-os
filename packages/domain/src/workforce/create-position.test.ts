// Testes do domínio de criação de posição operacional — invariantes puras.

import { describe, expect, it } from 'vitest';

import { decideCreatePosition, type CreatePositionCommand } from './create-position.js';

const NOW = new Date('2026-08-13T14:00:00.000Z');

const command: CreatePositionCommand = {
  positionId: 'pos-1',
  storeId: 'store-1',
  name: 'Balconista',
  key: 'balconista',
  clientCreatedAt: NOW,
  idempotencyKey: 'position-create:store-1:balconista',
};

describe('decideCreatePosition', () => {
  it('cria posição com nome normalizado e chave estável', () => {
    const decision = decideCreatePosition({ ...command, name: '  Balconista ' }, null);
    expect(decision.kind).toBe('create');
    if (decision.kind !== 'create') return;
    expect(decision.position).toMatchObject({ name: 'Balconista', key: 'balconista' });
  });

  it('rejeita nome vazio ou sem caractere aproveitável', () => {
    expect(decideCreatePosition({ ...command, name: '   ' }, null)).toMatchObject({
      kind: 'rejected',
      code: 'NAME_REQUIRED',
    });
    expect(decideCreatePosition({ ...command, name: '###', key: '' }, null)).toMatchObject({
      kind: 'rejected',
      code: 'NAME_REQUIRED',
    });
  });

  it('mesma chave natural na loja converge para a MESMA posição', () => {
    expect(decideCreatePosition(command, 'pos-existente')).toEqual({
      kind: 'already-created',
      positionId: 'pos-existente',
    });
  });
});
