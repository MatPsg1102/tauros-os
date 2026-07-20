import { describe, expect, it } from 'vitest';

import { CompositeConnectivity } from './connectivity.js';
import { makeNewItem, makeSnapshot, makeWorld } from './test-helpers.js';

describe('conectividade composta (RA-QUEUE-01 §6)', () => {
  it('online do dispositivo NÃO significa apto a sincronizar', async () => {
    const conn = new CompositeConnectivity({
      device: () => Promise.resolve(true),
      backend: () => Promise.resolve(false),
      auth: () => Promise.resolve(true),
      service: () => Promise.resolve(true),
    });
    const r = await conn.assess();
    expect(r.deviceOnline).toBe(true);
    expect(r.readyToSync).toBe(false);
  });

  it('todas as dimensões saudáveis ⇒ pronto; sonda que lança ⇒ indisponível', async () => {
    const ok = new CompositeConnectivity({
      device: () => Promise.resolve(true),
      backend: () => Promise.resolve(true),
      auth: () => Promise.resolve(true),
      service: () => Promise.resolve(true),
    });
    await expect(ok.assess()).resolves.toMatchObject({ readyToSync: true });

    const flaky = new CompositeConnectivity({
      device: () => Promise.resolve(true),
      backend: () => Promise.reject(new Error('probe falhou')),
      auth: () => Promise.resolve(true),
      service: () => Promise.resolve(true),
    });
    await expect(flaky.assess()).resolves.toMatchObject({
      backendReachable: false,
      readyToSync: false,
    });
  });
});

