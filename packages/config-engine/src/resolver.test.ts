import { describe, expect, it, vi } from 'vitest';

import { ConfigResolver, UnknownConfigKeyError } from './resolver.js';
import type { ConfigSourcePort } from './ports.js';
import type { StoreConfigOverride } from './types.js';

const STORE = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-07-20T12:00:00Z');

function sourceWith(overrides: readonly StoreConfigOverride[]): ConfigSourcePort {
  return { loadStoreOverrides: vi.fn().mockResolvedValue(overrides) };
}

function resolverWith(
  overrides: readonly StoreConfigOverride[] = [],
  clock: () => Date = () => NOW,
): { resolver: ConfigResolver; source: ConfigSourcePort } {
  const source = sourceWith(overrides);
  return { resolver: new ConfigResolver(source, clock), source };
}

describe('ConfigResolver', () => {
  it('resolve o default do Baseline quando não há override', async () => {
    const { resolver } = resolverWith();
    await expect(resolver.resolve('sync.retry.maxAttempts', STORE)).resolves.toBe(5);
    await expect(resolver.resolve('session.absoluteMaxMs', STORE)).resolves.toBe(43_200_000);
  });

  it('resolve o default sem storeId (contexto de plataforma)', async () => {
    const { resolver, source } = resolverWith();
    await expect(resolver.resolve('sync.retry.baseDelayMs')).resolves.toBe(30_000);
    expect(source.loadStoreOverrides).not.toHaveBeenCalled();
  });

  it('aplica override de loja vigente (herança global → loja)', async () => {
    const { resolver } = resolverWith([
      {
        key: 'sync.retry.maxAttempts',
        value: 8,
        version: 1,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    await expect(resolver.resolve('sync.retry.maxAttempts', STORE)).resolves.toBe(8);
  });

  it('ignora override fora da vigência (futuro ou expirado)', async () => {
    const { resolver } = resolverWith([
      {
        key: 'session.idleLockMs',
        value: 1,
        version: 1,
        effectiveFrom: new Date('2026-12-01T00:00:00Z'), // futuro (agendado)
      },
      {
        key: 'sync.retry.capMs',
        value: 1,
        version: 1,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        effectiveUntil: new Date('2026-02-01T00:00:00Z'), // expirado
      },
    ]);
    await expect(resolver.resolve('session.idleLockMs', STORE)).resolves.toBe(900_000);
    await expect(resolver.resolve('sync.retry.capMs', STORE)).resolves.toBe(480_000);
  });

  it('entre overrides vigentes, a maior versão vence', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const { resolver } = resolverWith([
      { key: 'sync.retry.factor', value: 3, version: 1, effectiveFrom: from },
      { key: 'sync.retry.factor', value: 4, version: 2, effectiveFrom: from },
    ]);
    await expect(resolver.resolve('sync.retry.factor', STORE)).resolves.toBe(4);
  });

  it('chave global-only nunca sofre override de loja', async () => {
    const { resolver, source } = resolverWith([
      {
        key: 'sync.concurrency.max',
        value: 99,
        version: 1,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    await expect(resolver.resolve('sync.concurrency.max', STORE)).resolves.toBe(3);
    expect(source.loadStoreOverrides).not.toHaveBeenCalled();
  });

  it('cacheia por loja e invalida sob demanda', async () => {
    const { resolver, source } = resolverWith();
    await resolver.resolve('session.idleLockMs', STORE);
    await resolver.resolve('auth.pin.offlineValidityMs', STORE);
    expect(source.loadStoreOverrides).toHaveBeenCalledTimes(1);

    resolver.invalidate(STORE);
    await resolver.resolve('session.idleLockMs', STORE);
    expect(source.loadStoreOverrides).toHaveBeenCalledTimes(2);
  });

  it('snapshot congela todas as chaves resolvidas', async () => {
    const { resolver } = resolverWith([
      {
        key: 'kpi.snapshot.cron',
        value: '15 * * * *',
        version: 1,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const snap = await resolver.snapshot(STORE);
    expect(snap.storeId).toBe(STORE);
    expect(snap.resolvedAt).toEqual(NOW);
    expect(snap.values['kpi.snapshot.cron']).toBe('15 * * * *');
    expect(snap.values['sync.retry.maxAttempts']).toBe(5);
    expect(Object.isFrozen(snap.values)).toBe(true);
    // 26 = Baseline v1.0 (25) + tasks.dueSoonWindowMs (UI Operacional V1.1)
    expect(Object.keys(snap.values)).toHaveLength(26);
  });

  it('rejeita chave desconhecida com erro orientado (P7)', async () => {
    const { resolver } = resolverWith();
    await expect(
      // Simula chamador JS sem tipagem.
      resolver.resolve('nao.existe' as never, STORE),
    ).rejects.toBeInstanceOf(UnknownConfigKeyError);
  });
});
