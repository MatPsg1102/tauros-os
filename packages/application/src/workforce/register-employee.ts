// Use case: cadastrar colaborador (Gestão de Equipe). Mesma espinha dos
// slices anteriores — autorização efetiva (ADR-018, capability OFICIAL
// workforce.write: employees/assignments são dado de RH operacional, não
// configuração), validação das referências via port, decisão de domínio,
// fila, persistência local e auditoria (admin.action — tipo do catálogo
// congelado). SEM conhecer infraestrutura.
//
// Ordem de efeitos e recuperação (atomicidade sem transação distribuída):
//   1. enqueue (intenção durável — pessoa + vínculo no payload);
//   2. save local (estado consultável, mesma transação);
//   3. audit (admin.action).
// Falha entre 1 e 2 é recuperável: o boot reconstrói pelo payload da fila.

import { decideRegisterEmployee } from '@tauros/domain';
import {
  CAPABILITY_WORKFORCE_WRITE,
  ENTITY_EMPLOYEE,
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type EffectiveAuthorization,
  type EmployeeAssignmentRecord,
  type EmployeeRecord,
  type IdGeneratorPort,
  type ScheduleRepositoryPort,
  type WorkforceAuditPort,
  type WorkforceEnqueuePort,
  type WorkforceRepositoryPort,
} from '@tauros/contracts';

import { operationalDateFor } from '../operator-session/open-operator-session.js';
import { nameSlug } from '../shared/slug.js';

export interface RegisterEmployeeInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  /** Fuso IANA da LOJA (dado oficial da loja — nunca o fuso do dispositivo). */
  readonly storeTimeZone: string;
  readonly fullName: string;
  /** Data civil YYYY-MM-DD (fuso da loja) do início do vínculo. */
  readonly startDate: string;
  readonly positionId: string;
  readonly teamId: string;
  /**
   * JORNADA do vínculo (Escala V1). null tolerado para compatibilidade —
   * quando informada, precisa existir na loja.
   */
  readonly shiftDefinitionId: string | null;
  readonly createdOffline: boolean;
}

export type RegisterEmployeeFailureCode =
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'UNKNOWN_POSITION'
  | 'UNKNOWN_TEAM'
  | 'UNKNOWN_DEFINITION'
  | 'NAME_REQUIRED'
  | 'INVALID_DATE'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type RegisterEmployeeResult =
  | {
      readonly kind: 'registered';
      readonly employee: EmployeeRecord;
      readonly assignment: EmployeeAssignmentRecord;
    }
  | { readonly kind: 'already-registered'; readonly employee: EmployeeRecord }
  | {
      readonly kind: 'failed';
      readonly code: RegisterEmployeeFailureCode;
      readonly detail: string;
    };

/**
 * Identidade determinística do cadastro (nunca timestamp/aleatório): a MESMA
 * pessoa, cadastrada pelo MESMO encarregado, no MESMO dia operacional, é UM
 * cadastro — duplo clique, retry e resposta perdida convergem.
 */
export function employeeIdempotencyKeyFor(
  storeId: string,
  operationalDate: string,
  creatorEmployeeId: string,
  fullName: string,
): string {
  return `employee-register:${storeId}:${operationalDate}:${creatorEmployeeId}:${nameSlug(fullName)}`;
}

