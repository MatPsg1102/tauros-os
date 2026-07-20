import { describe, expect, it } from 'vitest';

import { CycleDetectedError } from './dag.js';
import { CapturingEventEmitter } from './events.js';
import { MemoryLocalStore } from './memory-store.js';
import { LocalQueueRepository, OFFLINE_SCHEMA, SafeCleanupError } from './queue-repository.js';
import { makeClock, makeNewItem, makeSnapshot, makeWorld } from './test-helpers.js';

describe('LocalQueueRepository (RA-QUEUE-01 §1/§2/§4)', () => {
  it('enfileira com todos os campos obrigatórios persistidos', async () => {
    const { repo, clock } = makeWorld();
    const snap = makeSnapshot(clock);
    const item = await repo.enqueue(makeNewItem('a', snap));

    expect(item.state).toBe('PENDING');
    expect(item.attemptCount).toBe(0);
    expect(item.idempotencyKey).toBe('idem-a');
    expect(item.authorization.sessionId).toBe('session-1');
    expect(item.trace.deviceId).toBe('device-1');

    const loaded = await repo.get('a');
    expect(loaded).toBeDefined();
    expect(loaded!.createdAt).toBeInstanceOf(Date);
  });

  it('nasce BLOCKED quando há dependência não concluída', async () => {
    const { repo, clock } = makeWorld();
    const snap = makeSnapshot(clock);
    await repo.enqueue(makeNewItem('parent', snap));
    const child = await repo.enqueue(makeNewItem('child', snap, { dependsOn: ['parent'] }));
    expect(child.state).toBe('BLOCKED_BY_DEPENDENCY');
  });

  it('recupera itens após reinício (novo repo sobre o mesmo store)', async () => {
    const clock = makeClock();
    const store = new MemoryLocalStore(OFFLINE_SCHEMA);
    const repoA = new LocalQueueRepository(store, new CapturingEventEmitter(), clock.fn);
    await repoA.enqueue(makeNewItem('persisted', makeSnapshot(clock)));

    // "Reinício": nova instância de repositório sobre a mesma persistência.
    const repoB = new LocalQueueRepository(store, new CapturingEventEmitter(), clock.fn);
    const reloaded = await repoB.get('persisted');
    expect(reloaded?.id).toBe('persisted');
    expect(reloaded?.state).toBe('PENDING');
    expect(reloaded?.authorization.validUntil).toBeInstanceOf(Date);
  });

  it('rejeita ciclo com erro auditável e emite cycle_detected', async () => {
    const { repo, events, clock } = makeWorld();
    const snap = makeSnapshot(clock);
    await repo.enqueue(makeNewItem('x', snap, { dependsOn: ['y'] }));
    await expect(repo.enqueue(makeNewItem('y', snap, { dependsOn: ['x'] }))).rejects.toThrow(
      CycleDetectedError,
    );
    expect(events.events.some((e) => e.type === 'cycle_detected' && e.itemId === 'y')).toBe(true);
    // A fila NÃO travou: outro item entra normalmente.
    await expect(repo.enqueue(makeNewItem('z', snap))).resolves.toMatchObject({ state: 'PENDING' });
  });

  it('lease é atômica: segunda instância não processa o mesmo item', async () => {
    const { repo, clock } = makeWorld();
    await repo.enqueue(makeNewItem('once', makeSnapshot(clock)));
    const first = await repo.claimLease('once', 'proc-A', 60_000);
    const second = await repo.claimLease('once', 'proc-B', 60_000);
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it('reclaim recupera SYNCING com lease expirada (sobrevive a crash)', async () => {
    const { repo, clock } = makeWorld();
    await repo.enqueue(makeNewItem('crashy', makeSnapshot(clock)));
    const leased = await repo.claimLease('crashy', 'proc-A', 1_000);
    await repo.put({ ...leased!, state: 'SYNCING' });

    clock.advance(5_000); // lease venceu; "aplicação reaberta"
    const reclaimed = await repo.reclaimExpiredLeases();
    expect(reclaimed.map((i) => i.id)).toEqual(['crashy']);
    expect((await repo.get('crashy'))!.state).toBe('PENDING');
  });

  it('limpeza segura: remove SYNCED e recusa qualquer outro estado', async () => {
    const { repo, clock } = makeWorld();
    const snap = makeSnapshot(clock);
    const done = await repo.enqueue(makeNewItem('done', snap));
    await repo.put({ ...done, state: 'SYNCED' });
    await repo.enqueue(makeNewItem('pending', snap));

    await expect(repo.removeCompleted(['done'])).resolves.toBe(1);
    expect(await repo.get('done')).toBeUndefined();

    await expect(repo.removeCompleted(['pending'])).rejects.toThrow(SafeCleanupError);
    expect(await repo.get('pending')).toBeDefined();
  });

  it('transação com erro não aplica escritas parciais (atomicidade)', async () => {
    const { store, repo, clock } = makeWorld();
    await repo.enqueue(makeNewItem('atomic', makeSnapshot(clock)));

    await expect(
      store.transaction(['queue_items'], 'write', async (tx) => {
        await tx.delete('queue_items', 'atomic');
        throw new Error('falha no meio da transação');
      }),
    ).rejects.toThrow('falha no meio da transação');

    // O delete não foi commitado.
    expect(await repo.get('atomic')).toBeDefined();
  });
});
