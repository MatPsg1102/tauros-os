import { describe, expect, it } from 'vitest';

import { constantTimeEquals, PIN_HASH_ALGORITHM, Pbkdf2PinHasher } from './pin-hasher.js';

// Iterações reduzidas no teste (a política real vem do Baseline em produção):
// o objetivo é provar a MECÂNICA do KDF, não medir custo.
const ITER = 1000;

describe('Pbkdf2PinHasher', () => {
  it('deriva verifier determinístico para o mesmo PIN+salt+iterações', async () => {
    const hasher = new Pbkdf2PinHasher();
    const salt = hasher.generateSalt();
    const a = await hasher.derive('1234', salt, ITER);
    const b = await hasher.derive('1234', salt, ITER);
    expect(a).toBe(b);
    expect(hasher.algorithm).toBe(PIN_HASH_ALGORITHM);
  });

  it('PIN correto verifica; PIN errado falha', async () => {
    const hasher = new Pbkdf2PinHasher();
    const salt = hasher.generateSalt();
    const stored = await hasher.derive('4826', salt, ITER);
    expect(hasher.matches(await hasher.derive('4826', salt, ITER), stored)).toBe(true);
    expect(hasher.matches(await hasher.derive('4827', salt, ITER), stored)).toBe(false);
  });

  it('salts diferentes produzem verifiers diferentes para o mesmo PIN', async () => {
    const hasher = new Pbkdf2PinHasher();
    const s1 = hasher.generateSalt();
    const s2 = hasher.generateSalt();
    expect(s1).not.toBe(s2);
    expect(await hasher.derive('0000', s1, ITER)).not.toBe(await hasher.derive('0000', s2, ITER));
  });

  it('o PIN em claro nunca aparece no verifier derivado', async () => {
    const hasher = new Pbkdf2PinHasher();
    const salt = hasher.generateSalt();
    const verifier = await hasher.derive('9753', salt, ITER);
    expect(verifier.includes('9753')).toBe(false);
  });

  it('constantTimeEquals: iguais true, diferentes/comprimentos distintos false', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
    expect(constantTimeEquals('abc', 'ab')).toBe(false);
  });
});
