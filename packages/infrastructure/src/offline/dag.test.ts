import { describe, expect, it } from 'vitest';

import { assertAcyclic, CycleDetectedError, dependenciesSatisfied } from './dag.js';
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

describe('DAG de dependências (RA-QUEUE-01 §2)', () => {
  it('dependência SYNCED conta como satisfeita; PENDING bloqueia', () => {
    const parent = itemWith('a', [], 'SYNCED');
    const pendingParent = itemWith('b', [], 'PENDING');
    const byId = new Map([
      ['a', parent],
      ['b', pendingParent],
    ]);

    expect(dependenciesSatisfied({ dependsOn: ['a'] }, byId)).toBe(true);
    expect(dependenciesSatisfied({ dependsOn: ['b'] }, byId)).toBe(false);
    expect(dependenciesSatisfied({ dependsOn: ['a', 'b'] }, byId)).toBe(false);
  });

  it('dependência ausente (já limpa) conta como satisfeita', () => {
    expect(dependenciesSatisfied({ dependsOn: ['ghost'] }, new Map())).toBe(true);
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
