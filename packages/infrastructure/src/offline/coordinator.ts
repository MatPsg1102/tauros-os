// Coordenador da sincronização (RA-QUEUE-01 §9).
// Pequeno DE PROPÓSITO: só compõe portas explícitas e orquestra o drain.
// Nenhuma responsabilidade própria além da ordem de chamada.

import type { ConnectivityPort } from './connectivity.js';
import { makeEvent, type TechnicalEventPort } from './events.js';
import type { QueueProcessor, ProcessResult } from './processor.js';
import type { LocalQueueRepository } from './queue-repository.js';
import type { QueueScheduler } from './scheduler.js';

export interface DrainReport {
  readonly ready: boolean;
  readonly reclaimed: number;
  readonly processed: readonly ProcessResult[];
}

export class SyncCoordinator {
  private draining = false;

  constructor(
    private readonly connectivity: ConnectivityPort,
    private readonly repo: LocalQueueRepository,
    private readonly scheduler: QueueScheduler,
    private readonly processor: QueueProcessor,
    private readonly events: TechnicalEventPort,
    private readonly clock: () => Date,
  ) {}

  /**
   * Um ciclo de drenagem:
   * conectividade → recuperação de leases → promoção → lotes até esvaziar.
   * Reentrância é ignorada (um drain por vez).
   */
  async drain(signal?: AbortSignal): Promise<DrainReport> {
    if (this.draining) return { ready: false, reclaimed: 0, processed: [] };
    this.draining = true;
    try {
      const readiness = await this.connectivity.assess();
      if (!readiness.readyToSync) {
        this.events.emit(
          makeEvent({ eventType: 'offline_detected', metadata: { ...readiness } }, this.clock()),
        );
        return { ready: false, reclaimed: 0, processed: [] };
      }
      this.events.emit(makeEvent({ eventType: 'online_restored' }, this.clock()));

      const reclaimed = (await this.repo.reclaimExpiredLeases()).length;
      const processed: ProcessResult[] = [];

      // Lotes sucessivos: cada seleção retorna itens mutuamente independentes,
      // então o paralelismo dentro do lote é seguro (RA-QUEUE-01 §4).
      for (;;) {
        // Cancelamento cooperativo entre lotes (§8): shutdown, troca de loja,
        // encerramento de sessão ou invalidação de autorização abortam aqui.
        if (signal?.aborted) break;
        await this.scheduler.promote();
        const batch = await this.scheduler.selectReady();
        if (batch.length === 0) break;
        const results = await Promise.all(batch.map((i) => this.processor.process(i.id, signal)));
        processed.push(...results);
        // Itens que permaneceram acionáveis (ex.: requeue imediato) voltam
        // em ciclos futuros — evita loop infinito no mesmo drain.
        if (results.every((r) => r.trigger === 'SKIPPED')) break;
      }

      return { ready: true, reclaimed, processed };
    } finally {
      this.draining = false;
    }
  }
}
