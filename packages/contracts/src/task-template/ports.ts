// Ports da Área do Encarregado. A aplicação depende SÓ destes contratos;
// adapters (IndexedDB, fila, auditoria, fixtures de equipe) chegam pelo wiring.

import type { TaskTemplateRecord, TemplateSyncStatus } from './record.js';

export interface TaskTemplateRepositoryPort {
  byStore(storeId: string): Promise<readonly TaskTemplateRecord[]>;
  byIdempotencyKey(storeId: string, idempotencyKey: string): Promise<TaskTemplateRecord | null>;
  save(record: TaskTemplateRecord): Promise<void>;
  updateSyncStatus(id: string, status: TemplateSyncStatus): Promise<void>;
}

export interface TemplateEnqueueInput {
  readonly queueItemId: string;
  readonly template: TaskTemplateRecord;
}

export interface TemplateEnqueuePort {
  enqueueCreateTemplate(input: TemplateEnqueueInput): Promise<void>;
}

/** Auditoria da criação — usa tipos OFICIAIS do catálogo congelado. */
export interface TemplateAuditInput {
  readonly eventType: 'config.changed' | 'access.denied';
  readonly occurredAt: Date;
  readonly storeId: string;
  /** Autoria operacional OBRIGATÓRIA (ADR-021). */
  readonly actorEmployeeId: string;
  /** Identidade de plataforma — null até provisionamento server-side. */
  readonly actorProfileId: string | null;
  readonly templateId: string | null;
  readonly deviceId: string;
  readonly correlationId: string;
  readonly source: 'client-online' | 'client-offline';
  readonly result: 'success' | 'failure' | 'rejected';
  readonly errorCode?: string;
}

export interface TemplateAuditPort {
  record(input: TemplateAuditInput): Promise<void>;
}

// ===== Equipe (workforce congelado: posições + atribuições vigentes) =====

/** Posição operacional (operational_positions) — unidade oficial de atribuição. */
export interface OperationalPositionView {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

/** Funcionário visível ao encarregado (employees + employee_assignments). */
export interface TeamMemberView {
  readonly employeeId: string;
  readonly fullName: string;
  /** Posição vigente hoje (employee_assignments) — null se sem atribuição. */
  readonly positionId: string | null;
}

export interface TeamDirectoryPort {
  positions(storeId: string): Promise<readonly OperationalPositionView[]>;
  members(storeId: string): Promise<readonly TeamMemberView[]>;
}
