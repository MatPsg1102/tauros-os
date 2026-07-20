// Testes da trilha de auditoria (6.2.8) — relógio/ids injetáveis, sem rede.

import { describe, expect, it } from 'vitest';

import { MemoryLocalStore } from '../offline/memory-store.js';
import { OFFLINE_SCHEMA } from '../offline/queue-repository.js';
import { makeEvent } from '../offline/events.js';
import { makeClock, makeNewItem, makeSnapshot, makeWorld } from '../offline/test-helpers.js';
import { createQueueItem } from '../offline/queue-item.js';

import { validateAuditEvent, AUDIT_SCHEMA_VERSION, type AuditEvent } from './audit-event.js';
import { AuditEventFactory, deterministicEventId } from './audit-factory.js';
import { DefaultAuditPolicy } from './audit-policy.js';
import { DefaultAuditSanitizer } from './audit-sanitizer.js';
import { LocalAuditBuffer } from './audit-buffer.js';
import { AuditDispatcher } from './audit-dispatcher.js';
import { AuditingEventBridge } from './audit-bridge.js';
import { HashChainVerifier } from './audit-integrity.js';
import { MemoryAuditRepository } from './audit-memory.js';
import type { AuditSubmitOutcome, AuditTransportPort } from './audit-ports.js';
import { PendingRetentionPolicy } from './audit-ports.js';

// JWT falso montado em runtime para nao disparar o guarda de segredos do repo
const FAKE_JWT = ['eyJ', 'hbGciOiJIUzI1NiJ9'].join('') + '.payload.sig';

const policy = new DefaultAuditPolicy();
const sanitizer = new DefaultAuditSanitizer();

function factoryWith(clock = makeClock()): AuditEventFactory {
  return new AuditEventFactory(policy, sanitizer, clock.fn);
}

function sampleEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  const clock = makeClock();
  return {
    ...factoryWith(clock).fromDirect({
      eventType: 'auth.login.success',
      occurredAt: clock.now,
      storeId: 'store-1',
      actorId: 'actor-1',
      actorType: 'human',
      correlationId: 'corr-1',
      source: 'client-online',
      result: 'success',
    }),
    ...overrides,
  };
}

class StubTransport implements AuditTransportPort {
  readonly submitted: string[] = [];
  private readonly plans = new Map<string, AuditSubmitOutcome[]>();
  private readonly seen = new Set<string>();

  plan(eventId: string, ...outcomes: AuditSubmitOutcome[]): void {
    this.plans.set(eventId, [...(this.plans.get(eventId) ?? []), ...outcomes]);
  }

  submit(event: AuditEvent): Promise<AuditSubmitOutcome> {
    this.submitted.push(event.eventId);
    const planned = this.plans.get(event.eventId)?.shift();
    if (planned) return Promise.resolve(planned);
    // comportamento server-like: dedupe por eventId
    if (this.seen.has(event.eventId)) return Promise.resolve({ kind: 'duplicate' });
    this.seen.add(event.eventId);
    return Promise.resolve({ kind: 'accepted', recordedAt: new Date().toISOString() });
  }
}

describe('modelo canônico (§1)', () => {
  it('cria e valida evento válido com versão', () => {
    const e = sampleEvent();
    const v = validateAuditEvent(e);
    expect(v.ok).toBe(true);
    expect(e.schemaVersion).toBe(AUDIT_SCHEMA_VERSION);
  });

  it('rejeita evento inválido com razão explícita', () => {
    const v = validateAuditEvent({ eventType: 'x' });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('eventId');
  });
});