export class RegisterEmployeeUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly workforce: WorkforceRepositoryPort,
    private readonly schedule: ScheduleRepositoryPort,
    private readonly queue: WorkforceEnqueuePort,
    private readonly audit: WorkforceAuditPort,
  ) {}

  async execute(input: RegisterEmployeeInput): Promise<RegisterEmployeeResult> {
    const now = this.clock.now();
    const auth = input.authorization;
    const source = input.createdOffline ? 'client-offline' : 'client-online';

    // ADR-018: a APLICAÇÃO revalida a capacidade (ocultação visual não é controle)
    if (auth.validUntil.getTime() <= now.getTime()) {
      return { kind: 'failed', code: 'SNAPSHOT_EXPIRED', detail: 'autorização offline expirada' };
    }
    if (
      auth.permissionModelVersion !== undefined &&
      auth.permissionModelVersion !== PERMISSION_MODEL_VERSION
    ) {
      return {
        kind: 'failed',
        code: 'SNAPSHOT_VERSION_INCOMPATIBLE',
        detail: `permission_model_version ${String(auth.permissionModelVersion)} incompatível`,
      };
    }
    if (!auth.permissions.includes(CAPABILITY_WORKFORCE_WRITE)) {
      await this.audit.record({
        eventType: 'access.denied',
        occurredAt: now,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        actorProfileId: auth.operatorProfileId,
        entityType: ENTITY_EMPLOYEE,
        entityId: null,
        deviceId: input.deviceId,
        correlationId: auth.sessionId,
        source,
        result: 'rejected',
        errorCode: CAPABILITY_WORKFORCE_WRITE,
      });
      return { kind: 'failed', code: 'PERMISSION_DENIED', detail: 'capability ausente' };
    }

    // referências usam ID OFICIAL: posição e equipe precisam existir na loja
    const [positions, teams] = await Promise.all([
      this.workforce.positions(auth.storeId),
      this.workforce.teams(auth.storeId),
    ]);
    if (!positions.some((position) => position.id === input.positionId)) {
      return {
        kind: 'failed',
        code: 'UNKNOWN_POSITION',
        detail: 'função/posição não encontrada nesta loja',
      };
    }
    if (!teams.some((team) => team.id === input.teamId)) {
      return { kind: 'failed', code: 'UNKNOWN_TEAM', detail: 'equipe não encontrada nesta loja' };
    }
    if (input.shiftDefinitionId !== null) {
      const definitions = await this.schedule.definitions(auth.storeId);
      if (!definitions.some((definition) => definition.id === input.shiftDefinitionId)) {
        return {
          kind: 'failed',
          code: 'UNKNOWN_DEFINITION',
          detail: 'jornada não encontrada nesta loja',
        };
      }
    }

    const operationalDate = operationalDateFor(now, input.storeTimeZone);
    const idempotencyKey = employeeIdempotencyKeyFor(
      auth.storeId,
      operationalDate,
      auth.operatorEmployeeId,
      input.fullName,
    );

    // replay ANTES de decidir: a garantia de não duplicar não depende do resto
    const existing = await this.workforce.employeeByIdempotencyKey(auth.storeId, idempotencyKey);
    if (existing !== null) {
      return { kind: 'already-registered', employee: existing };
    }

    const decision = decideRegisterEmployee(
      {
        employeeId: this.ids.uuid(),
        assignmentId: this.ids.uuid(),
        storeId: auth.storeId,
        fullName: input.fullName,
        startDate: input.startDate,
        positionId: input.positionId,
        teamId: input.teamId,
        shiftDefinitionId: input.shiftDefinitionId,
        clientCreatedAt: now,
        idempotencyKey,
      },
      null,
    );

    if (decision.kind === 'already-registered') {
      return { kind: 'failed', code: 'PERSISTENCE_FAILED', detail: 'cadastro ausente no replay' };
    }
    if (decision.kind === 'rejected') {
      switch (decision.code) {
        case 'NAME_REQUIRED':
          return { kind: 'failed', code: 'NAME_REQUIRED', detail: decision.detail };
        case 'INVALID_DATE':
          return { kind: 'failed', code: 'INVALID_DATE', detail: decision.detail };
        default:
          return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
      }
    }

    const employee: EmployeeRecord = {
      id: decision.employee.id,
      storeId: decision.employee.storeId,
      // matrícula REAL chega com o vertical administrativo — placeholder = id
      registration: decision.employee.id,
      fullName: decision.employee.fullName,
      active: decision.employee.active,
      clientCreatedAt: decision.employee.clientCreatedAt.toISOString(),
      idempotencyKey: decision.employee.idempotencyKey,
      syncStatus: 'queued',
      auditCorrelationId: decision.employee.id,
    };
    const assignment: EmployeeAssignmentRecord = {
      id: decision.assignment.id,
      storeId: decision.assignment.storeId,
      employeeId: decision.assignment.employeeId,
      teamId: decision.assignment.teamId,
      operationalPositionId: decision.assignment.operationalPositionId,
      shiftDefinitionId: decision.assignment.shiftDefinitionId,
      validFrom: decision.assignment.validFrom,
      validUntil: decision.assignment.validUntil,
    };

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local; 3) auditoria
    try {
      await this.queue.enqueueRegisterEmployee({
        queueItemId: this.ids.uuid(),
        employee,
        assignment,
      });
    } catch (error) {
      await this.audit.record({
        eventType: 'admin.action',
        occurredAt: now,
        storeId: auth.storeId,
        actorEmployeeId: auth.operatorEmployeeId,
        actorProfileId: auth.operatorProfileId,
        entityType: ENTITY_EMPLOYEE,
        entityId: employee.id,
        deviceId: input.deviceId,
        correlationId: employee.auditCorrelationId,
        source,
        result: 'failure',
        errorCode: 'ENQUEUE_FAILED',
      });
      return {
        kind: 'failed',
        code: 'ENQUEUE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao enfileirar',
      };
    }

    try {
      await this.workforce.saveRegistration(employee, assignment);
    } catch (error) {
      // intenção durável já registrada — o boot reconcilia pela fila
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao persistir localmente',
      };
    }

    await this.audit.record({
      eventType: 'admin.action',
      occurredAt: now,
      storeId: auth.storeId,
      actorEmployeeId: auth.operatorEmployeeId,
      actorProfileId: auth.operatorProfileId,
      entityType: ENTITY_EMPLOYEE,
      entityId: employee.id,
      deviceId: input.deviceId,
      correlationId: employee.auditCorrelationId,
      source,
      result: 'success',
    });

    return { kind: 'registered', employee, assignment };
  }
}
