// Definições de tarefa criadas pelo encarregado (Área do Encarregado) —
// espelham task_templates do schema congelado. TaskTemplate é DADO
// CONFIGURÁVEL (ADR-019): a escrita é governada por config.write (RLS
// congelada), e a atribuição oficial é por POSIÇÃO operacional
// (target_position_id), nunca por funcionário.

import type { LocalSyncStatus } from '../sync/status.js';
import type { TaskFrequency } from '../daily-task/record.js';
import type { TaskRecurrence } from './recurrence.js';

export const ENTITY_TASK_TEMPLATE = 'task_templates' as const;

export type TemplateSyncStatus = LocalSyncStatus;

/**
 * Registro local serializável do template. Além do schema base, carrega o
 * PLANEJAMENTO operacional (aditivo, migration forward-only): data inicial de
 * vigência, início/fim planejados e recorrência. A atribuição por POSIÇÃO é
 * agora OPCIONAL — o encarregado pode "definir no dia" (targetPositionId
 * null), materializando a ocorrência sem responsável. Não há
 * description/priority nem horários REAIS de execução (próxima vertical).
 */
export interface TaskTemplateRecord {
  readonly id: string;
  readonly storeId: string;
  readonly title: string;
  /** Cadência congelada (task_frequency) — derivada da recorrência p/ schema. */
  readonly frequency: TaskFrequency;
  /** Posição responsável PADRÃO; null = "definir no dia" (sem responsável). */
  readonly targetPositionId: string | null;
  readonly requiresPhoto: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  readonly active: boolean;
  /** Horário do CLIENTE (clock port) — o servidor preenche created_at. */
  readonly clientCreatedAt: string;
  /** Data civil YYYY-MM-DD (fuso da LOJA) em que a vigência começa. */
  readonly effectiveFrom: string;
  /** Minutos após o início do dia operacional do INÍCIO planejado. */
  readonly plannedStartMinutes: number;
  /** Minutos após o início do dia operacional do FIM máximo (vencimento). */
  readonly dueOffsetMinutes: number;
  /** Regra de materialização (ONCE | WEEKDAYS | WHEN_SCHEDULED). */
  readonly recurrence: TaskRecurrence;
  readonly idempotencyKey: string;
  readonly syncStatus: TemplateSyncStatus;
  /** Correlação de auditoria (RA-QUEUE-01: id definitivo gerado no cliente). */
  readonly auditCorrelationId: string;
}

/** Payload da operação enfileirada (contrato de sincronização do slice). */
export interface CreateTemplateQueuePayload {
  readonly template: TaskTemplateRecord;
}
