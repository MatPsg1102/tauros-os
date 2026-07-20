// Eventos TÉCNICOS da infraestrutura offline (observabilidade — §10).
// Estrutura consistente e versionada; NUNCA payload operacional completo,
// NUNCA dado sensível. Persistência/envio à trilha definitiva: Etapa 6.2.8.

import type { QueueState } from './states.js';

export type TechnicalEventType =
  | 'queue_changed'
  | 'item_enqueued'
  | 'item_blocked'
  | 'sync_started'
  | 'sync_finished'
  | 'sync_cancelled'
  | 'retry_scheduled'
  | 'item_failed'
  | 'item_discarded'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'review_required'
  | 'review_resolved'
  | 'lease_reclaimed'
  | 'cycle_detected'
  | 'dependency_missing'
  | 'item_quarantined'
  | 'snapshot_expired'
  | 'offline_detected'
  | 'online_restored'
  | 'cleanup_completed'
  | 'database_destroyed';

/** Erro sanitizado: nome + mensagem, nunca stack/payload/segredo. */
export interface SanitizedError {
  readonly name: string;
  readonly message: string;
}

export const EVENT_METADATA_VERSION = 1;

export interface TechnicalEvent {
  readonly eventId: string;
  readonly eventType: TechnicalEventType;
  readonly timestamp: Date;
  readonly metadataVersion: number;
  readonly queueItemId?: string | undefined;
  readonly storeId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly attempt?: number | undefined;
  readonly previousState?: QueueState | undefined;
  readonly nextState?: QueueState | undefined;
  readonly error?: SanitizedError | undefined;
  /** Metadados técnicos adicionais (nunca payload operacional). */
  readonly metadata?: Readonly<Record<string, string | number | boolean>> | undefined;
}

export type TechnicalEventInput = Omit<TechnicalEvent, 'eventId' | 'timestamp' | 'metadataVersion'>;

/** Fábrica canônica — todo evento nasce com id, timestamp e versão. */
export function makeEvent(input: TechnicalEventInput, now: Date): TechnicalEvent {
  return {
    eventId: crypto.randomUUID(),
    timestamp: now,
    metadataVersion: EVENT_METADATA_VERSION,
    ...input,
  };
}

export function sanitizeError(error: unknown): SanitizedError {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'UnknownError', message: String(error) };
}

/** Porta de emissão de eventos técnicos. */
export interface TechnicalEventPort {
  emit(event: TechnicalEvent): void;
}

export class NoopEventEmitter implements TechnicalEventPort {
  emit(): void {
    // intencionalmente vazio
  }
}

export class CapturingEventEmitter implements TechnicalEventPort {
  readonly events: TechnicalEvent[] = [];
  emit(event: TechnicalEvent): void {
    this.events.push(event);
  }
}
