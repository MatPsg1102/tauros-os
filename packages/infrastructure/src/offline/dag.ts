// DAG de dependências da fila (RA-QUEUE-01 §2 · validação §5).
// Ausência de dependência NÃO é sucesso automático: só conta como concluída
// com EVIDÊNCIA (item SYNCED presente, ou tombstone de remoção pós-conclusão).

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

/** Dependência referenciada no enqueue sem existir e sem evidência de conclusão. */
export class InvalidDependencyError extends Error {
  constructor(
    itemId: string,
    readonly missing: readonly string[],
  ) {
    super(
      `Dependências inválidas para "${itemId}": ${missing.join(', ')} — ` +
        `não existem na fila nem possuem evidência de conclusão. ` +
        `Enfileire as dependências primeiro.`,
    );
    this.name = 'InvalidDependencyError';
  }
}

/** Resolução explícita de UMA dependência (§5). */
export type DependencyResolution =
  /** Presente e SYNCED. */
  | 'completed'
  /** Removida pela limpeza segura APÓS conclusão (tombstone). */
  | 'completed-removed'
  /** Presente, ainda não concluída. */
  | 'pending'
  /** Presente, mas MORTA: PERMANENT_FAILURE não tem transição de saída. */
  | 'dead'
  /** Ausente SEM evidência — corrupção/remoção indevida/referência inválida. */
  | 'missing';

export function resolveDependency(
  depId: string,
  byId: ReadonlyMap<string, QueueItem>,
  tombstones: ReadonlySet<string>,
): DependencyResolution {
  const dep = byId.get(depId);
  if (dep !== undefined) {
    if (dep.state === 'SYNCED') return 'completed';
    // PERMANENT_FAILURE é terminal absoluto (a máquina não tem saída dele):
    // o dependente NUNCA destravaria — 'pending' aqui seria espera eterna.
    // NEEDS_REVIEW/CONFLICT seguem 'pending': intervenção pode requeue e o
    // dependente destrava sozinho quando a dependência sincronizar.
    if (dep.state === 'PERMANENT_FAILURE') return 'dead';
    return 'pending';
  }
  return tombstones.has(depId) ? 'completed-removed' : 'missing';
}

export interface DependencyStatus {
  readonly satisfied: boolean;
  readonly pending: readonly string[];
  readonly missing: readonly string[];
}

/** Estado agregado das dependências: satisfeito só com evidência para todas. */
export function dependencyStatus(
  item: Pick<QueueItem, 'dependsOn'>,
  byId: ReadonlyMap<string, QueueItem>,
  tombstones: ReadonlySet<string>,
): DependencyStatus {
  const pending: string[] = [];
  const missing: string[] = [];
  for (const depId of item.dependsOn) {
    const resolution = resolveDependency(depId, byId, tombstones);
    if (resolution === 'pending') pending.push(depId);
    // dependência morta recebe o MESMO destino da ausente: o dependente vai
    // a NEEDS_REVIEW (visível como falha) em vez de esperar para sempre
    else if (resolution === 'missing' || resolution === 'dead') missing.push(depId);
  }
  return { satisfied: pending.length === 0 && missing.length === 0, pending, missing };
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
