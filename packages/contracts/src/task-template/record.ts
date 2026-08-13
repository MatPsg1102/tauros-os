// Definições de tarefa criadas pelo encarregado (Área do Encarregado) —
// espelham task_templates do schema congelado. TaskTemplate é DADO
// CONFIGURÁVEL (ADR-019): a escrita é governada por config.write (RLS
// congelada), e a atribuição oficial é por POSIÇÃO operacional
// (target_position_id), nunca por funcionário.

import type { LocalSyncStatus } from '../sync/status.js';
import type { TaskFrequency } from '../daily-task/record.js';

export const ENTITY_TASK_TEMPLATE = 'task_templates' as const;

export type TemplateSyncStatus = LocalSyncStatus;

/**
 * Registro local serializável do template. Campos além do schema congelado
 * são apenas projeções locais já estabelecidas no slice: dueOffsetMinutes
 * (entrada da materialização local — pendência 7.2) e syncStatus (reflexo da
 * fila). Não há description/priority: o schema congelado não os possui.
 */
export interface TaskTemplateRecord {
  readonly id: string;
  readonly storeId: string;
  readonly title: string;
  readonly frequency: TaskFrequency;
  readonly targetPositionId: string;
  readonly requiresPhoto: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  readonly active: boolean;
  /** Horário do CLIENTE (clock port) — o servidor preenche created_at. */
  readonly clientCreatedAt: string;
  /** Minutos após o início do dia operacional em que a tarefa vence. */
  readonly dueOffsetMinutes: number;
  readonly idempotencyKey: string;
  readonly syncStatus: TemplateSyncStatus;
  /** Correlação de auditoria (RA-QUEUE-01: id definitivo gerado no cliente). */
  readonly auditCorrelationId: string;
}

/** Payload da operação enfileirada (contrato de sincronização do slice). */
export interface CreateTemplateQueuePayload {
  readonly template: TaskTemplateRecord;
}
