// Processador da fila (RA-QUEUE-01 §4/§5/§7/§8).
// Lease com FENCING TOKEN: só o portador do token vigente persiste desfechos
// (§6). Cancelamento cooperativo via AbortSignal (§8): item volta a PENDING,
// nunca vira falha permanente. Snapshot expirado nunca é enviado às cegas.

import { isSnapshotValid } from './authorization-snapshot.js';
import { buildConflictRecord, type ConflictResolverRegistry } from './conflict.js';
import { makeEvent, type TechnicalEventPort } from './events.js';
import type { OfflineTechnicalParameters } from './offline-parameters.js';
import type { ErrorClassification, QueueItem } from './queue-item.js';
import type { LocalQueueRepository } from './queue-repository.js';
import type { RetryPolicy } from './retry-policy.js';
import { transition, type TransitionTrigger } from './state-machine.js';
import type { SyncTransportPort } from './sync-transport.js';

export interface ProcessResult {
  readonly itemId: string;
  readonly finalState: QueueItem['state'];
  readonly trigger: TransitionTrigger | 'SKIPPED' | 'FENCED';
}

export class QueueProcessor {
  constructor(
    private readonly repo: LocalQueueRepository,
    private readonly transport: SyncTransportPort,
    private readonly retry: RetryPolicy,
    private readonly conflicts: ConflictResolverRegistry,
    private readonly events: TechnicalEventPort,
    private readonly clock: () => Date,
    private readonly params: Pick<OfflineTechnicalParameters, 'instanceId' | 'leaseTtlMs'>,
  ) {}

  /** Processa UM item. Toda persistência pós-claim é guardada pelo token. */
  async process(itemId: string, signal?: AbortSignal): Promise<ProcessResult> {
    const leased = await this.repo.claimLease(
      itemId,
      this.params.instanceId,
      this.params.leaseTtlMs,
    );
    if (leased === undefined) {
      const current = await this.repo.get(itemId);
      return { itemId, finalState: current?.state ?? 'SYNCED', trigger: 'SKIPPED' };
    }
    const token = leased.lease!.token;

    const started = this.applyTransition(leased, 'LEASE_ACQUIRED');
    if (!(await this.repo.putIfLeaseHolder(started, token))) {
      return { itemId, finalState: started.state, trigger: 'FENCED' };
    }

    // Cancelamento cooperativo ANTES do envio: volta a PENDING, lease liberada.
    if (signal?.aborted) {
      return this.finalize(started, token, 'CANCELLED', { clearLease: true });
    }

    // Snapshot expirado ⇒ revisão local, sem envio cego (Confidence Before Speed).
    if (!isSnapshotValid(started.authorization, this.clock())) {
      this.events.emit(
        makeEvent(
          { eventType: 'snapshot_expired', queueItemId: itemId, storeId: started.trace.storeId },
          this.clock(),
        ),
      );
      return this.finalize(
        this.withError(
          started,
          'AUTHORSHIP_REVIEW',
          'Snapshot de autorização expirado antes do envio.',
        ),
        token,
        'REVIEW_REQUIRED',
        { clearLease: true },
      );
    }

    const attempted: QueueItem = {
      ...started,
      attemptCount: started.attemptCount + 1,
      lastAttemptAt: this.clock(),
    };

    const outcome = await this.transport.submit(attempted);

    // Cancelado DURANTE o envio: o desfecho remoto (se houve) será reconciliado
    // pela idempotência no próximo retry; localmente volta a PENDING.
    if (signal?.aborted && outcome.kind === 'transient') {
      return this.finalize(attempted, token, 'CANCELLED', { clearLease: true });
    }

    switch (outcome.kind) {
      case 'persisted':
        return this.finalize({ ...attempted, lastError: undefined }, token, 'SERVER_PERSISTED', {
          clearLease: true,
        });

      case 'review':
        return this.finalize(
          this.withError(attempted, 'AUTHORSHIP_REVIEW', outcome.reason),
          token,
          'REVIEW_REQUIRED',
          { clearLease: true },
        );

      case 'conflict': {
        const record = buildConflictRecord(
          attempted,
          outcome.classification,
          outcome.remoteEvidence,
          outcome.message,
          this.clock(),
        );
        await this.repo.saveConflict(record as never);

        const conflictResult = await this.finalize(
          this.withError(attempted, 'CONFLICT', outcome.message),
          token,
          'CONFLICT_DETECTED',
          { clearLease: false },
        );
        if (conflictResult.trigger === 'FENCED') return conflictResult;

        const strategy = this.conflicts.strategyFor(attempted.entityType, attempted.operation);
        const resolution = await strategy.resolve(record, (await this.repo.get(itemId))!);
        if (resolution.action === 'requeue') {
          const conflicted = (await this.repo.get(itemId))!;
          const requeued = this.applyTransition(conflicted, 'RESOLVED_REQUEUE');
          const persisted = await this.repo.putIfLeaseHolder(
            {
              ...requeued,
              payload: resolution.patchedPayload ?? requeued.payload,
              lease: undefined,
            },
            token,
          );
          return persisted
            ? { itemId, finalState: requeued.state, trigger: 'RESOLVED_REQUEUE' }
            : { itemId, finalState: conflicted.state, trigger: 'FENCED' };
        }
        if (resolution.action === 'discard') {
          const conflicted = (await this.repo.get(itemId))!;
          const discarded = this.applyTransition(conflicted, 'DISCARDED');
          const persisted = await this.repo.putIfLeaseHolder(
            { ...discarded, lease: undefined },
            token,
          );
          return persisted
            ? { itemId, finalState: discarded.state, trigger: 'DISCARDED' }
            : { itemId, finalState: conflicted.state, trigger: 'FENCED' };
        }
        // manual: preserva CONFLICT com lease liberada
        const conflicted = (await this.repo.get(itemId))!;
        await this.repo.putIfLeaseHolder({ ...conflicted, lease: undefined }, token);
        return { itemId, finalState: 'CONFLICT', trigger: 'CONFLICT_DETECTED' };
      }

      case 'rejected':
        return this.finalize(
          this.withError(attempted, 'PERMANENT', outcome.message),
          token,
          'PERMANENT_ERROR',
          { clearLease: true },
        );

      case 'transient': {
        const classification = outcome.authExpired ? 'AUTH_RETRYABLE' : 'RECOVERABLE';
        const decision = await this.retry.decide(
          attempted.attemptCount,
          classification,
          attempted.trace.storeId,
          outcome.retryAfterMs,
        );

        if (!decision.retry) {
          return this.finalize(
            this.withError(
              attempted,
              'PERMANENT',
              `Tentativas esgotadas (${attempted.attemptCount}): ${outcome.message}`,
            ),
            token,
            'PERMANENT_ERROR',
            { clearLease: true },
          );
        }

        return this.finalize(
          {
            ...this.withError(attempted, classification, outcome.message),
            nextAttemptAt: new Date(this.clock().getTime() + decision.delayMs),
          },
          token,
          'TRANSIENT_ERROR',
          { clearLease: true, attempt: attempted.attemptCount },
        );
      }
    }
  }

