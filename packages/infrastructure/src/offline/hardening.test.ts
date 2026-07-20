// Testes das validações complementares da 6.2.7 (§2, §4, §5, §6, §7, §8, §9).

import { describe, expect, it } from 'vitest';

import { captureSnapshot, SnapshotSecurityError } from './authorization-snapshot.js';
import { decodeQueueItem, encodeQueueItem } from './codec.js';
import { InvalidDependencyError } from './dag.js';
import { InvalidParameterError, resolveOfflineParameters } from './offline-parameters.js';
import { createQueueItem } from './queue-item.js';
import { makeClock, makeNewItem, makeSnapshot, makeWorld } from './test-helpers.js';

describe('codec de persistência (§2)', () => {
  it('roundtrip canônico: Date→ISO, undefined→null, arrays e aninhados preservados', () => {
    const clock = makeClock();
    const item = createQueueItem(
      makeNewItem('rt', makeSnapshot(clock), {
        payload: { nested: { deep: [1, 2, 3] }, flag: true, text: 'ok' },
      }),
      clock.now,
      false,
    );
    const encoded = encodeQueueItem(item);
    // formato canônico: JSON puro (sobrevive a serialização integral)
    const viaJson = JSON.parse(JSON.stringify(encoded)) as unknown;
    const decoded = decodeQueueItem(viaJson);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.item.createdAt).toBeInstanceOf(Date);
      expect(decoded.item.createdAt.getTime()).toBe(item.createdAt.getTime());
      expect(decoded.item.nextAttemptAt).toBeUndefined();
      expect(decoded.item.payload).toEqual({ nested: { deep: [1, 2, 3] }, flag: true, text: 'ok' });
      expect(decoded.item.authorization.validUntil.getTime()).toBe(
        item.authorization.validUntil.getTime(),
      );
    }
  });

  it('entrada inválida é identificada com razão específica', () => {
    const bad = decodeQueueItem({ id: 'x', state: 'NOT_A_STATE' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason.length).toBeGreaterThan(0);
  });

  it('item persistido inválido vai à QUARENTENA e não bloqueia a fila (§2)', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('valid', makeSnapshot(w.clock)));
    // corrompe diretamente a persistência (simula versão antiga/corrupção)
    await w.store.transaction(['queue_items'], 'write', (tx) =>
      tx.put('queue_items', 'corrupted', { id: 'corrupted', garbage: true }),
    );

    const all = await w.repo.all();
    expect(all.map((i) => i.id)).toEqual(['valid']);
    const quarantined = await w.repo.quarantined();
    expect(quarantined).toHaveLength(1);
    expect(w.events.events.some((e) => e.eventType === 'item_quarantined')).toBe(true);
    // fila segue operável
    const report = await w.coordinator().drain();
    expect(report.processed.map((r) => r.itemId)).toEqual(['valid']);
  });
});

describe('parâmetros técnicos (§4)', () => {
  it('contrato único com defaults documentados e validação', () => {
    const p = resolveOfflineParameters({ instanceId: 'i-1' });
    expect(p.leaseTtlMs).toBe(60_000);
    expect(p.syncedRetentionMs).toBe(86_400_000);
    expect(Object.isFrozen(p)).toBe(true);
  });

  it('rejeita valores inválidos na composição (falha cedo)', () => {
    expect(() => resolveOfflineParameters({ instanceId: '' })).toThrow(InvalidParameterError);
    expect(() => resolveOfflineParameters({ instanceId: 'x', leaseTtlMs: 0 })).toThrow(
      InvalidParameterError,
    );
    expect(() => resolveOfflineParameters({ instanceId: 'x', maxPayloadBytes: -1 })).toThrow(
      InvalidParameterError,
    );
  });
});

describe('dependência ausente sem evidência (§5)', () => {
  it('enqueue rejeita referência a dependência inexistente sem tombstone', async () => {
    const w = makeWorld();
    await expect(
      w.repo.enqueue(
        makeNewItem('orphan', makeSnapshot(w.clock), { dependsOn: ['nunca-existiu'] }),
      ),
    ).rejects.toThrow(InvalidDependencyError);
  });

  it('tombstone é evidência: dependente de item limpo é liberado', async () => {
    const w = makeWorld();
    const snap = makeSnapshot(w.clock);
    await w.repo.enqueue(makeNewItem('parent', snap));
    await w.coordinator().drain(); // parent SYNCED
    await w.repo.removeCompleted(['parent']); // limpeza segura ⇒ tombstone

    const child = await w.repo.enqueue(makeNewItem('child', snap, { dependsOn: ['parent'] }));
    expect(child.state).toBe('PENDING'); // evidência via tombstone
  });

  it('remoção INDEVIDA (sem tombstone) manda dependente para NEEDS_REVIEW', async () => {
    const w = makeWorld();
    const snap = makeSnapshot(w.clock);
    await w.repo.enqueue(makeNewItem('parent', snap));
    await w.repo.enqueue(makeNewItem('child', snap, { dependsOn: ['parent'] }));
    // corrupção: parent some da persistência SEM passar pela limpeza segura
    await w.store.transaction(['queue_items'], 'write', (tx) => tx.delete('queue_items', 'parent'));

    await w.scheduler.promote();
    const child = (await w.repo.get('child'))!;
    expect(child.state).toBe('NEEDS_REVIEW');
    expect(w.events.events.some((e) => e.eventType === 'dependency_missing')).toBe(true);
  });
});

