// Item da fila offline (RA-QUEUE-01 §2).
// entityType/entityId são OPACOS: esta camada nunca conhece Task, Inventory etc.

import type { AuthorizationSnapshot } from './authorization-snapshot.js';
import type { QueueState } from './state-machine.js';

export type QueueOperation = 'insert' | 'update' | 'upload';

export type ErrorClassification =
  'RECOVERABLE' | 'AUTH_RETRYABLE' | 'CONFLICT' | 'AUTHORSHIP_REVIEW' | 'PERMANENT';

export interface QueueItemError {
  readonly classification: ErrorClassification;
  readonly message: string;
  readonly at: Date;
}

export interface QueueTrace {
  readonly storeId: string;
  readonly deviceId: string;
  readonly sessionId: string;
  readonly schemaVersion: number;
  readonly priority: number;
}

export interface QueueLease {
  readonly owner: string;
  readonly expiresAt: Date;
}

export interface QueueItem {
  readonly id: string;
  readonly operation: QueueOperation;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload: unknown;
  readonly dependsOn: readonly string[];
  readonly idempotencyKey: string;
  readonly attemptCount: number;
  readonly state: QueueState;
  readonly createdAt: Date;
  readonly nextAttemptAt: Date | undefined;
  readonly lastAttemptAt: Date | undefined;
  readonly lastError: QueueItemError | undefined;
  readonly authorization: AuthorizationSnapshot;
  readonly trace: QueueTrace;
  readonly lease: QueueLease | undefined;
}

export interface NewQueueItem {
  readonly id: string;
  readonly operation: QueueOperation;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload: unknown;
  readonly dependsOn?: readonly string[];
  readonly idempotencyKey: string;
  readonly authorization: AuthorizationSnapshot;
  readonly trace: QueueTrace;
}

/** Cria o item no estado inicial correto (PENDING ou BLOCKED_BY_DEPENDENCY). */
export function createQueueItem(
  input: NewQueueItem,
  now: Date,
  hasUnresolvedDependencies: boolean,
): QueueItem {
  return {
    id: input.id,
    operation: input.operation,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    dependsOn: [...(input.dependsOn ?? [])],
    idempotencyKey: input.idempotencyKey,
    attemptCount: 0,
    state: hasUnresolvedDependencies ? 'BLOCKED_BY_DEPENDENCY' : 'PENDING',
    createdAt: now,
    nextAttemptAt: undefined,
    lastAttemptAt: undefined,
    lastError: undefined,
    authorization: input.authorization,
    trace: input.trace,
    lease: undefined,
  };
}
