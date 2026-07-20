// Porta de transporte de sincronização (RA-QUEUE-01 §9).
// A implementação concreta (Edge Function/Supabase) chega no wiring; os testes
// usam stubs. O resultado já vem CLASSIFICADO na taxonomia do Baseline.

import type { ConflictClassification } from './conflict.js';
import type { QueueItem } from './queue-item.js';

export type SubmitOutcome =
  /** Persistido no servidor (inclui dedupe idempotente = sucesso). */
  | { readonly kind: 'persisted' }
  /** Autoria/bounds exigem revisão autorizada (422). */
  | { readonly kind: 'review'; readonly reason: string }
  /** Conflito com o estado remoto (409). */
  | {
      readonly kind: 'conflict';
      readonly classification: ConflictClassification;
      readonly remoteEvidence: unknown;
      readonly message: string;
    }
  /** Erro definitivo — nunca reenviar (400/403/schema). */
  | { readonly kind: 'rejected'; readonly message: string }
  /** Falha transitória — elegível a retry (rede/5xx/429). */
  | {
      readonly kind: 'transient';
      readonly message: string;
      readonly authExpired: boolean;
      readonly retryAfterMs?: number;
    };

export interface SyncTransportPort {
  /** Envia UM item com sua chave de idempotência. Nunca lança para erros de negócio. */
  submit(item: QueueItem): Promise<SubmitOutcome>;
}
