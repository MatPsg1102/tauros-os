// Processador da fila (RA-QUEUE-01 §4/§5/§7/§8).
// Lease atômico impede processamento duplo; toda mudança de estado passa pela
// máquina; snapshot expirado NUNCA é enviado às cegas; conflito preserva
// evidência e consulta a estratégia injetada.

import { isSnapshotValid } from './authorization-snapshot.js';
import { buildConflictRecord, type ConflictResolverRegistry } from './conflict.js';
import type { TechnicalEventPort } from './events.js';
import type { QueueItem } from './queue-item.js';
import type { LocalQueueRepository } from './queue-repository.js';
import type { RetryPolicy } from './retry-policy.js';
import { transition, type TransitionTrigger } from './state-machine.js';
import type { SyncTransportPort } from './sync-transport.js';

export interface ProcessResult {
  readonly itemId: string;
  readonly finalState: QueueItem['state'];
  readonly trigger: TransitionTrigger | 'SKIPPED';
}

export interface ProcessorOptions {
  /** Identifica esta instância (lease owner). */
  readonly instanceId: string;
  /** TTL da lease local; expirada ⇒ recuperável após crash. */
  readonly leaseTtlMs: number;
}

export class QueueProcessor {
  constructor(
    private readonly repo: LocalQueueRepository,
    private readonly transport: SyncTransportPort,
    private readonly retry: RetryPolicy,
    private readonly conflicts: ConflictResolverRegistry,
    private readonly events: TechnicalEventPort,
    private readonly clock: () => Date,
    private readonly options: ProcessorOptions,
  ) {}

  /** Processa UM item (lease → SYNCING → desfecho). Idempotente e crash-safe. */
  async process(itemId: string): Promise<ProcessResult> {
    const leased = await this.repo.claimLease(
      itemId,
      this.options.instanceId,
      this.options.leaseTtlMs,
    );
    if (leased === undefined) {
      // Já SYNCED, em processamento por outra instância ou não elegível.
      const current = await this.repo.get(itemId);
      return { itemId, finalState: current?.state ?? 'SYNCED', trigger: 'SKIPPED' };
    }

    const started = this.applyTransition(leased, 'LEASE_ACQUIRED');
    await this.repo.put(started);

    // Snapshot expirado ⇒ revisão local; o servidor seguiria sendo a autoridade,
    // mas não enviamos algo já sabidamente inválido (Confidence Before Speed).
    if (!isSnapshotValid(started.authorization, this.clock())) {
      this.events.emit({ type: 'snapshot_expired', at: this.clock(), itemId });
      const reviewed = this.applyTransition(
        {
          ...started,
          lastError: {
            classification: 'AUTHORSHIP_REVIEW',
            message: 'Snapshot de autorização expirado antes do envio.',
            at: this.clock(),
          },
        },
        'REVIEW_REQUIRED',
      );
      await this.repo.put({ ...reviewed, lease: undefined });
      return { itemId, finalState: reviewed.state, trigger: 'REVIEW_REQUIRED' };
    }

    const attempted: QueueItem = {
      ...started,
      attemptCount: started.attemptCount + 1,
      lastAttemptAt: this.clock(),
    };

    const outcome = await this.transport.submit(attempted);

    switch (outcome.kind) {
      case 'persisted': {
        const done = this.applyTransition(attempted, 'SERVER_PERSISTED');
        await this.repo.put({ ...done, lease: undefined, lastError: undefined });
        return { itemId, finalState: done.state, trigger: 'SERVER_PERSISTED' };
      }

      case 'review': {
        const reviewed = this.applyTransition(
          {
            ...attempted,
            lastError: {
              classification: 'AUTHORSHIP_REVIEW',
              message: outcome.reason,
              at: this.clock(),
            },
          },
          'REVIEW_REQUIRED',
        );
        await this.repo.put({ ...reviewed, lease: undefined });
        return { itemId, finalState: reviewed.state, trigger: 'REVIEW_REQUIRED' };
      }

      case 'conflict': {
        const record = buildConflictRecord(
          attempted,
          outcome.classification,
          outcome.remoteEvidence,
          outcome.message,
          this.clock(),
        );
        await this.repo.saveConflict(record as never);

        const conflicted = this.applyTransition(
          {
            ...attempted,
            lastError: { classification: 'CONFLICT', message: outcome.message, at: this.clock() },
          },
          'CONFLICT_DETECTED',
        );
        await this.repo.put({ ...conflicted, lease: undefined });

        // Estratégia injetada decide o encaminhamento (default: manual).
        const strategy = this.conflicts.strategyFor(attempted.entityType, attempted.operation);
        const resolution = await strategy.resolve(record, conflicted);
        if (resolution.action === 'requeue') {
          const requeued = this.applyTransition(conflicted, 'RESOLVED_REQUEUE');
          await this.repo.put({
            ...requeued,
            payload: resolution.patchedPayload ?? requeued.payload,
          });
          return { itemId, finalState: requeued.state, trigger: 'RESOLVED_REQUEUE' };
        }
        if (resolution.action === 'discard') {
          const discarded = this.applyTransition(conflicted, 'DISCARDED');
          await this.repo.put(discarded);
          return { itemId, finalState: discarded.state, trigger: 'DISCARDED' };
        }
        return { itemId, finalState: conflicted.state, trigger: 'CONFLICT_DETECTED' };
      }

      case 'rejected': {
        const failed = this.applyTransition(
          {
            ...attempted,
            lastError: { classification: 'PERMANENT', message: outcome.message, at: this.clock() },
          },
          'PERMANENT_ERROR',
        );
        await this.repo.put({ ...failed, lease: undefined });
        return { itemId, finalState: failed.state, trigger: 'PERMANENT_ERROR' };
      }

      case 'transient': {
        const classification = outcome.authExpired ? 'AUTH_RETRYABLE' : 'RECOVERABLE';
        const decision = await this.retry.decide(
          attempted.attemptCount,
          classification,
          attempted.trace.storeId,
          outcome.retryAfterMs,
        );

        if (!decision.retry) {
          const exhausted = this.applyTransition(
            {
              ...attempted,
              lastError: {
                classification: 'PERMANENT',
                message: `Tentativas esgotadas (${attempted.attemptCount}): ${outcome.message}`,
                at: this.clock(),
              },
            },
            'PERMANENT_ERROR',
          );
          await this.repo.put({ ...exhausted, lease: undefined });
          return { itemId, finalState: exhausted.state, trigger: 'PERMANENT_ERROR' };
        }

        const scheduled = this.applyTransition(
          {
            ...attempted,
            lastError: { classification, message: outcome.message, at: this.clock() },
            nextAttemptAt: new Date(this.clock().getTime() + decision.delayMs),
          },
          'TRANSIENT_ERROR',
        );
        await this.repo.put({ ...scheduled, lease: undefined });
        return { itemId, finalState: scheduled.state, trigger: 'TRANSIENT_ERROR' };
      }
    }
  }

  private applyTransition(item: QueueItem, trigger: TransitionTrigger): QueueItem {
    const def = transition(item.state, trigger);
    this.events.emit({ type: def.technicalEvent, at: this.clock(), itemId: item.id });
    return { ...item, state: def.to };
  }
}
