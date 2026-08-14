// Escala Operacional (schema congelado de shifts) — espelhos locais
// serializáveis. Conceitos DISTINTOS e não equivalentes (nunca misturar):
// JORNADA (ShiftDefinition — janela de horário de trabalho), PADRÃO DE ESCALA
// (ShiftPattern — regra cíclica de QUAIS dias se trabalha), VIGÊNCIA (período
// em que a configuração vale), EQUIPE (agrupamento — NÃO define horário) e
// PRESENÇA PLANEJADA (resultado da resolução na data — NÃO é presença real).
// A configuração pertence à LOJA: nada aqui é regra global do Tauros OS.

import type { LocalSyncStatus } from '../sync/status.js';
import type { EmployeeAssignmentRecord } from '../workforce/record.js';

export const ENTITY_SHIFT_DEFINITION = 'shift_definitions' as const;
export const ENTITY_EMPLOYEE_ASSIGNMENT = 'employee_assignments' as const;

export type ScheduleSyncStatus = LocalSyncStatus;

/**
 * Registro local de shift_definitions — JORNADA (janela de trabalho).
 * Dado CONFIGURÁVEL da loja (ADR-019, "SEEDS de configuração" no schema):
 * os horários iniciais são dados editáveis, nunca código. `breaks` (JSONB no
 * schema) fica fora da V1.
 */
export interface ShiftDefinitionRecord {
  readonly id: string;
  readonly storeId: string;
  /** Nome exibido (ex.: "Turno abertura"); default = "HH:MM–HH:MM". */
  readonly name: string;
  /** Início da janela, HH:MM no fuso da LOJA. */
  readonly startTime: string;
  /** Fim da janela, HH:MM no fuso da LOJA (menor que startTime = vira o dia). */
  readonly endTime: string;
  readonly clientCreatedAt: string;
  readonly idempotencyKey: string;
  readonly syncStatus: ScheduleSyncStatus;
  readonly auditCorrelationId: string;
}

/** Dia do ciclo do padrão (shift_pattern_days): trabalha ou folga. */
export interface ShiftPatternDayView {
  readonly dayIndex: number;
  readonly works: boolean;
}

/**
 * Registro local de shift_patterns — PADRÃO DE ESCALA como DADO cíclico
 * genérico (nunca enum fechado): 12x36 = 2 dias [trabalha, folga]; semanal =
 * 7 dias; dias fixos = 7 dias com âncora em dia da semana conhecido. `days`
 * vem embutido no documento local (o servidor normaliza em
 * shift_pattern_days — mesma decisão de forma dos demais espelhos locais).
 */
export interface ShiftPatternRecord {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  /** Vigência (YYYY-MM-DD, fuso da loja); null = aberto. */
  readonly effectiveFrom: string | null;
  readonly effectiveUntil: string | null;
  readonly days: readonly ShiftPatternDayView[];
}

/** Payload da operação enfileirada de criação de jornada. */
export interface CreateShiftDefinitionQueuePayload {
  readonly definition: ShiftDefinitionRecord;
}

/**
 * Payload da troca de jornada do colaborador: fecha o vínculo vigente e abre
 * o novo — histórico preservado por VIGÊNCIA, nunca sobrescrito.
 */
export interface ChangeWorkPeriodQueuePayload {
  readonly closedAssignment: EmployeeAssignmentRecord;
  readonly openedAssignment: EmployeeAssignmentRecord;
}