  /** Persiste o desfecho SOMENTE se ainda formos o portador do token (§6). */
  private async finalize(
    item: QueueItem,
    token: string,
    trigger: TransitionTrigger,
    opts: { clearLease: boolean; attempt?: number },
  ): Promise<ProcessResult> {
    const next = this.applyTransition(item, trigger, opts.attempt);
    const toPersist: QueueItem = opts.clearLease ? { ...next, lease: undefined } : next;
    const persisted = await this.repo.putIfLeaseHolder(toPersist, token);
    if (!persisted) {
      // Worker antigo: outro processador assumiu — nada foi gravado por nós.
      const current = await this.repo.get(item.id);
      return { itemId: item.id, finalState: current?.state ?? next.state, trigger: 'FENCED' };
    }
    return { itemId: item.id, finalState: next.state, trigger };
  }

  private withError(
    item: QueueItem,
    classification: ErrorClassification,
    message: string,
  ): QueueItem {
    return { ...item, lastError: { classification, message, at: this.clock() } };
  }

  private applyTransition(
    item: QueueItem,
    trigger: TransitionTrigger,
    attempt?: number,
  ): QueueItem {
    const def = transition(item.state, trigger);
    this.events.emit(
      makeEvent(
        {
          eventType: def.technicalEvent,
          queueItemId: item.id,
          storeId: item.trace.storeId,
          sessionId: item.trace.sessionId,
          correlationId: item.idempotencyKey,
          attempt: attempt ?? item.attemptCount,
          previousState: item.state,
          nextState: def.to,
          error: item.lastError
            ? { name: item.lastError.classification, message: item.lastError.message }
            : undefined,
        },
        this.clock(),
      ),
    );
    return { ...item, state: def.to };
  }
}
