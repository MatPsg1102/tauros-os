// Fronteira de codec/schema entre o modelo em memória e a representação
// persistida (§2). Formato canônico: JSON puro — datas em ISO-8601, sem
// undefined, sem classes/prototypes. Entrada inválida é identificada,
// isolada (quarentena) e nunca processada.

import { z } from 'zod';

import type { QueueItem } from './queue-item.js';
import { QUEUE_STATES } from './states.js';

/** Versão do formato persistido (evolução via migration local). */
export const PERSISTENCE_VERSION = 1;

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'data ISO-8601 inválida');

const persistedError = z.object({
  classification: z.enum([
    'RECOVERABLE',
    'AUTH_RETRYABLE',
    'CONFLICT',
    'AUTHORSHIP_REVIEW',
    'PERMANENT',
  ]),
  message: z.string(),
  at: isoDate,
});

const persistedSnapshot = z.object({
  operatorProfileId: z.string().min(1),
  operatorEmployeeId: z.string().min(1),
  storeId: z.string().min(1),
  sessionId: z.string().min(1),
  permissions: z.array(z.string()),
  permissionModelVersion: z.number().int().nullable(),
  configVersionRef: z.string().nullable(),
  capturedAt: isoDate,
  validUntil: isoDate,
  authOrigin: z.enum(['online', 'offline-pin']),
});

export const persistedQueueItemSchema = z.object({
  persistenceVersion: z.literal(PERSISTENCE_VERSION),
  id: z.string().min(1),
  operation: z.enum(['insert', 'update', 'upload']),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  payload: z.unknown(),
  dependsOn: z.array(z.string()),
  idempotencyKey: z.string().min(1),
  attemptCount: z.number().int().min(0),
  state: z.enum(QUEUE_STATES),
  createdAt: isoDate,
  nextAttemptAt: isoDate.nullable(),
  lastAttemptAt: isoDate.nullable(),
  lastError: persistedError.nullable(),
  authorization: persistedSnapshot,
  trace: z.object({
    storeId: z.string().min(1),
    deviceId: z.string().min(1),
    sessionId: z.string().min(1),
    schemaVersion: z.number().int(),
    priority: z.number().int(),
  }),
  lease: z
    .object({ owner: z.string().min(1), token: z.string().min(1), expiresAt: isoDate })
    .nullable(),
});

export type PersistedQueueItem = z.infer<typeof persistedQueueItemSchema>;

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | undefined): string | null => (d ? d.toISOString() : null);

/** Modelo → formato canônico persistido (JSON puro). */
export function encodeQueueItem(item: QueueItem): PersistedQueueItem {
  return {
    persistenceVersion: PERSISTENCE_VERSION,
    id: item.id,
    operation: item.operation,
    entityType: item.entityType,
    entityId: item.entityId,
    payload: item.payload ?? null,
    dependsOn: [...item.dependsOn],
    idempotencyKey: item.idempotencyKey,
    attemptCount: item.attemptCount,
    state: item.state,
    createdAt: iso(item.createdAt),
    nextAttemptAt: isoOrNull(item.nextAttemptAt),
    lastAttemptAt: isoOrNull(item.lastAttemptAt),
    lastError: item.lastError
      ? {
          classification: item.lastError.classification,
          message: item.lastError.message,
          at: iso(item.lastError.at),
        }
      : null,
    authorization: {
      operatorProfileId: item.authorization.operatorProfileId,
      operatorEmployeeId: item.authorization.operatorEmployeeId,
      storeId: item.authorization.storeId,
      sessionId: item.authorization.sessionId,
      permissions: [...item.authorization.permissions],
      permissionModelVersion: item.authorization.permissionModelVersion ?? null,
      configVersionRef: item.authorization.configVersionRef ?? null,
      capturedAt: iso(item.authorization.capturedAt),
      validUntil: iso(item.authorization.validUntil),
      authOrigin: item.authorization.authOrigin,
    },
    trace: { ...item.trace },
    lease: item.lease
      ? { owner: item.lease.owner, token: item.lease.token, expiresAt: iso(item.lease.expiresAt) }
      : null,
  };
}

export type DecodeResult =
  { readonly ok: true; readonly item: QueueItem } | { readonly ok: false; readonly reason: string };

/** Formato persistido → modelo, com validação estrutural completa. */
export function decodeQueueItem(raw: unknown): DecodeResult {
  const parsed = persistedQueueItemSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  const p = parsed.data;
  return {
    ok: true,
    item: {
      id: p.id,
      operation: p.operation,
      entityType: p.entityType,
      entityId: p.entityId,
      payload: p.payload,
      dependsOn: p.dependsOn,
      idempotencyKey: p.idempotencyKey,
      attemptCount: p.attemptCount,
      state: p.state,
      createdAt: new Date(p.createdAt),
      nextAttemptAt: p.nextAttemptAt ? new Date(p.nextAttemptAt) : undefined,
      lastAttemptAt: p.lastAttemptAt ? new Date(p.lastAttemptAt) : undefined,
      lastError: p.lastError
        ? {
            classification: p.lastError.classification,
            message: p.lastError.message,
            at: new Date(p.lastError.at),
          }
        : undefined,
      authorization: {
        operatorProfileId: p.authorization.operatorProfileId,
        operatorEmployeeId: p.authorization.operatorEmployeeId,
        storeId: p.authorization.storeId,
        sessionId: p.authorization.sessionId,
        permissions: p.authorization.permissions,
        permissionModelVersion: p.authorization.permissionModelVersion ?? undefined,
        configVersionRef: p.authorization.configVersionRef ?? undefined,
        capturedAt: new Date(p.authorization.capturedAt),
        validUntil: new Date(p.authorization.validUntil),
        authOrigin: p.authorization.authOrigin,
      },
      trace: p.trace,
      lease: p.lease
        ? { owner: p.lease.owner, token: p.lease.token, expiresAt: new Date(p.lease.expiresAt) }
        : undefined,
    },
  };
}