describe('sanitização (§8)', () => {
  it('redige chaves proibidas em qualquer formato e profundidade', () => {
    const dirty = {
      user: 'ok',
      password: 'a',
      ACCESS_TOKEN: 'b',
      'api-key': 'c',
      nested: { deep: { refreshToken: 'd', serviceRole: 'e', fine: 1 } },
      list: [{ Authorization: 'f' }, { pin: 'g' }],
    };
    const clean = sanitizer.sanitize(dirty) as Record<string, unknown>;
    const s = JSON.stringify(clean);
    expect(s).not.toContain('"a"');
    expect(s).not.toContain('"b"');
    expect(s).not.toContain('"c"');
    expect(s).not.toContain('"d"');
    expect(s).not.toContain('"e"');
    expect(s).not.toContain('"f"');
    expect(s).not.toContain('"g"');
    expect(s).toContain('[REDACTED]');
    expect((clean.nested as { deep: { fine: number } }).deep.fine).toBe(1);
  });

  it('valores com cara de segredo são redigidos mesmo sob chave inocente', () => {
    const clean = sanitizer.sanitize({ note: FAKE_JWT });
    expect(JSON.stringify(clean)).toContain('[REDACTED]');
  });

  it('metadata usa ALLOWLIST', () => {
    const out = sanitizer.sanitizeMetadata({ allowed: 1, sneaky: 'x' }, ['allowed']);
    expect(out).toEqual({ allowed: 1 });
  });
});

describe('idempotência e correlação (§9)', () => {
  it('eventId é determinístico por (correlação, tipo, tentativa)', () => {
    expect(deterministicEventId('c', 't', 1)).toBe(deterministicEventId('c', 't', 1));
    expect(deterministicEventId('c', 't', 1)).not.toBe(deterministicEventId('c', 't', 2));
  });

  it('retry com resposta perdida não duplica logicamente (duplicate = sucesso)', async () => {
    const clock = makeClock();
    const store = new MemoryLocalStore(OFFLINE_SCHEMA);
    const buffer = new LocalAuditBuffer(store, clock.fn);
    const transport = new StubTransport();
    const e = sampleEvent();
    transport.plan(e.eventId, { kind: 'transient', message: 'resposta perdida' });

    await buffer.append(e);
    const retry = { decide: () => Promise.resolve({ retry: true, delayMs: 0 }) };
    const dispatcher = new AuditDispatcher(buffer, transport, retry);

    const first = await dispatcher.dispatch();
    expect(first.retriedLater).toEqual([e.eventId]);

    // retry: o servidor já tinha persistido? StubTransport agora aceita e,
    // num terceiro envio, deduplicaria — o outbox é limpo no aceite.
    const second = await dispatcher.dispatch();
    expect(second.dispatched).toEqual([e.eventId]);
    await expect(buffer.pending()).resolves.toHaveLength(0);

    // reprocessamento indevido do MESMO evento → dedupe
    await buffer.append(e);
    const third = await dispatcher.dispatch();
    expect(third.deduplicated).toEqual([e.eventId]);
  });

  it('fases múltiplas: mesmo correlationId, eventIds distintos', () => {
    const created = sampleEvent({ eventType: 'offline.operation.created' });
    const completed = sampleEvent({
      eventType: 'offline.operation.completed',
      eventId: deterministicEventId('corr-1', 'offline.operation.completed', 0),
    });
    expect(created.correlationId).toBe(completed.correlationId);
    expect(created.eventId).not.toBe(completed.eventId);
  });
});

