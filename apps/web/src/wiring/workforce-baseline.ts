// Catálogo INICIAL da operação (Gestão de Equipe) — Equipes A/B e as
// posições operacionais reais do açougue, como DADOS (linhas com id fixo),
// nunca enum. Semeado idempotentemente no boot do composition root; quando o
// backend real chegar, este baseline migra para os seeds oficiais do banco
// (pendência registrada). Não é identidade fictícia: é o cadastro base da
// loja — por isso vive fora de fixtures.ts e não é bloqueado em produção.

import type {
  OperationalPositionRecord,
  ShiftDefinitionRecord,
  ShiftPatternRecord,
  TeamRecord,
} from '@tauros/contracts';

import type { LocalScheduleRepository, LocalWorkforceRepository } from './adapters.js';

export function baselineTeams(storeId: string): readonly TeamRecord[] {
  // offsets 0/1 = posições no ciclo do padrão INICIAL desta loja (12x36).
  // É DADO da equipe, não regra: outra loja configura outros offsets/padrões.
  return [
    { id: 'team-a', storeId, name: 'Equipe A', rotationOffset: 0 },
    { id: 'team-b', storeId, name: 'Equipe B', rotationOffset: 1 },
  ];
}

const BASELINE_POSITIONS: readonly { id: string; key: string; name: string }[] = [
  { id: 'pos-acougueiro-1', key: 'acougueiro-1', name: 'Açougueiro 1' },
  { id: 'pos-acougueiro-2', key: 'acougueiro-2', name: 'Açougueiro 2' },
  { id: 'pos-acougueiro-3', key: 'acougueiro-3', name: 'Açougueiro 3' },
  { id: 'pos-auxiliar-acougue', key: 'auxiliar-de-acougue', name: 'Auxiliar de açougue' },
  { id: 'pos-operador-caixa', key: 'operador-de-caixa', name: 'Operador de caixa' },
  { id: 'pos-faxineira', key: 'faxineira', name: 'Faxineira' },
];

export function baselinePositions(storeId: string): readonly OperationalPositionRecord[] {
  return BASELINE_POSITIONS.map((position) => ({
    id: position.id,
    storeId,
    key: position.key,
    name: position.name,
    // baseline não nasce da fila: já é o cadastro oficial da loja
    clientCreatedAt: '2026-08-13T00:00:00.000Z',
    idempotencyKey: `position-baseline:${storeId}:${position.key}`,
    syncStatus: 'synced',
    auditCorrelationId: position.id,
  }));
}

/**
 * Jornadas iniciais da operação atual — SEEDS EDITÁVEIS (dado, não código):
 * novas janelas são criadas pela UI e ficam reutilizáveis.
 */
export function baselineShiftDefinitions(storeId: string): readonly ShiftDefinitionRecord[] {
  return [
    { startTime: '07:30', endTime: '19:30', id: 'def-0730-1930' },
    { startTime: '08:30', endTime: '20:30', id: 'def-0830-2030' },
  ].map((window) => ({
    id: window.id,
    storeId,
    name: `${window.startTime}–${window.endTime}`,
    startTime: window.startTime,
    endTime: window.endTime,
    clientCreatedAt: '2026-08-13T00:00:00.000Z',
    idempotencyKey: `shift-definition-baseline:${storeId}:${window.startTime}-${window.endTime}`,
    syncStatus: 'synced',
    auditCorrelationId: window.id,
  }));
}

/**
 * Padrão de escala INICIAL desta loja: ciclo de 2 dias [trabalha, folga]
 * (12x36) como DADO com vigência aberta. Outros padrões (semanal, dias
 * fixos) são outros registros — nunca outra regra de código.
 */
export function baselineShiftPattern(storeId: string): ShiftPatternRecord {
  return {
    id: 'pattern-12x36',
    storeId,
    name: '12x36',
    effectiveFrom: null,
    effectiveUntil: null,
    days: [
      { dayIndex: 0, works: true },
      { dayIndex: 1, works: false },
    ],
  };
}

/**
 * Garante o baseline SEM sobrescrever nada existente (idempotente por id).
 * Executa no boot (reconciliação) — antes de qualquer leitura da UI.
 */
export async function ensureWorkforceBaseline(
  workforce: LocalWorkforceRepository,
  schedule: LocalScheduleRepository,
  storeId: string,
): Promise<void> {
  const [teams, positions, definitions, patterns] = await Promise.all([
    workforce.teams(storeId),
    workforce.positions(storeId),
    schedule.definitions(storeId),
    schedule.patterns(storeId),
  ]);
  const teamById = new Map(teams.map((team) => [team.id, team]));
  for (const team of baselineTeams(storeId)) {
    const existing = teamById.get(team.id);
    if (existing === undefined) {
      await workforce.saveTeam(team);
    } else if (existing.rotationOffset !== team.rotationOffset) {
      // registro v4 (anterior à Escala V1) lê offset 0 por tolerância —
      // completa com o offset do baseline. Seguro: na V1 nenhum outro fluxo
      // escreve offsets; quando houver editor de escala, ele assume.
      await workforce.saveTeam({ ...existing, rotationOffset: team.rotationOffset });
    }
  }
  const positionIds = new Set(positions.map((position) => position.id));
  for (const position of baselinePositions(storeId)) {
    if (!positionIds.has(position.id)) await workforce.savePosition(position);
  }
  const definitionIds = new Set(definitions.map((definition) => definition.id));
  for (const definition of baselineShiftDefinitions(storeId)) {
    if (!definitionIds.has(definition.id)) await schedule.saveDefinition(definition);
  }
  const patternIds = new Set(patterns.map((pattern) => pattern.id));
  const pattern = baselineShiftPattern(storeId);
  if (!patternIds.has(pattern.id)) await schedule.savePattern(pattern);
}
