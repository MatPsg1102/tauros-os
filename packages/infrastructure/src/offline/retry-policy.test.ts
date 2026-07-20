import { describe, expect, it, vi } from 'vitest';

import { ConfigResolver } from '@tauros/config-engine';

import { RetryPolicy } from './retry-policy.js';
import { STORE_ID } from './test-helpers.js';

function policyWith(random: () => number): RetryPolicy {
  const config = new ConfigResolver({ loadStoreOverrides: () => Promise.resolve([]) });
  return new RetryPolicy(config, random);
}

describe('RetryPolicy (Baseline §1 via Configuration Engine)', () => {
  it('classifica transitório vs permanente', () => {
    const policy = policyWith(() => 0.5);
    expect(policy.isTransient('RECOVERABLE')).toBe(true);
    expect(policy.isTransient('AUTH_RETRYABLE')).toBe(true);
    expect(policy.isTransient('PERMANENT')).toBe(false);
    expect(policy.isTransient('CONFLICT')).toBe(false);
    expect(policy.isTransient('AUTHORSHIP_REVIEW')).toBe(false);
  });

  it('nunca reagenda erro permanente/conflito', async () => {
    const policy = policyWith(() => 0.5);
    await expect(policy.decide(1, 'PERMANENT', STORE_ID)).resolves.toEqual({
      retry: false,
      delayMs: 0,
    });
    await expect(policy.decide(1, 'CONFLICT', STORE_ID)).resolves.toEqual({
      retry: false,
      delayMs: 0,
    });
  });

  it('respeita o limite de tentativas do Baseline (5)', async () => {
    const policy = policyWith(() => 0.5);
    await expect(policy.decide(4, 'RECOVERABLE', STORE_ID)).resolves.toMatchObject({
      retry: true,
    });
    await expect(policy.decide(5, 'RECOVERABLE', STORE_ID)).resolves.toEqual({
      retry: false,
      delayMs: 0,
    });
  });

  it('backoff exponencial com equal jitter dentro dos limites do Baseline', async () => {
    // comp = min(cap, base·2^(n−1))/2; delay ∈ [comp, 2·comp].
    const low = policyWith(() => 0);
    const high = policyWith(() => 1);

    // tentativa 1: base 30s → comp 15s → [15s, 30s]
    await expect(low.decide(1, 'RECOVERABLE', STORE_ID)).resolves.toEqual({
      retry: true,
      delayMs: 15_000,
    });
    await expect(high.decide(1, 'RECOVERABLE', STORE_ID)).resolves.toEqual({
      retry: true,
      delayMs: 30_000,
    });

    // tentativa 4: 30s·2^3 = 240s → comp 120s → [120s, 240s]
    await expect(low.decide(4, 'RECOVERABLE', STORE_ID)).resolves.toEqual({
      retry: true,
      delayMs: 120_000,
    });

    // teto: tentativa 5 → min(480s, 480s) → comp 240s → máx 480s
    await expect(high.decide(4, 'RECOVERABLE', STORE_ID)).resolves.toEqual({
      retry: true,
      delayMs: 240_000,
    });
  });

  it('honra Retry-After quando configurado (429)', async () => {
    const policy = policyWith(() => 0.5);
    await expect(policy.decide(1, 'RECOVERABLE', STORE_ID, 7_000)).resolves.toEqual({
      retry: true,
      delayMs: 7_000,
    });
  });

  it('invalida o cache de configuração no evento de mudança', () => {
    const config = new ConfigResolver({ loadStoreOverrides: () => Promise.resolve([]) });
    const spy = vi.spyOn(config, 'invalidate');
    const policy = new RetryPolicy(config, () => 0.5);
    policy.onConfigurationChanged(STORE_ID);
    expect(spy).toHaveBeenCalledWith(STORE_ID);
  });
});