describe('fencing de lease e múltiplas instâncias (§6)', () => {
  it('claim simultâneo entre duas "abas": exatamente um vencedor', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('shared', makeSnapshot(w.clock)));
    const [a, b] = await Promise.all([
      w.repo.claimLease('shared', 'tab-A', 60_000),
      w.repo.claimLease('shared', 'tab-B', 60_000),
    ]);
    expect([a, b].filter((x) => x !== undefined)).toHaveLength(1);
  });

  it('worker antigo NÃO finaliza item cujo lease foi assumido por outro (fencing)', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('fenced', makeSnapshot(w.clock)));

    // worker A pega a lease e "trava" (não conclui)
    const leasedA = await w.repo.claimLease('fenced', 'worker-A', 1_000);
    const tokenA = leasedA!.lease!.token;
    await w.repo.put({ ...leasedA!, state: 'SYNCING' });

    // lease expira; reclaim devolve a PENDING; worker B assume com novo token
    w.clock.advance(5_000);
    await w.repo.reclaimExpiredLeases();
    const leasedB = await w.repo.claimLease('fenced', 'worker-B', 60_000);
    expect(leasedB!.lease!.token).not.toBe(tokenA);

    // worker A acorda e tenta persistir SYNCED com o token antigo ⇒ rejeitado
    const staleWrite = await w.repo.putIfLeaseHolder(
      { ...leasedA!, state: 'SYNCED', lease: undefined },
      tokenA,
    );
    expect(staleWrite).toBe(false);
    expect((await w.repo.get('fenced'))!.state).toBe('PENDING'); // intacto p/ worker B
  });
});

describe('idempotência com resposta perdida (§7)', () => {
  it('servidor persistiu, resposta perdida, retry não duplica (chave estável)', async () => {
    const w = makeWorld(() => 0);
    await w.repo.enqueue(makeNewItem('lost-ack', makeSnapshot(w.clock)));
    // 1ª tentativa: servidor PERSISTIU mas a resposta se perdeu (timeout ⇒ transient)
    // 2ª tentativa: dedupe idempotente do servidor responde persisted.
    w.transport.plan('lost-ack', {
      kind: 'transient',
      message: 'timeout após persistência remota',
      authExpired: false,
    });

    await w.coordinator().drain();
    expect((await w.repo.get('lost-ack'))!.state).toBe('RETRY_SCHEDULED');

    w.clock.advance(20_000);
    await w.coordinator().drain();

    const item = (await w.repo.get('lost-ack'))!;
    expect(item.state).toBe('SYNCED');
    expect(item.attemptCount).toBe(2);
    // A MESMA chave em todas as tentativas — nunca regenerada.
    expect(w.transport.submittedKeys).toEqual(['idem-lost-ack', 'idem-lost-ack']);
  });
});

describe('cancelamento cooperativo (§8)', () => {
  it('sinal abortado antes do lote: nada é enviado, itens permanecem PENDING', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('later', makeSnapshot(w.clock)));
    const controller = new AbortController();
    controller.abort();

    const report = await w.coordinator().drain(controller.signal);
    expect(report.ready).toBe(true);
    expect(report.processed).toHaveLength(0);
    expect(w.transport.submitted).toHaveLength(0);
    expect((await w.repo.get('later'))!.state).toBe('PENDING');
  });

  it('cancelado durante SYNCING: volta a PENDING, nunca falha permanente', async () => {
    const w = makeWorld();
    await w.repo.enqueue(makeNewItem('mid-flight', makeSnapshot(w.clock)));
    const controller = new AbortController();
    // transporte aborta o sinal DURANTE o envio e devolve transient
    w.transport.onSubmit = () => controller.abort();
    w.transport.plan('mid-flight', {
      kind: 'transient',
      message: 'aborted mid-flight',
      authExpired: false,
    });

    const result = await w.processor.process('mid-flight', controller.signal);
    expect(result.trigger).toBe('CANCELLED');
    const item = (await w.repo.get('mid-flight'))!;
    expect(item.state).toBe('PENDING');
    expect(item.lease).toBeUndefined();
    expect(w.events.events.some((e) => e.eventType === 'sync_cancelled')).toBe(true);
  });
});

describe('segurança local (§9)', () => {
  it('snapshot rejeita campos proibidos de objetos externos', () => {
    const clock = makeClock();
    const hostile = {
      operatorProfileId: 'p',
      operatorEmployeeId: 'e',
      storeId: 's',
      sessionId: 'sess',
      permissions: ['x'],
      authOrigin: 'online',
      accessToken: 'material-de-segredo-simulado',
    } as never;
    expect(() => captureSnapshot(hostile, 1_000, clock.fn)).toThrow(SnapshotSecurityError);
  });

  it('snapshot legítimo contém apenas contexto, nunca material de segredo', () => {
    const clock = makeClock();
    const snap = captureSnapshot(
      {
        operatorProfileId: 'p',
        operatorEmployeeId: 'e',
        storeId: 's',
        sessionId: 'sess',
        permissions: ['tasks.execute.own'],
        authOrigin: 'offline-pin',
      },
      1_000,
      clock.fn,
    );
    const keys = Object.keys(snap).join(' ');
    expect(/token|secret|password|credential/i.test(keys)).toBe(false);
  });

  it('eventos técnicos nunca carregam payload operacional', async () => {
    const w = makeWorld();
    await w.repo.enqueue(
      makeNewItem('sensitive', makeSnapshot(w.clock), { payload: { cpf: '123', preco: 99 } }),
    );
    await w.coordinator().drain();
    const serialized = JSON.stringify(w.events.events);
    expect(serialized).not.toContain('cpf');
    expect(serialized).not.toContain('preco');
    // e todo evento tem a estrutura obrigatória (§10)
    for (const e of w.events.events) {
      expect(e.eventId).toBeTruthy();
      expect(e.timestamp).toBeInstanceOf(Date);
      expect(e.metadataVersion).toBe(1);
    }
  });
});
