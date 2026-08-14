// Testes do resolver de presença planejada — o ÚNICO lugar que calcula
// escala. Prova que padrões são DADOS por loja (12x36, semanal, dias fixos)
// resolvidos pelo MESMO domínio, sem regra universal do Tauros OS.

import { describe, expect, it } from 'vitest';

import {
  activePatternFor,
  daysBetweenCivil,
  resolvePlannedDay,
  teamWorksOn,
  type CyclePatternView,
  type ResolvePlannedDayInput,
} from './resolve-planned-day.js';

/** 12x36 como DADO: ciclo de 2 dias [trabalha, folga]. */
const ROTATING_2_DAYS: CyclePatternView = {
  id: 'pat-rot-2',
  name: '12x36',
  effectiveFrom: null,
  effectiveUntil: null,
  days: [
    { dayIndex: 0, works: true },
    { dayIndex: 1, works: false },
  ],
};

/** Semanal seg–sex como DADO: ciclo de 7 ancorado numa segunda-feira. */
const WEEKLY_MON_FRI: CyclePatternView = {
  id: 'pat-week',
  name: 'Segunda a sexta',
  effectiveFrom: null,
  effectiveUntil: null,
  days: [
    { dayIndex: 0, works: true },
    { dayIndex: 1, works: true },
    { dayIndex: 2, works: true },
    { dayIndex: 3, works: true },
    { dayIndex: 4, works: true },
    { dayIndex: 5, works: false },
    { dayIndex: 6, works: false },
  ],
};

/** Dias fixos configuráveis: seg, ter, qui, sáb. */
const FIXED_DAYS: CyclePatternView = {
  id: 'pat-fixed',
  name: 'Dias fixos',
  effectiveFrom: null,
  effectiveUntil: null,
  days: [
    { dayIndex: 0, works: true }, // seg
    { dayIndex: 1, works: true }, // ter
    { dayIndex: 2, works: false },
    { dayIndex: 3, works: true }, // qui
    { dayIndex: 4, works: false },
    { dayIndex: 5, works: true }, // sáb
    { dayIndex: 6, works: false },
  ],
};

function baseInput(overrides: Partial<ResolvePlannedDayInput>): ResolvePlannedDayInput {
  return {
    storeId: 'store-1',
    operationalDate: '2026-08-17',
    anchorDate: '2026-08-17',
    patterns: [ROTATING_2_DAYS],
    teams: [
      { id: 'team-a', name: 'Equipe A', rotationOffset: 0 },
      { id: 'team-b', name: 'Equipe B', rotationOffset: 1 },
    ],
    employees: [
      { id: 'emp-1', fullName: 'João', active: true },
      { id: 'emp-2', fullName: 'Paula', active: true },
      { id: 'emp-3', fullName: 'Carlos', active: true },
    ],
    assignments: [
      // MESMA equipe, jornadas DIFERENTES — equipe nunca define horário
      {
        employeeId: 'emp-1',
        teamId: 'team-a',
        positionId: 'pos-x',
        shiftDefinitionId: 'def-0730',
        validFrom: '2026-08-01',
        validUntil: null,
      },
      {
        employeeId: 'emp-2',
        teamId: 'team-a',
        positionId: 'pos-caixa',
        shiftDefinitionId: 'def-0830',
        validFrom: '2026-08-01',
        validUntil: null,
      },
      {
        employeeId: 'emp-3',
        teamId: 'team-b',
        positionId: 'pos-x',
        shiftDefinitionId: 'def-0730',
        validFrom: '2026-08-01',
        validUntil: null,
      },
    ],
    ...overrides,
  };
}

describe('rotação cíclica (config da loja atual: 12x36 A/B)', () => {
  it('alterna as equipes a partir da âncora — 17=A, 18=B, 19=A, 20=B', () => {
    for (const [date, expected] of [
      ['2026-08-17', 'team-a'],
      ['2026-08-18', 'team-b'],
      ['2026-08-19', 'team-a'],
      ['2026-08-20', 'team-b'],
    ] as const) {
      const decision = resolvePlannedDay(baseInput({ operationalDate: date }));
      expect(decision.kind).toBe('resolved');
      if (decision.kind === 'resolved') expect(decision.scheduledTeamIds).toEqual([expected]);
    }
  });

  it('datas ANTERIORES à âncora seguem a mesma rotação (módulo positivo)', () => {
    const decision = resolvePlannedDay(baseInput({ operationalDate: '2026-08-16' }));
    if (decision.kind === 'resolved') expect(decision.scheduledTeamIds).toEqual(['team-b']);
    expect(daysBetweenCivil('2026-08-17', '2026-08-16')).toBe(-1);
  });

  it('colaboradores da equipe escalada entram com jornadas PRÓPRIAS distintas', () => {
    const decision = resolvePlannedDay(baseInput({ operationalDate: '2026-08-17' }));
    expect(decision.kind).toBe('resolved');
    if (decision.kind !== 'resolved') return;
    expect(decision.employees).toHaveLength(2);
    const byId = new Map(decision.employees.map((e) => [e.employeeId, e]));
    expect(byId.get('emp-1')?.shiftDefinitionId).toBe('def-0730');
    expect(byId.get('emp-2')?.shiftDefinitionId).toBe('def-0830');
    // colaborador da equipe de folga NÃO está escalado
    expect(byId.has('emp-3')).toBe(false);
  });

  it('vínculo fora de vigência ou colaborador inativo não escala', () => {
    const decision = resolvePlannedDay(
      baseInput({
        employees: [
          { id: 'emp-1', fullName: 'João', active: true },
          { id: 'emp-9', fullName: 'Ex', active: false },
        ],
        assignments: [
          // vínculo só começa DEPOIS da data consultada
          {
            employeeId: 'emp-1',
            teamId: 'team-a',
            positionId: 'pos-x',
            shiftDefinitionId: 'def-0730',
            validFrom: '2026-09-01',
            validUntil: null,
          },
          {
            employeeId: 'emp-9',
            teamId: 'team-a',
            positionId: 'pos-x',
            shiftDefinitionId: 'def-0730',
            validFrom: '2026-08-01',
            validUntil: null,
          },
        ],
      }),
    );
    if (decision.kind === 'resolved') expect(decision.employees).toHaveLength(0);
  });
});

