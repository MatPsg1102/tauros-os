// Scheduler da fila (RA-QUEUE-01 §4 · dependências §5).
// Promove por evidência: dependência ausente SEM tombstone ⇒ NEEDS_REVIEW,
// nunca liberação indevida.

import type { ConfigResolver } from '@tauros/config-engine';

import { dependencyStatus } from './dag.js';
import { makeEvent, type TechnicalEventPort } from './events.js';
import type { QueueItem } from './queue-item.js';
import type { LocalQueueRepository } from './queue-repository.js';
import { transition } from './state-machine.js';

export class QueueScheduler {
  constructor(
    private readonly repo: LocalQueueRepository,
    private readonly config: ConfigResolver,
    private readonly events: TechnicalEventPort,
    private readonly clock: () => Date,
  ) {}

  /**
   * Promoções:
   * - BLOCKED com deps concluídas (com evidência) → PENDING;
   * - BLOCKED com dep AUSENTE sem evidência → NEEDS_REVIEW (dependency_missing);
   * - RETRY_SCHEDULED com backoff vencido → PENDING.
   */
  async promote(): Promise<void> {
    const now = this.clock();
    const all = await this.repo.all();
    const byId = new Map(all.map((i) => [i.id, i] as const));
    const tombstones = await this.repo.tombstoneIds();

    for (const item of all) {
      if (item.state === 'BLOCKED_BY_DEPENDENCY') {
        const status = dependencyStatus(item, byId, tombstones);
        if (status.missing.length > 0) {
          const def = transition(item.state, 'DEPENDENCY_MISSING');
          await this.repo.put({ ...item, state: def.to });
          this.events.emit(
            makeEvent(
              {
                eventType: def.technicalEvent,
                queueItemId: item.id,
                storeId: item.trace.storeId,
                previousState: item.state,
                nextState: def.to,
                error: {
                  name: 'MissingDependencyEvidence',
                  message: `Dependências sem evidência de conclusão: ${status.missing.join(', ')}`,
                },
              },
              now,
            ),
          );
        } else if (status.satisfied) {
          const def = transition(item.state, 'DEPS_SATISFIED');
          await this.repo.put({ ...item, state: def.to });
          this.events.emit(
            makeEvent(
              {
                eventType: def.technicalEvent,
                queueItemId: item.id,
                storeId: item.trace.storeId,
                previousState: item.state,
                nextState: def.to,
              },
              now,
            ),
          );
        }
      } else if (
        item.state === 'RETRY_SCHEDULED' &&
        (item.nextAttemptAt === undefined || item.nextAttemptAt.getTime() <= now.getTime())
      ) {
        const def = transition(item.state, 'BACKOFF_ELAPSED');
        await this.repo.put({ ...item, state: def.to, nextAttemptAt: undefined });
        this.events.emit(
          makeEvent(
            {
              eventType: def.technicalEvent,
              queueItemId: item.id,
              storeId: item.trace.storeId,
              previousState: item.state,
              nextState: def.to,
            },
            now,
          ),
        );
      }
    }
  }

  /**
   * Prontos: PENDING, fora de backoff, deps satisfeitas COM evidência —
   * ordem por prioridade/criação; tamanho = sync.concurrency.max.
   */
  async selectReady(): Promise<readonly QueueItem[]> {
    const now = this.clock();
    const limit = await this.config.resolve('sync.concurrency.max');
    const all = await this.repo.all();
    const byId = new Map(all.map((i) => [i.id, i] as const));
    const tombstones = await this.repo.tombstoneIds();

    return all
      .filter(
        (i) =>
          i.state === 'PENDING' &&
          (i.nextAttemptAt === undefined || i.nextAttemptAt.getTime() <= now.getTime()) &&
          dependencyStatus(i, byId, tombstones).satisfied,
      )
      .sort(
        (a, b) =>
          a.trace.priority - b.trace.priority || a.createdAt.getTime() - b.createdAt.getTime(),
      )
      .slice(0, limit);
  }
}
