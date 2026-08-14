// Ports da Gestão de Equipe. A aplicação depende SÓ destes contratos;
// adapters (IndexedDB, fila, auditoria) chegam pelo wiring.

import type {
  EmployeeAssignmentRecord,
  EmployeeRecord,
  OperationalPositionRecord,
  TeamRecord,
  WorkforceSyncStatus,
} from './record.js';

export interface WorkforceRepositoryPort {
  employees(storeId: string): Promise<readonly EmployeeRecord[]>;
  employeeByIdempotencyKey(storeId: string, idempotencyKey: string): Promise<EmployeeRecord | null>;
  assignments(storeId: string): Promise<readonly EmployeeAssignmentRecord[]>;
  /** Cadastro ATÔMICO: pessoa + vínculo na MESMA transação local. */
  saveRegistration(employee: EmployeeRecord, assignment: EmployeeAssignmentRecord): Promise<void>;
  /** Grava/atualiza um vínculo isolado (troca de jornada por vigência). */
  saveAssignment(record: EmployeeAssignmentRecord): Promise<void>;
  updateEmployeeSyncStatus(id: string, status: WorkforceSyncStatus): Promise<void>;
  teams(storeId: string): Promise<readonly TeamRecord[]>;
  saveTeam(record: TeamRecord): Promise<void>;
  positions(storeId: string): Promise<readonly OperationalPositionRecord[]>;
  /** Busca pela chave NATURAL (storeId+key, unique no schema congelado). */
  positionByKey(storeId: string, key: string): Promise<OperationalPositionRecord | null>;
  savePosition(record: OperationalPositionRecord): Promise<void>;
  updatePositionSyncStatus(id: string, status: WorkforceSyncStatus): Promise<void>;
}

export interface RegisterEmployeeEnqueueInput {
  readonly queueItemId: string;
  readonly employee: EmployeeRecord;
  readonly assignment: EmployeeAssignmentRecord;
}

export interface CreatePositionEnqueueInput {
  readonly queueItemId: string;
  readonly position: OperationalPositionRecord;
}

export interface WorkforceEnqueuePort {
  enqueueRegisterEmployee(input: RegisterEmployeeEnqueueInput): Promise<void>;
  enqueueCreatePosition(input: CreatePositionEnqueueInput): Promise<void>;
}

/**
 * Auditoria da gestão de equipe — usa tipos OFICIAIS do catálogo congelado:
 * cadastro de colaborador = admin.action (ação administrativa de RH);
 * criação de posição = config.changed (posição é dado configurável, ADR-019);
 * negação = access.denied. Nunca inclui PIN/segredo/credencial.
 */
export interface WorkforceAuditInput {
  readonly eventType: 'admin.action' | 'config.changed' | 'access.denied';
  readonly occurredAt: Date;
  readonly storeId: string;
  readonly actorProfileId: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly deviceId: string;
  readonly correlationId: string;
  readonly source: 'client-online' | 'client-offline';
  readonly result: 'success' | 'failure' | 'rejected';
  readonly errorCode?: string;
}

export interface WorkforceAuditPort {
  record(input: WorkforceAuditInput): Promise<void>;
}
