// Eventos TÉCNICOS da infraestrutura offline (observabilidade).
// Nunca eventos de domínio — a camada offline não conhece entidades operacionais.

export type TechnicalEventType =
  | 'queue_changed'
  | 'item_enqueued'
  | 'item_blocked'
  | 'sync_started'
  | 'sync_finished'
  | 'retry_scheduled'
  | 'item_failed'
  | 'item_discarded'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'review_required'
  | 'review_resolved'
  | 'lease_reclaimed'
  | 'cycle_detected'
  | 'snapshot_expired'
  | 'offline_detected'
  | 'online_restored'
  | 'cleanup_completed';

export interface TechnicalEvent {
  readonly type: TechnicalEventType;
  readonly at: Date;
  readonly itemId?: string | undefined;
  readonly detail?: Readonly<Record<string, unknown>> | undefined;
}

/** Porta de emissão de eventos técnicos (telemetria/diagnóstico). */
export interface TechnicalEventPort {
  emit(event: TechnicalEvent): void;
}

/** Emissor nulo (default) — coordenador injeta um real quando houver telemetria. */
export class NoopEventEmitter implements TechnicalEventPort {
  emit(): void {
    // intencionalmente vazio
  }
}

/** Emissor de captura para testes e diagnóstico local. */
export class CapturingEventEmitter implements TechnicalEventPort {
  readonly events: TechnicalEvent[] = [];
  emit(event: TechnicalEvent): void {
    this.events.push(event);
  }
}
