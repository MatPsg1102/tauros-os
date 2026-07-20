// Modelo CANÔNICO de evento de auditoria (6.2.8 §1) — contrato único e
// versionado. Auditoria ≠ log técnico (§2): isto reconstrói decisões e autoria.
// Payload operacional completo NUNCA entra automaticamente (política explícita).

import { z } from 'zod';

export const AUDIT_SCHEMA_VERSION = 1;

export const AUDIT_ACTOR_TYPES = ['human', 'system', 'integration'] as const;
export const AUDIT_SOURCES = ['client-offline', 'client-online', 'server', 'database'] as const;
export const AUDIT_RESULTS = ['success', 'failure', 'rejected', 'review', 'conflict'] as const;

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'ISO-8601 inválido');

/**
 * Política temporal (§10): os quatro horários são preservados SEPARADAMENTE.
 * - occurredAt: quando a ação aconteceu (relógio do cliente — informativo);
 * - clientMonotonicMs: contador monotônico local, quando disponível;
 * - sentAt: quando o cliente enviou;
 * - recordedAt: quando o SERVIDOR/banco registrou (AUTORITATIVO p/ ordenação).
 * Ordenação de consulta: recordedAt + sequência do banco; occurredAt é
 * exibido/investigado, nunca autoridade — envio tardio não falsifica ordem.
 */
export const auditEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  schemaVersion: z.literal(AUDIT_SCHEMA_VERSION),
  occurredAt: isoDate,
  clientMonotonicMs: z.number().nonnegative().nullable(),
  sentAt: isoDate.nullable(),
  recordedAt: isoDate.nullable(), // null no cliente; preenchido pelo servidor
  storeId: z.string().min(1).nullable(),
  actorId: z.string().min(1).nullable(),
  actorType: z.enum(AUDIT_ACTOR_TYPES),
  sessionId: z.string().nullable(),
  deviceId: z.string().nullable(),
  correlationId: z.string().min(1),
  causationId: z.string().nullable(),
  idempotencyKey: z.string().min(1),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  operation: z.string().nullable(),
  source: z.enum(AUDIT_SOURCES),
  executionSource: z.enum(['HUMAN', 'SYSTEM', 'INTEGRATION']).nullable(),
  previousState: z.string().nullable(),
  nextState: z.string().nullable(),
  result: z.enum(AUDIT_RESULTS),
  errorCode: z.string().nullable(),
  error: z.object({ name: z.string(), message: z.string() }).nullable(),
  /** Referências técnicas — nunca o segredo/valor em si. */
  authorizationRef: z
    .object({
      sessionId: z.string(),
      permissionModelVersion: z.number().int().nullable(),
      authOrigin: z.enum(['online', 'offline-pin']).nullable(),
    })
    .nullable(),
  configVersionRef: z.string().nullable(),
  queueItemId: z.string().nullable(),
  attempt: z.number().int().nonnegative().nullable(),
  /** Metadados técnicos SANITIZADOS (allowlist) — nunca payload integral. */
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).nullable(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export type AuditValidation =
  | { readonly ok: true; readonly event: AuditEvent }
  | { readonly ok: false; readonly reason: string };

/** Valida um evento (rejeição explícita com razão — nunca aceite parcial). */
export function validateAuditEvent(raw: unknown): AuditValidation {
  const parsed = auditEventSchema.safeParse(raw);
  if (parsed.success) return { ok: true, event: parsed.data };
  return {
    ok: false,
    reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}
