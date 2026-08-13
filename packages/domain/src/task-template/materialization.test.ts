// Testes puros da regra de materialização — determinísticos, sem escala real.

import { describe, expect, it } from 'vitest';

import { EVERY_DAY, shouldMaterialize, weekdayOf } from './materialization.js';

describe('weekdayOf', () => {
  it('mapeia datas civis para o dia da semana correto', () => {
    expect(weekdayOf('2026-08-17')).toBe('MON'); // segunda
    expect(weekdayOf('2026-08-18')).toBe('TUE');
    expect(weekdayOf('2026-08-22')).toBe('SAT');
    expect(weekdayOf('2026-08-23')).toBe('SUN');
  });
});

describe('shouldMaterialize', () => {
  const ctx = (workDate: string, isScheduled = false) => ({
    workDate,
    weekday: weekdayOf(workDate),
    isScheduled,
  });

  it('nunca materializa antes da data inicial de vigência', () => {
    expect(
      shouldMaterialize({ recurrence: EVERY_DAY, effectiveFrom: '2026-08-17' }, ctx('2026-08-16')),
    ).toBe(false);
  });

  it('ONCE: só na própria data inicial', () => {
    const rule = { recurrence: { kind: 'ONCE' } as const, effectiveFrom: '2026-08-17' };
    expect(shouldMaterialize(rule, ctx('2026-08-17'))).toBe(true);
    expect(shouldMaterialize(rule, ctx('2026-08-18'))).toBe(false);
  });

  it('WEEKDAYS: só nos dias escolhidos, a partir da vigência', () => {
    const rule = {
      recurrence: { kind: 'WEEKDAYS', weekdays: ['MON', 'WED', 'FRI'] } as const,
      effectiveFrom: '2026-08-17',
    };
    expect(shouldMaterialize(rule, ctx('2026-08-17'))).toBe(true); // seg
    expect(shouldMaterialize(rule, ctx('2026-08-18'))).toBe(false); // ter
    expect(shouldMaterialize(rule, ctx('2026-08-19'))).toBe(true); // qua
  });

  it('WEEKDAYS todos os sete dias materializa sempre', () => {
    const rule = { recurrence: EVERY_DAY, effectiveFrom: '2026-08-17' };
    for (const d of ['2026-08-17', '2026-08-18', '2026-08-22', '2026-08-23']) {
      expect(shouldMaterialize(rule, ctx(d))).toBe(true);
    }
  });

  it('WHEN_SCHEDULED: só quando a escala diz presente (veredito externo)', () => {
    const rule = { recurrence: { kind: 'WHEN_SCHEDULED' } as const, effectiveFrom: '2026-08-17' };
    expect(shouldMaterialize(rule, ctx('2026-08-19', true))).toBe(true);
    expect(shouldMaterialize(rule, ctx('2026-08-19', false))).toBe(false);
  });
});