describe('padrões diferentes por loja — MESMO resolver, zero código novo', () => {
  it('outra loja usa semanal seg–sex com âncora numa segunda', () => {
    // 2026-08-17 é segunda-feira
    const monday = resolvePlannedDay(
      baseInput({
        storeId: 'store-b',
        patterns: [WEEKLY_MON_FRI],
        teams: [{ id: 'team-unica', name: 'Equipe Única', rotationOffset: 0 }],
        assignments: [
          {
            employeeId: 'emp-1',
            teamId: 'team-unica',
            positionId: 'pos-x',
            shiftDefinitionId: 'def-0800',
            validFrom: '2026-08-01',
            validUntil: null,
          },
        ],
        operationalDate: '2026-08-21', // sexta
      }),
    );
    if (monday.kind === 'resolved') expect(monday.scheduledTeamIds).toEqual(['team-unica']);

    const saturday = resolvePlannedDay(
      baseInput({
        storeId: 'store-b',
        patterns: [WEEKLY_MON_FRI],
        teams: [{ id: 'team-unica', name: 'Equipe Única', rotationOffset: 0 }],
        operationalDate: '2026-08-22', // sábado
      }),
    );
    if (saturday.kind === 'resolved') expect(saturday.scheduledTeamIds).toEqual([]);
  });

  it('dias fixos configuráveis (seg, ter, qui, sáb) são representáveis', () => {
    const results = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-22'].map(
      (date) => {
        const decision = resolvePlannedDay(
          baseInput({
            patterns: [FIXED_DAYS],
            teams: [{ id: 'team-unica', name: 'Única', rotationOffset: 0 }],
            operationalDate: date,
          }),
        );
        return decision.kind === 'resolved' && decision.scheduledTeamIds.length > 0;
      },
    );
    // seg ✓, ter ✓, qua ✗, qui ✓, sáb ✓
    expect(results).toEqual([true, true, false, true, true]);
  });

  it('duas lojas com padrões distintos resolvem no MESMO domínio (multiloja)', () => {
    const storeA = resolvePlannedDay(baseInput({ operationalDate: '2026-08-18' }));
    const storeB = resolvePlannedDay(
      baseInput({
        storeId: 'store-b',
        patterns: [WEEKLY_MON_FRI],
        teams: [{ id: 'team-unica', name: 'Única', rotationOffset: 0 }],
        operationalDate: '2026-08-18', // terça
      }),
    );
    // loja A (rotacional): só a Equipe B; loja B (semanal): equipe única
    if (storeA.kind === 'resolved') expect(storeA.scheduledTeamIds).toEqual(['team-b']);
    if (storeB.kind === 'resolved') expect(storeB.scheduledTeamIds).toEqual(['team-unica']);
    expect(storeA.kind).toBe('resolved');
    expect(storeB.kind).toBe('resolved');
  });
});

describe('vigência do padrão', () => {
  it('respeita a troca de padrão por vigência sem reescrever histórico', () => {
    const until310826: CyclePatternView = {
      ...ROTATING_2_DAYS,
      id: 'pat-old',
      effectiveUntil: '2026-08-31',
    };
    const from010926: CyclePatternView = {
      ...WEEKLY_MON_FRI,
      id: 'pat-new',
      effectiveFrom: '2026-09-01',
    };
    expect(activePatternFor([until310826, from010926], '2026-08-30')?.id).toBe('pat-old');
    expect(activePatternFor([until310826, from010926], '2026-09-02')?.id).toBe('pat-new');
  });

  it('data sem padrão vigente é explicitamente unconfigured — nunca um chute', () => {
    const decision = resolvePlannedDay(
      baseInput({
        patterns: [{ ...ROTATING_2_DAYS, effectiveUntil: '2026-08-10' }],
        operationalDate: '2026-08-17',
      }),
    );
    expect(decision).toMatchObject({ kind: 'unconfigured' });
  });

  it('loja sem âncora é unconfigured', () => {
    expect(resolvePlannedDay(baseInput({ anchorDate: null }))).toMatchObject({
      kind: 'unconfigured',
    });
  });
});

describe('teamWorksOn — utilitário exposto', () => {
  it('offsets distintos deslocam a mesma equipe no ciclo', () => {
    expect(teamWorksOn(ROTATING_2_DAYS, '2026-08-17', 0, '2026-08-17')).toBe(true);
    expect(teamWorksOn(ROTATING_2_DAYS, '2026-08-17', 1, '2026-08-17')).toBe(false);
    expect(teamWorksOn(ROTATING_2_DAYS, '2026-08-17', 1, '2026-08-18')).toBe(true);
  });
});