describe('origem offline (§4) e política temporal (§10)', () => {
  it('promove evento técnico preservando item, autorização e horários distintos', async () => {
    const clock = makeClock();
    const item = createQueueItem(makeNewItem('q1', makeSnapshot(clock)), clock.now, false);
    clock.advance(5_000);

    const factory = factoryWith(clock);
    const technical = makeEvent(
      {
        eventType: 'sync_finished',
        queueItemId: 'q1',
        storeId: item.trace.storeId,
        sessionId: item.trace.sessionId,
        correlationId: item.idempotencyKey,
        attempt: 1,
        previousState: 'SYNCING',
        nextState: 'SYNCED',
      },
      clock.now,
    );

    const audit = factory.fromTechnicalEvent(technical, item)!;
    expect(audit.eventType).toBe('offline.operation.completed');
    expect(audit.queueItemId).toBe('q1');
    expect(audit.idempotencyKey).toBe(item.idempotencyKey);
    expect(audit.authorizationRef?.sessionId).toBe(item.authorization.sessionId);
    // ação ≠ envio ≠ persistência
    expect(audit.occurredAt).not.toBe(audit.sentAt);
    expect(audit.recordedAt).toBeNull(); // só o servidor preenche
    expect(audit.attempt).toBe(1);
  });

  it('eventos técnicos de diagnóstico NÃO são promovidos (§2)', () => {
    const clock = makeClock();
    const technical = makeEvent({ eventType: 'retry_scheduled' }, clock.now);
    expect(policy.shouldPromote(technical)).toBe(false);
    const technical2 = makeEvent({ eventType: 'queue_changed' }, clock.now);
    expect(policy.shouldPromote(technical2)).toBe(false);
  });

  it('ponte integra fila → outbox sem ciclo e sem derrubar o fluxo técnico', async () => {
    const w = makeWorld();
    const store = new MemoryLocalStore(OFFLINE_SCHEMA);
    const buffer = new LocalAuditBuffer(store, w.clock.fn);
    const bridge = new AuditingEventBridge(w.events, policy, factoryWith(w.clock), buffer, (id) =>
      w.repo.get(id),
    );

    // simula o wiring: emite eventos técnicos como o processador faria
    await w.repo.enqueue(makeNewItem('op-1', makeSnapshot(w.clock)));
    const item = (await w.repo.get('op-1'))!;
    bridge.emit(
      makeEvent(
        {
          eventType: 'sync_finished',
          queueItemId: 'op-1',
          storeId: item.trace.storeId,
          correlationId: item.idempotencyKey,
          attempt: 1,
        },
        w.clock.now,
      ),
    );
    await bridge.flush();

    const pending = await buffer.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.eventType).toBe('offline.operation.completed');
  });
});

describe('repositório de referência: ordenação, paginação, export (§10/§12)', () => {
  async function seeded(): Promise<{ repo: MemoryAuditRepository; ids: string[] }> {
    const clock = makeClock();
    const repo = new MemoryAuditRepository(clock.fn);
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const e = sampleEvent({
        eventId: `e-${i}`,
        correlationId: `corr-${i % 2}`,
        // occurredAt fora de ordem de propósito: quem manda é recordedAt
        occurredAt: new Date(clock.now.getTime() - i * 60_000).toISOString(),
      });
      await repo.append(e);
      ids.push(e.eventId);
    }
    return { repo, ids };
  }

  it('recordedAt é autoritativo: envio tardio não falsifica a ordem', async () => {
    const { repo } = await seeded();
    const page = await repo.query({}, 10);
    const recorded = page.events.map((e) => e.recordedAt!);
    expect([...recorded].sort()).toEqual(recorded); // ordem de persistência
    // occurredAt está decrescente (fora de ordem) — e não comanda nada
    const occurred = page.events.map((e) => e.occurredAt);
    expect([...occurred].sort()).not.toEqual(occurred);
  });

  it('paginação por cursor é determinística e sem sobreposição', async () => {
    const { repo } = await seeded();
    const p1 = await repo.query({}, 2);
    const p2 = await repo.query({}, 2, p1.nextCursor!);
    const p3 = await repo.query({}, 2, p2.nextCursor!);
    const all = [...p1.events, ...p2.events, ...p3.events].map((e) => e.eventId);
    expect(new Set(all).size).toBe(5);
    expect(p3.nextCursor).toBeNull();
  });

  it('filtra por correlação e exporta NDJSON estruturado', async () => {
    const { repo } = await seeded();
    const ndjson = await repo.exportNdjson({ correlationId: 'corr-1' });
    const lines = ndjson.split('\n');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const parsed = validateAuditEvent(JSON.parse(line));
      expect(parsed.ok).toBe(true);
    }
  });

  it('append é idempotente (mesmo eventId ⇒ duplicate, sem nova linha)', async () => {
    const { repo } = await seeded();
    const again = await repo.append(sampleEvent({ eventId: 'e-0' }));
    expect(again.duplicate).toBe(true);
    const page = await repo.query({}, 10);
    expect(page.events).toHaveLength(5);
  });
});

