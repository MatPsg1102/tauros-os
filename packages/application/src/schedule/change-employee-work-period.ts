// Use case: trocar a JORNADA do colaborador. É alteração do VÍNCULO (RH
// operacional — workforce.write, nunca config.write). Histórico preservado
// por VIGÊNCIA: fecha o vínculo vigente na véspera e abre um novo com a
// jornada nova (mesma equipe, mesma posição). Ordem: fila → local → auditoria
// (admin.action sobre employee_assignments).

import { currentAssignmentFor, decideChangeWorkPeriod } from '@tauros/domain';
import {
  CAPABILITY_WORKFORCE_WRITE,
  ENTITY_EMPLOYEE_ASSIGNMENT,
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type EffectiveAuthorization,
  type EmployeeAssignmentRecord,
  type IdGeneratorPort,
  type ScheduleEnqueuePort,
  type ScheduleRepositoryPort,
  type WorkforceAuditPort,
  type WorkforceRepositoryPort,
} from '@tauros/contracts';

import { operationalDateFor } from '../operator-session/open-operator-session.js';

export interface ChangeEmployeeWorkPeriodInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  /** Fuso IANA da LOJA (dado oficial da loja — nunca o fuso do dispositivo). */
  readonly storeTimeZone: string;
  readonly employeeId: string;
  readonly shiftDefinitionId: string;
  readonly changedOffline: boolean;
}

export type ChangeEmployeeWorkPeriodFailureCode =
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'UNKNOWN_DEFINITION'
  | 'NO_CURRENT_ASSIGNMENT'
  | 'DOMAIN_REJECTED'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type ChangeEmployeeWorkPeriodResult =
  | {
      readonly kind: 'changed';
      readonly closedAssignment: EmployeeAssignmentRecord;
      readonly openedAssignment: EmployeeAssignmentRecord;
    }
  /** Jornada vigente já é a pedida — reapresentação converge. */
  | { readonly kind: 'already-applied'; readonly assignmentId: string }
  | {
      readonly kind: 'failed';
      readonly code: ChangeEmployeeWorkPeriodFailureCode;
      readonly detail: string;
    };

export class ChangeEmployeeWorkPeriodUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly workforce: WorkforceRepositoryPort,
    private readonly schedule: ScheduleRepositoryPort,
    private readonly queue: ScheduleEnqueuePort,
    private readonly audit: WorkforceAuditPort,
  ) {}

  async execute(input: ChangeEmployeeWorkPeriodInput): Promise<ChangeEmployeeWorkPeriodResult> {
    const now = this.clock.now();
    const auth = input.authorization;
    const source = input.changedOffline ? 'client-offline' : 'client-online';

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
        actorProfileId: auth.operatorProfileId,
        entityType: ENTITY_EMPLOYEE_ASSIGNMENT,
        entityId: null,
        deviceId: input.deviceId,
        correlationId: auth.sessionId,
        source,
        result: 'rejected',
        errorCode: CAPABILITY_WORKFORCE_WRITE,
      });
      return { kind: 'failed', code: 'PERMISSION_DENIED', detail: 'capability ausente' };
    }

    // a jornada nova precisa existir na loja (ID oficial)
    const definitions = await this.schedule.definitions(auth.storeId);
    if (!definitions.some((definition) => definition.id === input.shiftDefinitionId)) {
      return { kind: 'failed', code: 'UNKNOWN_DEFINITION', detail: 'jornada não encontrada' };
    }

    const changeDate = operationalDateFor(now, input.storeTimeZone);
    const assignments = await this.workforce.assignments(auth.storeId);
    const current = currentAssignmentFor(assignments, input.employeeId, changeDate);

    const decision = decideChangeWorkPeriod({
      newAssignmentId: this.ids.uuid(),
      current:
        current === null
          ? null
          : {
              id: current.id,
              storeId: current.storeId,
              employeeId: current.employeeId,
              teamId: current.teamId,
              positionId: current.operationalPositionId,
              shiftDefinitionId: current.shiftDefinitionId,
              validFrom: current.validFrom,
            },
      newShiftDefinitionId: input.shiftDefinitionId,
      changeDate,
    });

    if (decision.kind === 'already-applied') {
      return { kind: 'already-applied', assignmentId: decision.assignmentId };
    }
    if (decision.kind === 'rejected') {
      if (decision.code === 'NO_CURRENT_ASSIGNMENT') {
        return { kind: 'failed', code: 'NO_CURRENT_ASSIGNMENT', detail: decision.detail };
      }
      return { kind: 'failed', code: 'DOMAIN_REJECTED', detail: decision.detail };
    }
    if (current === null) {
      // inalcançável: o domínio rejeita sem vínculo vigente
      return { kind: 'failed', code: 'NO_CURRENT_ASSIGNMENT', detail: 'vínculo ausente' };
    }

    const closedAssignment: EmployeeAssignmentRecord = {
      ...current,
      validUntil: decision.closed.validUntil,
    };
    const openedAssignment: EmployeeAssignmentRecord = {
      id: decision.opened.id,
      storeId: decision.opened.storeId,
      employeeId: decision.opened.employeeId,
      teamId: decision.opened.teamId,
      operationalPositionId: current.operationalPositionId,
      shiftDefinitionId: decision.opened.shiftDefinitionId,
      validFrom: decision.opened.validFrom,
      validUntil: decision.opened.validUntil,
    };

    // idempotência determinística: mesmo colaborador + mesma jornada + mesmo
    // dia operacional = UMA troca
    const idempotencyKey = `work-period-change:${auth.storeId}:${input.employeeId}:${changeDate}:${input.shiftDefinitionId}`;

    // 1) intenção durável PRIMEIRO (recuperável); 2) estado local; 3) auditoria
    try {
      await this.queue.enqueueChangeWorkPeriod({
        queueItemId: this.ids.uuid(),
        idempotencyKey,
        closedAssignment,
        openedAssignment,
      });
    } catch (error) {
      await this.audit.record({
        eventType: 'admin.action',
        occurredAt: now,
        storeId: auth.storeId,
        actorProfileId: auth.operatorProfileId,
        entityType: ENTITY_EMPLOYEE_ASSIGNMENT,
        entityId: openedAssignment.id,
        deviceId: input.deviceId,
        correlationId: openedAssignment.id,
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
      await this.workforce.saveAssignment(closedAssignment);
      await this.workforce.saveAssignment(openedAssignment);
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
      actorProfileId: auth.operatorProfileId,
      entityType: ENTITY_EMPLOYEE_ASSIGNMENT,
      entityId: openedAssignment.id,
      deviceId: input.deviceId,
      correlationId: openedAssignment.id,
      source,
      result: 'success',
    });

    return { kind: 'changed', closedAssignment, openedAssignment };
  }
}
