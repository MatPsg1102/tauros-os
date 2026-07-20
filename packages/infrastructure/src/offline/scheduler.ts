// Scheduler da fila (RA-QUEUE-01 §4).
// Promove estados por tempo/dependência e seleciona itens PRONTOS respeitando
// prioridade, backoff e o limite de concorrência do Configuration Engine.

import type { ConfigResolver } from '@tauros/config-engine';

import { dependenciesSatisfied } from './dag.js';
import type { TechnicalEventPort } from './events.js';
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
   * Passo de promoção: BLOCKED cujas deps concluíram → PENDING;
   * RETRY_SCHEDULED cujo backoff venceu → PENDING.
   */
  async promote(): Promise<void> {
    const now = this.clock();
    const all = await this.repo.all();
    const byId = new Map(all.map((i) => [i.id, i] as const));

    for (const item of all) {
      if (item.state === 'BLOCKED_BY_DEPENDENCY' && dependenciesSatisfied(item, byId)) {
        const def = transition(item.state, 'DEPS_SATISFIED');
        await this.repo.put({ ...item, state: def.to });
        this.events.emit({ type: def.technicalEvent, at: now, itemId: item.id });
      } else if (
        item.state === 'RETRY_SCHEDULED' &&
        (item.nextAttemptAt === undefined || item.nextAttemptAt.getTime() <= now.getTime())
      ) {
        const def = transition(item.state, 'BACKOFF_ELAPSED');
        await this.repo.put({ ...item, state: def.to, nextAttemptAt: undefined });
        this.events.emit({ type: def.technicalEvent, at: now, itemId: item.id });
      }
    }
  }

  /**
   * Seleção dos prontos: PENDING, fora de backoff, deps SYNCED —
   * ordem por prioridade e criação; tamanho = sync.concurrency.max.
   * Itens selecionados são mutuamente independentes por construção
   * (dependência não-SYNCED exclui o dependente).
   */
  async selectReady(): Promise<readonly QueueItem[]> {
    const now = this.clock();
    const limit = await this.config.resolve('sync.concurrency.max');
    const all = await this.repo.all();
    const byId = new Map(all.map((i) => [i.id, i] as const));

    return all
      .filter(
        (i) =>
          i.state === 'PENDING' &&
          (i.nextAttemptAt === undefined || i.nextAttemptAt.getTime() <= now.getTime()) &&
          dependenciesSatisfied(i, byId),
      )
      .sort(
        (a, b) =>
          a.trace.priority - b.trace.priority || a.createdAt.getTime() - b.createdAt.getTime(),
      )
      .slice(0, limit);
  }
}
