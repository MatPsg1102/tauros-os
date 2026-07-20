// DAG de dependências da fila (RA-QUEUE-01 §2).
// Prontidão: todas as dependências SYNCED. Ciclo: erro técnico auditável
// no ENFILEIRAMENTO — nunca um travamento silencioso da fila inteira.

import type { QueueItem } from './queue-item.js';

export class CycleDetectedError extends Error {
  constructor(readonly cycle: readonly string[]) {
    super(
      `Ciclo de dependências detectado na fila: ${cycle.join(' -> ')}. ` +
        `O item foi rejeitado; corrija as dependências e reenfileire.`,
    );
    this.name = 'CycleDetectedError';
  }
}

/** Dependências não concluídas de um item (ids ausentes contam como concluídos*). */
export function unresolvedDependencies(
  item: Pick<QueueItem, 'dependsOn'>,
  byId: ReadonlyMap<string, QueueItem>,
): readonly string[] {
  // *Itens removidos da fila só saem quando SYNCED (limpeza segura),
  //  logo dependência ausente = concluída e limpa.
  return item.dependsOn.filter((depId) => {
    const dep = byId.get(depId);
    return dep !== undefined && dep.state !== 'SYNCED';
  });
}

/** Um item está pronto quando não há dependência pendente. */
export function dependenciesSatisfied(
  item: Pick<QueueItem, 'dependsOn'>,
  byId: ReadonlyMap<string, QueueItem>,
): boolean {
  return unresolvedDependencies(item, byId).length === 0;
}

/**
 * Garante aciclicidade considerando os itens atuais + o candidato.
 * DFS com pilha de caminho; lança CycleDetectedError com o ciclo nomeado.
 */
export function assertAcyclic(
  candidate: Pick<QueueItem, 'id' | 'dependsOn'>,
  byId: ReadonlyMap<string, QueueItem>,
): void {
  const edges = new Map<string, readonly string[]>();
  for (const [id, item] of byId) edges.set(id, item.dependsOn);
  edges.set(candidate.id, candidate.dependsOn);

  const visited = new Set<string>();
  const inPath = new Set<string>();
  const path: string[] = [];

  const visit = (node: string): void => {
    if (inPath.has(node)) {
      const start = path.indexOf(node);
      throw new CycleDetectedError([...path.slice(start), node]);
    }
    if (visited.has(node)) return;
    visited.add(node);
    inPath.add(node);
    path.push(node);
    for (const dep of edges.get(node) ?? []) {
      if (edges.has(dep)) visit(dep);
    }
    path.pop();
    inPath.delete(node);
  };

  visit(candidate.id);
}
