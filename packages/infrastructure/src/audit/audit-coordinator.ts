// Coordenador de auditoria (§3) — pequeno e testável: só compõe e ordena.

import type { AuditDispatcher, DispatchReport } from './audit-dispatcher.js';

export class AuditCoordinator {
  private running = false;

  constructor(private readonly dispatcher: AuditDispatcher) {}

  async flush(signal?: AbortSignal): Promise<DispatchReport> {
    if (this.running)
      return { dispatched: [], deduplicated: [], quarantined: [], retriedLater: [] };
    this.running = true;
    try {
      return await this.dispatcher.dispatch(signal);
    } finally {
      this.running = false;
    }
  }
}
