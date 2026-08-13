// Catálogo INICIAL da operação (Gestão de Equipe) — Equipes A/B e as
// posições operacionais reais do açougue, como DADOS (linhas com id fixo),
// nunca enum. Semeado idempotentemente no boot do composition root; quando o
// backend real chegar, este baseline migra para os seeds oficiais do banco
// (pendência registrada). Não é identidade fictícia: é o cadastro base da
// loja — por isso vive fora de fixtures.ts e não é bloqueado em produção.

import type { OperationalPositionRecord, TeamRecord } from '@tauros/contracts';

import type { LocalWorkforceRepository } from './adapters.js';

export function baselineTeams(storeId: string): readonly TeamRecord[] {
  return [
    { id: 'team-a', storeId, name: 'Equipe A' },
    { id: 'team-b', storeId, name: 'Equipe B' },
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
 * Garante o baseline SEM sobrescrever nada existente (idempotente por id).
 * Executa no boot (reconciliação) — antes de qualquer leitura da UI.
 */
export async function ensureWorkforceBaseline(
  workforce: LocalWorkforceRepository,
  storeId: string,
): Promise<void> {
  const [teams, positions] = await Promise.all([
    workforce.teams(storeId),
    workforce.positions(storeId),
  ]);
  const teamIds = new Set(teams.map((team) => team.id));
  for (const team of baselineTeams(storeId)) {
    if (!teamIds.has(team.id)) await workforce.saveTeam(team);
  }
  const positionIds = new Set(positions.map((position) => position.id));
  for (const position of baselinePositions(storeId)) {
    if (!positionIds.has(position.id)) await workforce.savePosition(position);
  }
}
