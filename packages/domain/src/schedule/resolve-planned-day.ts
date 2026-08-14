// Domínio: resolução da PRESENÇA PLANEJADA de um dia (Escala Operacional).
// ESTE é o único lugar do sistema que calcula escala — UI, tarefas e
// controllers apenas perguntam. O padrão é DADO cíclico genérico da LOJA
// (shift_patterns/shift_pattern_days + âncora da loja + offset por equipe):
// 12x36 = ciclo [trabalha, folga]; semanal = ciclo 7; dias fixos = ciclo 7
// ancorado em dia da semana conhecido. NENHUM padrão é regra universal do
// Tauros OS — cada loja configura o seu. Resolve presença PLANEJADA
// ("deveria trabalhar"), nunca presença REAL (comparecimento é futuro).
// PURO: sem relógio real, aleatoriedade ou infra.

export interface CyclePatternView {
  readonly id: string;
  readonly name: string;
  /** Vigência (YYYY-MM-DD); null = aberto. */
  readonly effectiveFrom: string | null;
  readonly effectiveUntil: string | null;
  readonly days: readonly { readonly dayIndex: number; readonly works: boolean }[];
}

export interface RotatingTeamView {
  readonly id: string;
  readonly name: string;
  /** Posição da equipe no ciclo do padrão (12x36 A/B = 0 e 1). */
  readonly rotationOffset: number;
}

export interface PlannedMemberInput {
  readonly id: string;
  readonly fullName: string;
  readonly active: boolean;
}

export interface PlannedAssignmentInput {
  readonly employeeId: string;
  readonly teamId: string | null;
  readonly positionId: string | null;
  readonly shiftDefinitionId: string | null;
  readonly validFrom: string;
  readonly validUntil: string | null;
}

export interface ResolvePlannedDayInput {
  readonly storeId: string;
  /** Data operacional civil YYYY-MM-DD (fuso da loja). */
  readonly operationalDate: string;
  /** Âncora da rotação da LOJA (stores.shift_anchor_date); null = sem escala. */
  readonly anchorDate: string | null;
  readonly patterns: readonly CyclePatternView[];
  readonly teams: readonly RotatingTeamView[];
  readonly employees: readonly PlannedMemberInput[];
  readonly assignments: readonly PlannedAssignmentInput[];
}

export interface PlannedDayEmployee {
  readonly employeeId: string;
  readonly teamId: string;
  readonly positionId: string | null;
  readonly shiftDefinitionId: string | null;
}

export type PlannedDayDecision =
  | {
      readonly kind: 'resolved';
      readonly patternId: string;
      readonly patternName: string;
      readonly scheduledTeamIds: readonly string[];
      readonly employees: readonly PlannedDayEmployee[];
    }
  /** Loja sem padrão vigente/âncora para a data — estado explícito. */
  | { readonly kind: 'unconfigured'; readonly reason: string };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function civilToUtcMs(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

/** Dias civis inteiros entre duas datas (negativo se `to` < `from`). */
export function daysBetweenCivil(from: string, to: string): number {
  return Math.round((civilToUtcMs(to) - civilToUtcMs(from)) / MS_PER_DAY);
}

/**
 * Padrão VIGENTE na data: vigência cobre a data (nulls = aberto); entre
 * vários vigentes vence o de effectiveFrom mais recente (troca de escala sem
 * reescrever histórico).
 */
export function activePatternFor(
  patterns: readonly CyclePatternView[],
  date: string,
): CyclePatternView | null {
  const covering = patterns.filter(
    (pattern) =>
      (pattern.effectiveFrom === null || pattern.effectiveFrom <= date) &&
      (pattern.effectiveUntil === null || pattern.effectiveUntil >= date),
  );
  let winner: CyclePatternView | null = null;
  for (const pattern of covering) {
    if (winner === null || (pattern.effectiveFrom ?? '') > (winner.effectiveFrom ?? '')) {
      winner = pattern;
    }
  }
  return winner;
}

/**
 * A equipe trabalha nesta data? Índice do ciclo = (dias desde a âncora +
 * offset da equipe) mod tamanho do ciclo — módulo SEMPRE positivo: datas
 * anteriores à âncora resolvem a mesma rotação, consistentemente.
 */
export function teamWorksOn(
  pattern: CyclePatternView,
  anchorDate: string,
  rotationOffset: number,
  date: string,
): boolean {
  const cycle = pattern.days.length;
  if (cycle === 0) return false;
  const raw = (daysBetweenCivil(anchorDate, date) + rotationOffset) % cycle;
  const index = ((raw % cycle) + cycle) % cycle;
  return pattern.days.find((day) => day.dayIndex === index)?.works ?? false;
}

/**
 * Vínculo VIGENTE na data por colaborador (o de validFrom mais recente) —
 * regra ÚNICA de vigência de vínculo, compartilhada por resolver e troca de
 * jornada (nunca reimplementada em application/UI).
 */
export function currentAssignmentFor<
  T extends {
    readonly employeeId: string;
    readonly validFrom: string;
    readonly validUntil: string | null;
  },
>(assignments: readonly T[], employeeId: string, date: string): T | null {
  let current: T | null = null;
  for (const assignment of assignments) {
    if (assignment.employeeId !== employeeId) continue;
    if (assignment.validFrom > date) continue;
    if (assignment.validUntil !== null && assignment.validUntil < date) continue;
    if (current === null || assignment.validFrom > current.validFrom) current = assignment;
  }
  return current;
}

/**
 * Fonte ÚNICA de "quem está escalado (planejado) nesta loja, nesta data".
 * store + operationalDate + configuração da loja — nunca uma escala global.
 */
export function resolvePlannedDay(input: ResolvePlannedDayInput): PlannedDayDecision {
  const anchorDate = input.anchorDate;
  if (!CIVIL_DATE.test(input.operationalDate)) {
    return { kind: 'unconfigured', reason: 'data operacional inválida' };
  }
  if (anchorDate === null || !CIVIL_DATE.test(anchorDate)) {
    return { kind: 'unconfigured', reason: 'loja sem âncora de rotação configurada' };
  }
  const pattern = activePatternFor(input.patterns, input.operationalDate);
  if (pattern === null) {
    return { kind: 'unconfigured', reason: 'nenhum padrão de escala vigente para a data' };
  }
  if (pattern.days.length === 0) {
    return { kind: 'unconfigured', reason: 'padrão de escala sem dias definidos' };
  }

  const scheduledTeamIds = input.teams
    .filter((team) => teamWorksOn(pattern, anchorDate, team.rotationOffset, input.operationalDate))
    .map((team) => team.id);
  const scheduledTeams = new Set(scheduledTeamIds);

  const employees: PlannedDayEmployee[] = [];
  for (const employee of input.employees) {
    if (!employee.active) continue;
    const assignment = currentAssignmentFor(input.assignments, employee.id, input.operationalDate);
    if (assignment === null || assignment.teamId === null) continue;
    if (!scheduledTeams.has(assignment.teamId)) continue;
    employees.push({
      employeeId: employee.id,
      teamId: assignment.teamId,
      positionId: assignment.positionId,
      shiftDefinitionId: assignment.shiftDefinitionId,
    });
  }

  return {
    kind: 'resolved',
    patternId: pattern.id,
    patternName: pattern.name,
    scheduledTeamIds,
    employees,
  };
}
