// Formatadores de apresentação pt-BR (V2) — datas civis nunca em ISO cru.
import { describe, expect, it } from 'vitest';

import { operationalDateLabel, shortDateLabel } from '../src/ui/format.js';

describe('shortDateLabel', () => {
  it('YYYY-MM-DD → dd/mm', () => {
    expect(shortDateLabel('2026-08-26')).toBe('26/08');
  });

  it('entrada nula/curta/inválida degrada para —', () => {
    expect(shortDateLabel(null)).toBe('—');
    expect(shortDateLabel('')).toBe('—');
    expect(shortDateLabel('2026-08')).toBe('—');
  });
});

describe('operationalDateLabel', () => {
  it('deriva o dia da semana da PRÓPRIA data civil (calendário puro)', () => {
    // 2026-08-26 é uma quarta-feira — determinístico, sem fuso do aparelho
    expect(operationalDateLabel('2026-08-26')).toBe('qua · 26/08');
    expect(operationalDateLabel('2026-08-23')).toBe('dom · 23/08');
  });

  it('entrada inválida degrada para —', () => {
    expect(operationalDateLabel(null)).toBe('—');
    expect(operationalDateLabel('nada')).toBe('—');
  });
});
