// Máquina de estados da fila (RA-QUEUE-01 §3 · SAS §6).
// Os 8 estados são um autômato FECHADO: transições fora da tabela falham
// explicitamente (InvalidTransitionError) — nunca strings soltas pelo código.

import type { TechnicalEventType } from './events.js';
import { QUEUE_STATES, type QueueState } from './states.js';

export { QUEUE_STATES, type QueueState };

export type TransitionTrigger =
  | 'DEPS_SATISFIED'
  | 'LEASE_ACQUIRED'
  | 'SERVER_PERSISTED'
  | 'TRANSIENT_ERROR'
  | 'PERMANENT_ERROR'
  | 'CONFLICT_DETECTED'
  | 'REVIEW_REQUIRED'
  | 'BACKOFF_ELAPSED'
  | 'RESOLVED_REQUEUE'
  | 'DISCARDED'
  | 'LEASE_EXPIRED'
  | 'CANCELLED'
  | 'DEPENDENCY_MISSING';

export interface TransitionDefinition {
  readonly from: QueueState;
  readonly trigger: TransitionTrigger;
  readonly to: QueueState;
  /** O item ainda pode voltar ao fluxo automático a partir do destino. */
  readonly retryable: boolean;
  /** Exige decisão humana autorizada para sair do destino. */
  readonly requiresIntervention: boolean;
  readonly technicalEvent: TechnicalEventType;
}

/** Tabela ÚNICA de transições — a documentação executável da máquina. */
export const TRANSITIONS: readonly TransitionDefinition[] = [
  {
    from: 'BLOCKED_BY_DEPENDENCY',
    trigger: 'DEPS_SATISFIED',
    to: 'PENDING',
    retryable: true,
    requiresIntervention: false,
    technicalEvent: 'queue_changed',
  },
  {
    from: 'PENDING',
    trigger: 'LEASE_ACQUIRED',
    to: 'SYNCING',
    retryable: true,
    requiresIntervention: false,
    technicalEvent: 'sync_started',
  },
  {
    from: 'SYNCING',
    trigger: 'SERVER_PERSISTED',
    to: 'SYNCED',
    retryable: false,
    requiresIntervention: false,
    technicalEvent: 'sync_finished',
  },
  {
    from: 'SYNCING',
    trigger: 'TRANSIENT_ERROR',
    to: 'RETRY_SCHEDULED',
    retryable: true,
    requiresIntervention: false,
    technicalEvent: 'retry_scheduled',
  },
  {
    from: 'SYNCING',
    trigger: 'PERMANENT_ERROR',
    to: 'PERMANENT_FAILURE',
    retryable: false,
    requiresIntervention: true,
    technicalEvent: 'item_failed',
  },
  {
    from: 'SYNCING',
    trigger: 'CONFLICT_DETECTED',
    to: 'CONFLICT',
    retryable: false,
    requiresIntervention: true,
    technicalEvent: 'conflict_detected',
  },
  {
    from: 'SYNCING',
    trigger: 'REVIEW_REQUIRED',
    to: 'NEEDS_REVIEW',
    retryable: false,
    requiresIntervention: true,
    technicalEvent: 'review_required',
  },
  {
    from: 'SYNCING',
    trigger: 'LEASE_EXPIRED',
    to: 'PENDING',
    retryable: true,
    requiresIntervention: false,
    technicalEvent: 'lease_reclaimed',
  },
  {
    from: 'SYNCING',
    trigger: 'CANCELLED',
    to: 'PENDING',
    retryable: true,
    requiresIntervention: false,
    technicalEvent: 'sync_cancelled',
  },
  {
    from: 'BLOCKED_BY_DEPENDENCY',
    trigger: 'DEPENDENCY_MISSING',
    to: 'NEEDS_REVIEW',
    retryable: false,
    requiresIntervention: true,
    technicalEvent: 'dependency_missing',
  },
  {
    from: 'RETRY_SCHEDULED',
    trigger: 'BACKOFF_ELAPSED',
    to: 'PENDING',
    retryable: true,
    requiresIntervention: false,
    technicalEvent: 'queue_changed',
  },
  {
    from: 'CONFLICT',
    trigger: 'RESOLVED_REQUEUE',
    to: 'PENDING',
    retryable: true,
    requiresIntervention: true,
    technicalEvent: 'conflict_resolved',
  },
  {
    from: 'NEEDS_REVIEW',
    trigger: 'RESOLVED_REQUEUE',
    to: 'PENDING',
    retryable: true,
    requiresIntervention: true,
    technicalEvent: 'review_resolved',
  },
  {
    from: 'CONFLICT',
    trigger: 'DISCARDED',
    to: 'PERMANENT_FAILURE',
    retryable: false,
    requiresIntervention: true,
    technicalEvent: 'item_discarded',
  },
  {
    from: 'NEEDS_REVIEW',
    trigger: 'DISCARDED',
    to: 'PERMANENT_FAILURE',
    retryable: false,
    requiresIntervention: true,
    technicalEvent: 'item_discarded',
  },
];

export class InvalidTransitionError extends Error {
  constructor(
    readonly fromState: QueueState,
    readonly trigger: TransitionTrigger,
  ) {
    super(
      `Transição inválida: ${fromState} --${trigger}-->. ` +
        `Consulte TRANSITIONS para o autômato permitido.`,
    );
    this.name = 'InvalidTransitionError';
  }
}

/** Resolve a transição ou falha explicitamente. */
export function transition(from: QueueState, trigger: TransitionTrigger): TransitionDefinition {
  const def = TRANSITIONS.find((t) => t.from === from && t.trigger === trigger);
  if (!def) throw new InvalidTransitionError(from, trigger);
  return def;
}

/** Estados a partir dos quais o processamento automático pode agir. */
export function isAutomaticallyProcessable(state: QueueState): boolean {
  return state === 'PENDING' || state === 'RETRY_SCHEDULED' || state === 'BLOCKED_BY_DEPENDENCY';
}
