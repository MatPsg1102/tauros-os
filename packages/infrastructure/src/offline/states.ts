// Os 8 estados da fila (RA-QUEUE-01) — módulo próprio para evitar ciclos
// entre a máquina de estados e a observabilidade.

export const QUEUE_STATES = [
  'PENDING',
  'BLOCKED_BY_DEPENDENCY',
  'SYNCING',
  'SYNCED',
  'RETRY_SCHEDULED',
  'CONFLICT',
  'NEEDS_REVIEW',
  'PERMANENT_FAILURE',
] as const;

export type QueueState = (typeof QUEUE_STATES)[number];
