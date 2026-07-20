import { describe, expect, it } from 'vitest';

import { InvalidTransitionError, QUEUE_STATES, TRANSITIONS, transition } from './state-machine.js';

describe('máquina de estados da fila (RA-QUEUE-01 §3)', () => {
  it('define exatamente os 8 estados da arquitetura', () => {
    expect(QUEUE_STATES).toHaveLength(8);
    expect(QUEUE_STATES).toEqual(
      expect.arrayContaining([
        'PENDING',
        'BLOCKED_BY_DEPENDENCY',
        'SYNCING',
        'SYNCED',
        'RETRY_SCHEDULED',
        'CONFLICT',
        'NEEDS_REVIEW',
        'PERMANENT_FAILURE',
      ]),
    );
  });

  it.each(TRANSITIONS.map((t) => [t.from, t.trigger, t.to] as const))(
    'aceita %s --%s--> %s',
    (from, trigger, to) => {
      const def = transition(from, trigger);
      expect(def.to).toBe(to);
      expect(def.technicalEvent).toBeTruthy();
    },
  );

  it('SYNCED é terminal: nenhuma transição parte dele', () => {
    expect(TRANSITIONS.filter((t) => t.from === 'SYNCED')).toHaveLength(0);
  });

  it('rejeita transição inválida de forma explícita e testável', () => {
    expect(() => transition('SYNCED', 'LEASE_ACQUIRED')).toThrow(InvalidTransitionError);
    expect(() => transition('PENDING', 'SERVER_PERSISTED')).toThrow(InvalidTransitionError);
    expect(() => transition('PERMANENT_FAILURE', 'BACKOFF_ELAPSED')).toThrow(
      InvalidTransitionError,
    );
  });

  it('estados de intervenção exigem decisão humana para requeue/descarte', () => {
    for (const t of TRANSITIONS.filter(
      (t) => t.trigger === 'RESOLVED_REQUEUE' || t.trigger === 'DISCARDED',
    )) {
      expect(t.requiresIntervention).toBe(true);
    }
  });
});
