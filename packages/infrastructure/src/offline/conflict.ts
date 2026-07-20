// Infraestrutura genérica de conflitos (RA-QUEUE-01 §8).
// NÃO existe regra universal "última escrita vence": estratégias concretas são
// injetáveis por (entityType, operation) e definidas fora desta camada.

import type { QueueItem } from './queue-item.js';

export type ConflictClassification =
  'version_mismatch' | 'authorship_dispute' | 'idempotency_divergence' | 'unknown';

export interface ConflictRecord {
  readonly id: string;
  readonly itemId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly classification: ConflictClassification;
  readonly localPayload: unknown;
  readonly remoteEvidence: unknown;
  readonly detectedAt: Date;
  readonly transportMessage: string | undefined;
}

export type ConflictResolutionAction =
  | { readonly action: 'requeue'; readonly patchedPayload?: unknown }
  | { readonly action: 'discard'; readonly reason: string }
  | { readonly action: 'manual' };

/** Estratégia concreta (injetada por tipo de entidade/operação, fora desta camada). */
export interface ConflictStrategy {
  resolve(record: ConflictRecord, item: QueueItem): Promise<ConflictResolutionAction>;
}

/** Estratégia default: preservar evidência e exigir decisão humana. */
export const MANUAL_RESOLUTION: ConflictStrategy = {
  resolve: () => Promise.resolve({ action: 'manual' }),
};

/** Registry injetável: (entityType|'*', operation|'*') → estratégia. */
export class ConflictResolverRegistry {
  private readonly strategies = new Map<string, ConflictStrategy>();

  register(entityType: string, operation: string, strategy: ConflictStrategy): void {
    this.strategies.set(`${entityType}::${operation}`, strategy);
  }

  strategyFor(entityType: string, operation: string): ConflictStrategy {
    return (
      this.strategies.get(`${entityType}::${operation}`) ??
      this.strategies.get(`${entityType}::*`) ??
      this.strategies.get(`*::${operation}`) ??
      this.strategies.get('*::*') ??
      MANUAL_RESOLUTION
    );
  }
}

/** Constrói o registro de conflito preservando evidências local e remota. */
export function buildConflictRecord(
  item: QueueItem,
  classification: ConflictClassification,
  remoteEvidence: unknown,
  transportMessage: string | undefined,
  now: Date,
): ConflictRecord {
  return {
    id: `conflict:${item.id}:${now.getTime()}`,
    itemId: item.id,
    entityType: item.entityType,
    entityId: item.entityId,
    classification,
    localPayload: item.payload,
    remoteEvidence,
    detectedAt: now,
    transportMessage,
  };
}
