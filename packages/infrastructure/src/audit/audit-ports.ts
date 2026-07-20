// Portas do pipeline de auditoria (6.2.8 §3/§5/§11/§12) — responsabilidades
// separadas; composição num coordenador pequeno. O SERVIDOR é a autoridade
// final da trilha (§5): o cliente nunca define recordedAt, nunca edita/apaga.

import type { AuditEvent } from './audit-event.js';
import type { AuditCategory } from './audit-policy.js';

// ---------------------------------------------------------------------------
// Transporte cliente → servidor
// ---------------------------------------------------------------------------
export type AuditSubmitOutcome =
  | { readonly kind: 'accepted'; readonly recordedAt: string }
  /** Dedupe idempotente server-side: mesmo eventId já registrado. */
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'rejected'; readonly reason: string }
  | { readonly kind: 'transient'; readonly message: string };

export interface AuditTransportPort {
  /** Envia UM evento; o servidor valida autoria/loja/sessão/permissão (§5). */
  submit(event: AuditEvent): Promise<AuditSubmitOutcome>;
}

// ---------------------------------------------------------------------------
// Buffer local (outbox durável — origem offline §4)
// ---------------------------------------------------------------------------
export interface AuditBufferPort {
  append(event: AuditEvent): Promise<void>;
  pending(): Promise<readonly AuditEvent[]>;
  markDispatched(eventIds: readonly string[]): Promise<void>;
  /** Evento inválido/não-transmissível é isolado, nunca descartado em silêncio. */
  quarantine(eventId: string, reason: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Retry do despacho (delegado à política de retry do Configuration Engine)
// ---------------------------------------------------------------------------
export interface AuditRetryPolicyPort {
  decide(attempt: number, storeId: string | null): Promise<{ retry: boolean; delayMs: number }>;
}

// ---------------------------------------------------------------------------
// Persistência/consulta server-side (implementação: Edge Function/Supabase)
// ---------------------------------------------------------------------------
export interface AuditRepositoryPort {
  /** Append-only e idempotente por eventId. recordedAt é gerado AQUI. */
  append(event: AuditEvent): Promise<{ recordedAt: string; duplicate: boolean }>;
}

export interface AuditQueryFilter {
  readonly storeId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly actorId?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly eventType?: string;
  readonly result?: AuditEvent['result'];
  readonly correlationId?: string;
  readonly source?: AuditEvent['source'];
  readonly sessionId?: string;
  readonly deviceId?: string;
}

/** Paginação DETERMINÍSTICA por cursor (recordedAt + eventId) — §12. */
export interface AuditPage {
  readonly events: readonly AuditEvent[];
  readonly nextCursor: string | null;
}

export interface AuditQueryPort {
  query(filter: AuditQueryFilter, limit: number, cursor?: string): Promise<AuditPage>;
}

/** Exportação estruturada e assinável (NDJSON canônico) — sem UI nesta etapa. */
export interface AuditExportPort {
  exportNdjson(filter: AuditQueryFilter): Promise<string>;
}

// ---------------------------------------------------------------------------
// Retenção (§11) — contrato criado; VALORES são decisão de negócio PENDENTE.
// ---------------------------------------------------------------------------
export type RetentionRule =
  | { readonly mode: 'pending-business-decision' }
  | { readonly mode: 'retain-days'; readonly days: number }
  | { readonly mode: 'archive-after-days'; readonly days: number }
  | { readonly mode: 'legal-hold' };

export interface AuditRetentionPolicyPort {
  ruleFor(category: AuditCategory): RetentionRule;
}

/**
 * PENDÊNCIA REGISTRADA: os prazos por categoria dependem de decisão de
 * negócio/legislação ainda não congelada. Nenhum valor foi inventado;
 * NENHUMA exclusão permanente é executada sob 'pending-business-decision'.
 * A estrutura suporta arquivamento/particionamento/exportação/anonimização/
 * legal hold via os contratos acima.
 */
export class PendingRetentionPolicy implements AuditRetentionPolicyPort {
  ruleFor(): RetentionRule {
    return { mode: 'pending-business-decision' };
  }
}