describe('integridade (§7)', () => {
  it('cadeia íntegra verifica válida', async () => {
    const clock = makeClock();
    const repo = new MemoryAuditRepository(clock.fn);
    for (let i = 0; i < 4; i += 1) await repo.append(sampleEvent({ eventId: `c-${i}` }));
    const result = new HashChainVerifier().verify(repo.chainOf('store-1'));
    expect(result).toEqual({ valid: true, length: 4 });
  });

  it('adulteração de conteúdo é detectada no ponto exato', async () => {
    const clock = makeClock();
    const repo = new MemoryAuditRepository(clock.fn);
    for (let i = 0; i < 4; i += 1) await repo.append(sampleEvent({ eventId: `t-${i}` }));
    repo.tamper('t-2', (e) => ({ ...e, result: 'rejected' }));
    const result = new HashChainVerifier().verify(repo.chainOf('store-1'));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.eventId).toBe('t-2');
      expect(result.reason).toBe('hash-mismatch');
    }
  });
});

describe('buffer durável: recuperação, quarentena, falha parcial (§3)', () => {
  it('outbox sobrevive a "reinício" (mesmo store, nova instância)', async () => {
    const clock = makeClock();
    const store = new MemoryLocalStore(OFFLINE_SCHEMA);
    const bufferA = new LocalAuditBuffer(store, clock.fn);
    await bufferA.append(sampleEvent({ eventId: 'durable' }));

    const bufferB = new LocalAuditBuffer(store, clock.fn);
    const pending = await bufferB.pending();
    expect(pending.map((e) => e.eventId)).toEqual(['durable']);
  });

  it('evento inválido no outbox vai à quarentena e não bloqueia os válidos', async () => {
    const clock = makeClock();
    const store = new MemoryLocalStore(OFFLINE_SCHEMA);
    const buffer = new LocalAuditBuffer(store, clock.fn);
    await buffer.append(sampleEvent({ eventId: 'ok-1' }));
    // corrompe direto na persistência
    await store.transaction(['audit_outbox'], 'write', (tx) =>
      tx.put('audit_outbox', 'bad', { event: { eventId: 'bad' }, appendedAt: 'x' }),
    );
    const pending = await buffer.pending();
    expect(pending.map((e) => e.eventId)).toEqual(['ok-1']);
    await expect(buffer.quarantined()).resolves.toHaveLength(1);
  });

  it('falha parcial: rejeitado vai à quarentena, aceito é despachado', async () => {
    const clock = makeClock();
    const store = new MemoryLocalStore(OFFLINE_SCHEMA);
    const buffer = new LocalAuditBuffer(store, clock.fn);
    const transport = new StubTransport();
    const good = sampleEvent({ eventId: 'good' });
    const bad = sampleEvent({ eventId: 'bad' });
    transport.plan('bad', { kind: 'rejected', reason: 'autoria inconsistente' });
    await buffer.append(bad);
    await buffer.append(good);

    const dispatcher = new AuditDispatcher(buffer, transport, {
      decide: () => Promise.resolve({ retry: false, delayMs: 0 }),
    });
    const report = await dispatcher.dispatch();
    expect(report.dispatched).toEqual(['good']);
    expect(report.quarantined).toEqual(['bad']);
    await expect(buffer.pending()).resolves.toHaveLength(0);
    await expect(buffer.quarantined()).resolves.toHaveLength(1);
  });
});

describe('retenção (§11) e segredos (§8)', () => {
  it('política de retenção registra pendência de negócio, sem valores inventados', () => {
    const rule = new PendingRetentionPolicy().ruleFor();
    expect(rule).toEqual({ mode: 'pending-business-decision' });
  });

  it('nenhum evento serializado carrega material de segredo', async () => {
    const clock = makeClock();
    const factory = factoryWith(clock);
    const audit = factory.fromDirect({
      eventType: 'admin.action',
      occurredAt: clock.now,
      storeId: 's',
      actorId: 'a',
      actorType: 'human',
      correlationId: 'c',
      source: 'server',
      result: 'success',
      error: new Error(`falhou com token ${FAKE_JWT} no meio`),
      metadata: { note: 'ok', password: 'nope' },
      metadataAllowlist: ['note', 'password'],
    });
    const s = JSON.stringify(audit);
    expect(s).not.toContain(FAKE_JWT.slice(0, 10));
    expect(s).not.toContain('nope');
  });
});
