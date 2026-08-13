// Gestão de Equipe (workforce congelado) — espelhos locais serializáveis de
// employees, employee_assignments, teams e operational_positions. Conceitos
// DISTINTOS e não equivalentes: COLABORADOR (pessoa), POSIÇÃO (papel
// operacional — dado configurável, ADR-019), EQUIPE (agrupamento usado pela
// escala) e PERMISSÃO (ADR-018). Equipe nunca entra no nome da posição e
// nenhuma capability deriva da posição ocupada.

import type { LocalSyncStatus } from '../sync/status.js';

export const ENTITY_EMPLOYEE = 'employees' as const;
export const ENTITY_OPERATIONAL_POSITION = 'operational_positions' as const;

export type WorkforceSyncStatus = LocalSyncStatus;

/**
 * Registro local de employees (schema congelado: registro de RH da pessoa,
 * escopado por loja). Sem CPF/endereço/telefone/salário — dados trabalhistas
 * são outra vertical. NÃO é identidade autenticável: profile/membership
 * chegam com o backend real (pendência registrada).
 */
export interface EmployeeRecord {
  readonly id: string;
  readonly storeId: string;
  /**
   * Matrícula (unique por loja no schema congelado). A matrícula REAL chega
   * com o vertical administrativo; até lá o cliente preenche com o próprio id
   * (placeholder honesto, unicidade garantida).
   */
  readonly registration: string;
  readonly fullName: string;
  readonly active: boolean;
  /** Horário do CLIENTE (clock port) — o servidor preenche created_at. */
  readonly clientCreatedAt: string;
  readonly idempotencyKey: string;
  readonly syncStatus: WorkforceSyncStatus;
  /** Correlação de auditoria (RA-QUEUE-01: id definitivo gerado no cliente). */
  readonly auditCorrelationId: string;
}

/**
 * Registro local de employee_assignments — vínculo TEMPORAL do colaborador
 * com posição e equipe. É esta vigência (nunca a equipe sozinha) que a
 * Escala Operacional V1 consumirá para resolver presença via ShiftOccurrence;
 * equipe ≠ presença.
 */
export interface EmployeeAssignmentRecord {
  readonly id: string;
  readonly storeId: string;
  readonly employeeId: string;
  readonly teamId: string | null;
  readonly operationalPositionId: string;
  /**
   * Data civil YYYY-MM-DD (fuso da LOJA) do início do vínculo — o backend
   * converte para timestamptz na meia-noite civil da loja.
   */
  readonly validFrom: string;
  readonly validUntil: string | null;
}

/** Registro local de teams — dado por LINHA (nunca enum A/B congelado). */
export interface TeamRecord {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
}

/** Registro local de operational_positions (dado configurável, ADR-019). */
export interface OperationalPositionRecord {
  readonly id: string;
  readonly storeId: string;
  /** Chave estável derivada do nome (unique por loja no schema congelado). */
  readonly key: string;
  readonly name: string;
  readonly clientCreatedAt: string;
  readonly idempotencyKey: string;
  readonly syncStatus: WorkforceSyncStatus;
  readonly auditCorrelationId: string;
}

/** Payload da operação enfileirada: cadastro ATÔMICO pessoa + vínculo. */
export interface RegisterEmployeeQueuePayload {
  readonly employee: EmployeeRecord;
  readonly assignment: EmployeeAssignmentRecord;
}

/** Payload da operação enfileirada de criação de posição. */
export interface CreatePositionQueuePayload {
  readonly position: OperationalPositionRecord;
}