describe('processador + coordenador (RA-QUEUE-01 §4/§5/§7/§8)', () => {
  it('caminho feliz: PENDING → SYNCING → SYNCED, lease liberada', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('ok', makeSnapshot(w.clock)));
    const result = await w.processor.process('ok');
    expect(result).toMatchObject({ finalState: 'SYNCED', trigger: 'SERVER_PERSISTED' });
    const item = (await w.repo.get('ok'))!;
    expect(item.lease).toBeUndefined();
    expect(item.attemptCount).toBe(1);
  });

  it('idempotência: item SYNCED não é reenviado (transporte chamado 1x)', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('idem', makeSnapshot(w.clock)));
    await w.processor.process('idem');
    const again = await w.processor.process('idem');
    expect(again.trigger).toBe('SKIPPED');
    expect(w.transport.submitted.filter((id) => id === 'idem')).toHaveLength(1);
  });

  it('lock: processamento concorrente do mesmo item resulta em um envio só', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('locked', makeSnapshot(w.clock)));
    const [a, b] = await Promise.all([
      w.processor.process('locked'),
      w.processor.process('locked'),
    ]);
    const triggers = [a.trigger, b.trigger].sort();
    expect(triggers).toContain('SERVER_PERSISTED');
    expect(triggers).toContain('SKIPPED');
    expect(w.transport.submitted.filter((id) => id === 'locked')).toHaveLength(1);
  });

  it('erro transitório: RETRY_SCHEDULED com backoff no relógio controlado', async () => {
    const w = makeWorld(() => 0); // jitter mínimo ⇒ delay determinístico 15s
    await w.repo.enqueue(makeNewItem('flaky', makeSnapshot(w.clock)));
    w.transport.plan('flaky', {
      kind: 'transient',
      message: 'HTTP 503',
      authExpired: false,
    });

    const result = await w.processor.process('flaky');
    expect(result.finalState).toBe('RETRY_SCHEDULED');
    const item = (await w.repo.get('flaky'))!;
    expect(item.nextAttemptAt!.getTime() - w.clock.now.getTime()).toBe(15_000);
    expect(item.lastError?.classification).toBe('RECOVERABLE');
  });

  it('erro permanente: PERMANENT_FAILURE sem novo reenvio', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('bad', makeSnapshot(w.clock)));
    w.transport.plan('bad', { kind: 'rejected', message: 'HTTP 400 payload inválido' });

    const result = await w.processor.process('bad');
    expect(result.finalState).toBe('PERMANENT_FAILURE');
    // Scheduler nunca seleciona PERMANENT_FAILURE.
    await w.scheduler.promote();
    expect((await w.scheduler.selectReady()).map((i) => i.id)).not.toContain('bad');
  });

  it('revisão do servidor: NEEDS_REVIEW com motivo preservado', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('rev', makeSnapshot(w.clock)));
    w.transport.plan('rev', { kind: 'review', reason: 'autoria não verificável' });
    const result = await w.processor.process('rev');
    expect(result.finalState).toBe('NEEDS_REVIEW');
    expect((await w.repo.get('rev'))!.lastError?.message).toContain('autoria');
  });

  it('snapshot expirado: revisão local SEM envio cego ao servidor', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('stale', makeSnapshot(w.clock, 1_000)));
    w.clock.advance(2_000); // snapshot venceu
    const result = await w.processor.process('stale');
    expect(result.finalState).toBe('NEEDS_REVIEW');
    expect(w.transport.submitted).not.toContain('stale');
    expect(w.events.events.some((e) => e.type === 'snapshot_expired')).toBe(true);
  });

  it('conflito: evidências preservadas e estratégia default = manual', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('dup', makeSnapshot(w.clock)));
    w.transport.plan('dup', {
      kind: 'conflict',
      classification: 'idempotency_divergence',
      remoteEvidence: { serverPayload: { value: 99 } },
      message: 'HTTP 409 payload divergente',
    });

    const result = await w.processor.process('dup');
    expect(result.finalState).toBe('CONFLICT');

    const records = await w.repo.conflicts();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      itemId: 'dup',
      classification: 'idempotency_divergence',
      localPayload: { value: 42 },
      remoteEvidence: { serverPayload: { value: 99 } },
    });
  });

  it('estratégia injetada pode reenfileirar o conflito (requeue)', async () => {
    const w = makeWorld();
    w.registry.register('generic_record', '*', {
      resolve: () => Promise.resolve({ action: 'requeue', patchedPayload: { value: 43 } }),
    });
    await w.repo.enqueue(makeNewItem('retryable-conflict', makeSnapshot(w.clock)));
    w.transport.plan('retryable-conflict', {
      kind: 'conflict',
      classification: 'version_mismatch',
      remoteEvidence: null,
      message: '409',
    });

    const result = await w.processor.process('retryable-conflict');
    expect(result).toMatchObject({ finalState: 'PENDING', trigger: 'RESOLVED_REQUEUE' });
    expect((await w.repo.get('retryable-conflict'))!.payload).toEqual({ value: 43 });
  });

  it('coordenador não drena sem prontidão real de sincronização', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('waiting', makeSnapshot(w.clock)));
    const offline = w.coordinator({ backend: () => Promise.resolve(false) });
    const report = await offline.drain();
    expect(report.ready).toBe(false);
    expect(w.transport.submitted).toHaveLength(0);
  });

  it('retomada após reconexão: drena em ordem de dependência (DAG)', async () => {
    const w = makeWorld();
    const snap = makeSnapshot(w.clock);
    await w.repo.enqueue(
      makeNewItem('session', snap, { trace: { ...makeNewItem('s', snap).trace, priority: 0 } }),
    );
    await w.repo.enqueue(makeNewItem('execution', snap, { dependsOn: ['session'] }));
    await w.repo.enqueue(makeNewItem('attachment', snap, { dependsOn: ['execution'] }));

    const report = await w.coordinator().drain();
    expect(report.ready).toBe(true);
    expect(w.transport.submitted).toEqual(['session', 'execution', 'attachment']);
    expect((await w.repo.get('attachment'))!.state).toBe('SYNCED');
  });

  it('falha parcial: pai falha transitório ⇒ dependente permanece bloqueado', async () => {
    const w = makeWorld(() => 0);
    const snap = makeSnapshot(w.clock);
    await w.repo.enqueue(makeNewItem('parent', snap));
    await w.repo.enqueue(makeNewItem('dependent', snap, { dependsOn: ['parent'] }));
    w.transport.plan('parent', { kind: 'transient', message: 'rede caiu', authExpired: false });

    const report = await w.coordinator().drain();
    expect(report.processed.map((r) => r.itemId)).toEqual(['parent']);
    expect((await w.repo.get('parent'))!.state).toBe('RETRY_SCHEDULED');
    expect((await w.repo.get('dependent'))!.state).toBe('BLOCKED_BY_DEPENDENCY');
    expect(w.transport.submitted).not.toContain('dependent');

    // Backoff vence, reconecta: pai sincroniza e destrava o dependente.
    w.clock.advance(20_000);
    await w.coordinator().drain();
    expect((await w.repo.get('parent'))!.state).toBe('SYNCED');
    expect((await w.repo.get('dependent'))!.state).toBe('SYNCED');
  });
});
