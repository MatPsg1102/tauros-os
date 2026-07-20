import { describe, expect, it } from 'vitest';

import { assertAcyclic, CycleDetectedError, dependencyStatus, resolveDependency } from './dag.js';
import { makeClock, makeNewItem, makeSnapshot } from './test-helpers.js';
import { createQueueItem, type QueueItem } from './queue-item.js';

function itemWith(id: string, deps: string[], state: QueueItem['state']): QueueItem {
  const clock = makeClock();
  const base = createQueueItem(
    makeNewItem(id, makeSnapshot(clock), { dependsOn: deps }),
    clock.now,
    false,
  );
  return { ...base, state };
}

const NO_TOMBSTONES: ReadonlySet<string> = new Set();

describe('DAG de dependências (RA-QUEUE-01 §2 · semântica §5)', () => {
  it('resolve as quatro situações de uma dependência explicitamente', () => {
    const byId = new Map([
      ['done', itemWith('done', [], 'SYNCED')],
      ['open', itemWith('open', [], 'PENDING')],
    ]);
    const tombstones = new Set(['cleaned']);

    expect(resolveDependency('done', byId, tombstones)).toBe('completed');
    expect(resolveDependency('open', byId, tombstones)).toBe('pending');
    expect(resolveDependency('cleaned', byId, tombstones)).toBe('completed-removed');
    expect(resolveDependency('ghost', byId, tombstones)).toBe('missing');
  });

  it('ausência SEM evidência NUNCA é sucesso: status aponta missing', () => {
    const status = dependencyStatus({ dependsOn: ['ghost'] }, new Map(), NO_TOMBSTONES);
    expect(status.satisfied).toBe(false);
    expect(status.missing).toEqual(['ghost']);
  });

  it('tombstone é evidência de conclusão (satisfeito)', () => {
    const status = dependencyStatus({ dependsOn: ['cleaned'] }, new Map(), new Set(['cleaned']));
    expect(status.satisfied).toBe(true);
    expect(status.missing).toHaveLength(0);
  });

  it('mistura de pendente + concluída bloqueia sem acusar missing', () => {
    const byId = new Map([
      ['a', itemWith('a', [], 'SYNCED')],
      ['b', itemWith('b', [], 'PENDING')],
    ]);
    const status = dependencyStatus({ dependsOn: ['a', 'b'] }, byId, NO_TOMBSTONES);
    expect(status.satisfied).toBe(false);
    expect(status.pending).toEqual(['b']);
    expect(status.missing).toHaveLength(0);
  });

  it('aceita cadeias e diamantes acíclicos', () => {
    const byId = new Map([
      ['s', itemWith('s', [], 'PENDING')],
      ['e1', itemWith('e1', ['s'], 'PENDING')],
      ['e2', itemWith('e2', ['s'], 'PENDING')],
    ]);
    expect(() => assertAcyclic({ id: 'att', dependsOn: ['e1', 'e2'] }, byId)).not.toThrow();
  });

  it('detecta ciclo direto e nomeia o caminho (erro técnico auditável)', () => {
    const byId = new Map([['x', itemWith('x', ['y'], 'PENDING')]]);
    try {
      assertAcyclic({ id: 'y', dependsOn: ['x'] }, byId);
      expect.unreachable('deveria lançar CycleDetectedError');
    } catch (error) {
      expect(error).toBeInstanceOf(CycleDetectedError);
      expect((error as CycleDetectedError).cycle).toContain('x');
      expect((error as CycleDetectedError).cycle).toContain('y');
    }
  });

  it('detecta auto-ciclo', () => {
    expect(() => assertAcyclic({ id: 'self', dependsOn: ['self'] }, new Map())).toThrow(
      CycleDetectedError,
    );
  });
});
