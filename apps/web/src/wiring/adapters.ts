// Adapters do vertical slice (7.1 §6) — implementam os ports de
// @tauros/contracts sobre a infraestrutura congelada. ÚNICO lugar (junto do
// container) autorizado a importar @tauros/infrastructure/config-engine
// (regra mecânica web-ui-no-infrastructure).

import type {
  DailyTaskAssignEnqueuePort,
  DailyTaskAuditPort,
  DailyTaskRecord,
  DailyTaskRepositoryPort,
  EffectiveAuthorization,
  EmployeeAssignmentRecord,
  EmployeeRecord,
  OperationalPositionRecord,
  OperationalPositionView,
  OperatorSessionRecord,
  SessionAuditPort,
  SessionEnqueuePort,
  SessionPolicyPort,
  SessionSyncStatus,
  TaskExecutionEnqueuePort,
  TaskExecutionRecord,
  TaskSyncStatus,
  TaskTemplateRecord,
  TaskTemplateRepositoryPort,
  TaskTemplateSnapshot,
  TaskTemplateSourcePort,
  ScheduleEnqueuePort,
  ScheduleRepositoryPort,
  ScheduleSyncStatus,
  ShiftDefinitionRecord,
  ShiftPatternRecord,
  ShiftSchedulePort,
  TeamDirectoryPort,
  TeamMemberView,
  TeamRecord,
  TemplateAuditPort,
  TemplateEnqueuePort,
  TemplateSyncStatus,
  WorkforceAuditPort,
  WorkforceEnqueuePort,
  WorkforceRepositoryPort,
  WorkforceSyncStatus,
} from '@tauros/contracts';
import {
  ENTITY_DAILY_TASK,
  ENTITY_EMPLOYEE,
  ENTITY_EMPLOYEE_ASSIGNMENT,
  ENTITY_OPERATIONAL_POSITION,
  ENTITY_OPERATOR_SESSION,
  ENTITY_SHIFT_DEFINITION,
  ENTITY_TASK_EXECUTION,
  ENTITY_TASK_TEMPLATE,
} from '@tauros/contracts';
import { currentAssignmentFor, resolvePlannedDay } from '@tauros/domain';
import type { ConfigResolver } from '@tauros/config-engine';
import {
  captureSnapshot,
  type AuditBufferPort,
  type AuditEventFactory,
  type LocalQueueRepository,
  type LocalSchema,
  type LocalStorePort,
} from '@tauros/infrastructure';

// ===== Persistência local do estado do app (DB próprio — não altera o
// schema congelado 'tauros-offline'; mesma porta LocalStorePort). =====

export const APP_STATE_SCHEMA: LocalSchema = {
  databaseName: 'tauros-app-state',
  version: 5,
  migrations: [
    {
      toVersion: 1,
      description: 'Sessões operacionais locais (vertical slice 7.1)',
      stores: [{ name: 'operator_sessions', indexes: { by_store: 'storeId' } }],
    },
    {
      // ADITIVA: só cria stores novos — as sessões da 7.1 são preservadas.
      toVersion: 2,
      description: 'Quadro de tarefas do dia e execuções (7.2)',
      stores: [
        { name: 'daily_tasks', indexes: { by_store_date: 'storeDateKey' } },
        { name: 'task_executions', indexes: { by_store_key: 'storeKey' } },
      ],
    },
    {
      // ADITIVA: definições criadas pelo encarregado (Área do Encarregado).
      toVersion: 3,
      description: 'Definições de tarefa locais do encarregado',
      stores: [
        { name: 'task_templates', indexes: { by_store: 'storeId', by_store_key: 'storeKey' } },
      ],
    },
    {
      // ADITIVA: Gestão de Equipe — espelhos locais do workforce congelado.
      toVersion: 4,
      description: 'Colaboradores, vínculos, equipes e posições (Gestão de Equipe)',
      stores: [
        { name: 'employees', indexes: { by_store: 'storeId', by_store_key: 'storeKey' } },
        { name: 'employee_assignments', indexes: { by_store: 'storeId' } },
        { name: 'teams', indexes: { by_store: 'storeId' } },
        {
          name: 'operational_positions',
          indexes: { by_store: 'storeId', by_store_key: 'storeKey' },
        },
      ],
    },
    {
      // ADITIVA: Escala Operacional — jornadas e padrões de escala da loja.
      toVersion: 5,
      description: 'Jornadas (shift_definitions) e padrões de escala (shift_patterns)',
      stores: [
        { name: 'shift_definitions', indexes: { by_store: 'storeId', by_store_key: 'storeKey' } },
        { name: 'shift_patterns', indexes: { by_store: 'storeId' } },
      ],
    },
  ],
};

const SESSIONS = 'operator_sessions';
const DAILY_TASKS = 'daily_tasks';
const TASK_EXECUTIONS = 'task_executions';
const TASK_TEMPLATES = 'task_templates';
const EMPLOYEES = 'employees';
const EMPLOYEE_ASSIGNMENTS = 'employee_assignments';
const TEAMS = 'teams';
const OPERATIONAL_POSITIONS = 'operational_positions';
const SHIFT_DEFINITIONS = 'shift_definitions';
const SHIFT_PATTERNS = 'shift_patterns';

export class LocalOperatorSessionRepository {
  constructor(private readonly store: LocalStorePort) {}

  async findActive(
    storeId: string,
    actorEmployeeId: string,
  ): Promise<OperatorSessionRecord | null> {
    const rows = await this.store.transaction([SESSIONS], 'read', (tx) =>
      tx.getByIndex(SESSIONS, 'by_store', storeId),
    );
    const active = (rows as OperatorSessionRecord[]).find(
      (row) => row.actorEmployeeId === actorEmployeeId && row.status === 'ACTIVE',
    );
    return active ?? null;
  }

  async save(record: OperatorSessionRecord): Promise<void> {
    await this.store.transaction([SESSIONS], 'write', (tx) => tx.put(SESSIONS, record.id, record));
  }

  async updateSyncStatus(id: string, status: SessionSyncStatus): Promise<void> {
    await this.store.transaction([SESSIONS], 'write', async (tx) => {
      const current = (await tx.get(SESSIONS, id)) as OperatorSessionRecord | undefined;
      if (current === undefined) return;
      await tx.put(SESSIONS, id, { ...current, syncStatus: status });
    });
  }

  async byId(id: string): Promise<OperatorSessionRecord | null> {
    const row = await this.store.transaction([SESSIONS], 'read', (tx) => tx.get(SESSIONS, id));
    return (row as OperatorSessionRecord | undefined) ?? null;
  }
}

// ===== Tarefas do dia (7.2) — materialização local + execuções append-only.
// Chaves de índice são DERIVADAS na borda de persistência (mapper), nunca
// no contrato de domínio. =====

interface DailyTaskRow extends DailyTaskRecord {
  readonly storeDateKey: string;
}

interface TaskExecutionRow extends TaskExecutionRecord {
  readonly storeKey: string;
}

function toTaskRow(record: DailyTaskRecord): DailyTaskRow {
  return { ...record, storeDateKey: `${record.storeId}:${record.workDate}` };
}

function toExecutionRow(record: TaskExecutionRecord): TaskExecutionRow {
  return { ...record, storeKey: `${record.storeId}:${record.idempotencyKey}` };
}

export class LocalDailyTaskRepository implements DailyTaskRepositoryPort {
  constructor(private readonly store: LocalStorePort) {}

  async byWorkDate(storeId: string, workDate: string): Promise<readonly DailyTaskRecord[]> {
    const rows = await this.store.transaction([DAILY_TASKS], 'read', (tx) =>
      tx.getByIndex(DAILY_TASKS, 'by_store_date', `${storeId}:${workDate}`),
    );
    return rows as DailyTaskRecord[];
  }

  async byId(id: string): Promise<DailyTaskRecord | null> {
    const row = await this.store.transaction([DAILY_TASKS], 'read', (tx) =>
      tx.get(DAILY_TASKS, id),
    );
    return (row as DailyTaskRecord | undefined) ?? null;
  }

  async saveAll(records: readonly DailyTaskRecord[]): Promise<void> {
    await this.store.transaction([DAILY_TASKS], 'write', async (tx) => {
      for (const record of records) await tx.put(DAILY_TASKS, record.id, toTaskRow(record));
    });
  }

  async save(record: DailyTaskRecord): Promise<void> {
    await this.store.transaction([DAILY_TASKS], 'write', (tx) =>
      tx.put(DAILY_TASKS, record.id, toTaskRow(record)),
    );
  }

  async executionByIdempotencyKey(
    storeId: string,
    idempotencyKey: string,
  ): Promise<TaskExecutionRecord | null> {
    const rows = await this.store.transaction([TASK_EXECUTIONS], 'read', (tx) =>
      tx.getByIndex(TASK_EXECUTIONS, 'by_store_key', `${storeId}:${idempotencyKey}`),
    );
    return (rows as TaskExecutionRecord[])[0] ?? null;
  }

  /** APPEND-ONLY: uma execução persistida nunca é sobrescrita. */
  async saveExecution(execution: TaskExecutionRecord): Promise<void> {
    await this.store.transaction([TASK_EXECUTIONS], 'write', async (tx) => {
      const current = await tx.get(TASK_EXECUTIONS, execution.id);
      if (current !== undefined) return;
      await tx.put(TASK_EXECUTIONS, execution.id, toExecutionRow(execution));
    });
  }

  /** Único campo mutável: o reflexo do desfecho da fila. */
  async updateExecutionSyncStatus(id: string, status: TaskSyncStatus): Promise<void> {
    await this.store.transaction([TASK_EXECUTIONS], 'write', async (tx) => {
      const current = (await tx.get(TASK_EXECUTIONS, id)) as TaskExecutionRow | undefined;
      if (current === undefined) return;
      await tx.put(TASK_EXECUTIONS, id, { ...current, syncStatus: status });
    });
  }

  async allExecutions(): Promise<readonly TaskExecutionRecord[]> {
    const rows = await this.store.transaction([TASK_EXECUTIONS], 'read', (tx) =>
      tx.getAll(TASK_EXECUTIONS),
    );
    return rows as TaskExecutionRecord[];
  }
}

// ===== Definições de tarefa do encarregado (task_templates locais) =====

interface TemplateRow extends TaskTemplateRecord {
  readonly storeKey: string;
}

function toTemplateRow(record: TaskTemplateRecord): TemplateRow {
  return { ...record, storeKey: `${record.storeId}:${record.idempotencyKey}` };
}

export class LocalTaskTemplateRepository implements TaskTemplateRepositoryPort {
  constructor(private readonly store: LocalStorePort) {}

  async byStore(storeId: string): Promise<readonly TaskTemplateRecord[]> {
    const rows = await this.store.transaction([TASK_TEMPLATES], 'read', (tx) =>
      tx.getByIndex(TASK_TEMPLATES, 'by_store', storeId),
    );
    return rows as TaskTemplateRecord[];
  }

  async byIdempotencyKey(
    storeId: string,
    idempotencyKey: string,
  ): Promise<TaskTemplateRecord | null> {
    const rows = await this.store.transaction([TASK_TEMPLATES], 'read', (tx) =>
      tx.getByIndex(TASK_TEMPLATES, 'by_store_key', `${storeId}:${idempotencyKey}`),
    );
    return (rows as TaskTemplateRecord[])[0] ?? null;
  }

  async save(record: TaskTemplateRecord): Promise<void> {
    await this.store.transaction([TASK_TEMPLATES], 'write', (tx) =>
      tx.put(TASK_TEMPLATES, record.id, toTemplateRow(record)),
    );
  }

  /** Único campo mutável: o reflexo do desfecho da fila. */
  async updateSyncStatus(id: string, status: TemplateSyncStatus): Promise<void> {
    await this.store.transaction([TASK_TEMPLATES], 'write', async (tx) => {
      const current = (await tx.get(TASK_TEMPLATES, id)) as TemplateRow | undefined;
      if (current === undefined) return;
      await tx.put(TASK_TEMPLATES, id, { ...current, syncStatus: status });
    });
  }
}

// ===== Gestão de Equipe — espelhos locais do workforce congelado =====
// Chaves de índice DERIVADAS na borda de persistência (mapper), nunca no
// contrato: employees usa storeId:idempotencyKey; positions usa a chave
// NATURAL storeId:key (unique congelado).

interface EmployeeRow extends EmployeeRecord {
  readonly storeKey: string;
}

interface PositionRow extends OperationalPositionRecord {
  readonly storeKey: string;
}

function toEmployeeRow(record: EmployeeRecord): EmployeeRow {
  return { ...record, storeKey: `${record.storeId}:${record.idempotencyKey}` };
}

function toPositionRow(record: OperationalPositionRecord): PositionRow {
  return { ...record, storeKey: `${record.storeId}:${record.key}` };
}

export class LocalWorkforceRepository implements WorkforceRepositoryPort {
  constructor(private readonly store: LocalStorePort) {}

  async employees(storeId: string): Promise<readonly EmployeeRecord[]> {
    const rows = await this.store.transaction([EMPLOYEES], 'read', (tx) =>
      tx.getByIndex(EMPLOYEES, 'by_store', storeId),
    );
    return rows as EmployeeRecord[];
  }

  async employeeByIdempotencyKey(
    storeId: string,
    idempotencyKey: string,
  ): Promise<EmployeeRecord | null> {
    const rows = await this.store.transaction([EMPLOYEES], 'read', (tx) =>
      tx.getByIndex(EMPLOYEES, 'by_store_key', `${storeId}:${idempotencyKey}`),
    );
    return (rows as EmployeeRecord[])[0] ?? null;
  }

  async assignments(storeId: string): Promise<readonly EmployeeAssignmentRecord[]> {
    const rows = await this.store.transaction([EMPLOYEE_ASSIGNMENTS], 'read', (tx) =>
      tx.getByIndex(EMPLOYEE_ASSIGNMENTS, 'by_store', storeId),
    );
    // tolerância a registros v4 (anteriores à Escala V1): sem jornada declarada
    return (
      rows as (EmployeeAssignmentRecord | Omit<EmployeeAssignmentRecord, 'shiftDefinitionId'>)[]
    ).map((row) => ({
      ...row,
      shiftDefinitionId: 'shiftDefinitionId' in row ? row.shiftDefinitionId : null,
    }));
  }

  /** Grava/atualiza um vínculo isolado (troca de jornada por vigência). */
  async saveAssignment(record: EmployeeAssignmentRecord): Promise<void> {
    await this.store.transaction([EMPLOYEE_ASSIGNMENTS], 'write', (tx) =>
      tx.put(EMPLOYEE_ASSIGNMENTS, record.id, record),
    );
  }

  /** Cadastro ATÔMICO: pessoa + vínculo na MESMA transação local. */
  async saveRegistration(
    employee: EmployeeRecord,
    assignment: EmployeeAssignmentRecord,
  ): Promise<void> {
    await this.store.transaction([EMPLOYEES, EMPLOYEE_ASSIGNMENTS], 'write', async (tx) => {
      await tx.put(EMPLOYEES, employee.id, toEmployeeRow(employee));
      await tx.put(EMPLOYEE_ASSIGNMENTS, assignment.id, assignment);
    });
  }

  /** Único campo mutável: o reflexo do desfecho da fila. */
  async updateEmployeeSyncStatus(id: string, status: WorkforceSyncStatus): Promise<void> {
    await this.store.transaction([EMPLOYEES], 'write', async (tx) => {
      const current = (await tx.get(EMPLOYEES, id)) as EmployeeRow | undefined;
      if (current === undefined) return;
      await tx.put(EMPLOYEES, id, { ...current, syncStatus: status });
    });
  }

  async teams(storeId: string): Promise<readonly TeamRecord[]> {
    const rows = await this.store.transaction([TEAMS], 'read', (tx) =>
      tx.getByIndex(TEAMS, 'by_store', storeId),
    );
    // tolerância a registros v4 (anteriores à Escala V1): offset padrão 0
    return (rows as (TeamRecord | Omit<TeamRecord, 'rotationOffset'>)[]).map((row) => ({
      ...row,
      rotationOffset: 'rotationOffset' in row ? row.rotationOffset : 0,
    }));
  }

  async saveTeam(record: TeamRecord): Promise<void> {
    await this.store.transaction([TEAMS], 'write', (tx) => tx.put(TEAMS, record.id, record));
  }

  async positions(storeId: string): Promise<readonly OperationalPositionRecord[]> {
    const rows = await this.store.transaction([OPERATIONAL_POSITIONS], 'read', (tx) =>
      tx.getByIndex(OPERATIONAL_POSITIONS, 'by_store', storeId),
    );
    return rows as OperationalPositionRecord[];
  }

  async positionByKey(storeId: string, key: string): Promise<OperationalPositionRecord | null> {
    const rows = await this.store.transaction([OPERATIONAL_POSITIONS], 'read', (tx) =>
      tx.getByIndex(OPERATIONAL_POSITIONS, 'by_store_key', `${storeId}:${key}`),
    );
    return (rows as OperationalPositionRecord[])[0] ?? null;
  }

  async savePosition(record: OperationalPositionRecord): Promise<void> {
    await this.store.transaction([OPERATIONAL_POSITIONS], 'write', (tx) =>
      tx.put(OPERATIONAL_POSITIONS, record.id, toPositionRow(record)),
    );
  }

  /** Único campo mutável: o reflexo do desfecho da fila. */
  async updatePositionSyncStatus(id: string, status: WorkforceSyncStatus): Promise<void> {
    await this.store.transaction([OPERATIONAL_POSITIONS], 'write', async (tx) => {
      const current = (await tx.get(OPERATIONAL_POSITIONS, id)) as PositionRow | undefined;
      if (current === undefined) return;
      await tx.put(OPERATIONAL_POSITIONS, id, { ...current, syncStatus: status });
    });
  }
}

// ===== Escala Operacional — jornadas e padrões como DADOS da loja =====

interface DefinitionRow extends ShiftDefinitionRecord {
  readonly storeKey: string;
}

/** Chave natural: loja + janela — mesma jornada nunca duplica. */
function toDefinitionRow(record: ShiftDefinitionRecord): DefinitionRow {
  return { ...record, storeKey: `${record.storeId}:${record.startTime}-${record.endTime}` };
}

export class LocalScheduleRepository implements ScheduleRepositoryPort {
  constructor(private readonly store: LocalStorePort) {}

  async definitions(storeId: string): Promise<readonly ShiftDefinitionRecord[]> {
    const rows = await this.store.transaction([SHIFT_DEFINITIONS], 'read', (tx) =>
      tx.getByIndex(SHIFT_DEFINITIONS, 'by_store', storeId),
    );
    return rows as ShiftDefinitionRecord[];
  }

  async definitionByWindow(
    storeId: string,
    startTime: string,
    endTime: string,
  ): Promise<ShiftDefinitionRecord | null> {
    const rows = await this.store.transaction([SHIFT_DEFINITIONS], 'read', (tx) =>
      tx.getByIndex(SHIFT_DEFINITIONS, 'by_store_key', `${storeId}:${startTime}-${endTime}`),
    );
    return (rows as ShiftDefinitionRecord[])[0] ?? null;
  }

  async saveDefinition(record: ShiftDefinitionRecord): Promise<void> {
    await this.store.transaction([SHIFT_DEFINITIONS], 'write', (tx) =>
      tx.put(SHIFT_DEFINITIONS, record.id, toDefinitionRow(record)),
    );
  }

  /** Único campo mutável: o reflexo do desfecho da fila. */
  async updateDefinitionSyncStatus(id: string, status: ScheduleSyncStatus): Promise<void> {
    await this.store.transaction([SHIFT_DEFINITIONS], 'write', async (tx) => {
      const current = (await tx.get(SHIFT_DEFINITIONS, id)) as DefinitionRow | undefined;
      if (current === undefined) return;
      await tx.put(SHIFT_DEFINITIONS, id, { ...current, syncStatus: status });
    });
  }

  async patterns(storeId: string): Promise<readonly ShiftPatternRecord[]> {
    const rows = await this.store.transaction([SHIFT_PATTERNS], 'read', (tx) =>
      tx.getByIndex(SHIFT_PATTERNS, 'by_store', storeId),
    );
    return rows as ShiftPatternRecord[];
  }

  async savePattern(record: ShiftPatternRecord): Promise<void> {
    await this.store.transaction([SHIFT_PATTERNS], 'write', (tx) =>
      tx.put(SHIFT_PATTERNS, record.id, record),
    );
  }
}

// ===== Escala na fila oficial =====

export class ScheduleQueueAdapter implements ScheduleEnqueuePort {
  constructor(
    private readonly queue: LocalQueueRepository,
    private readonly authorization: () => EffectiveAuthorization,
    private readonly deviceId: string,
    private readonly clock: () => Date,
  ) {}

  /** Snapshot de autorização vinculado ao item (RA-QUEUE-01). */
  private snapshotNow(auth: EffectiveAuthorization) {
    const ttlMs = Math.max(1, auth.validUntil.getTime() - this.clock().getTime());
    return captureSnapshot(
      {
        operatorProfileId: auth.operatorProfileId,
        operatorEmployeeId: auth.operatorEmployeeId,
        storeId: auth.storeId,
        sessionId: auth.sessionId,
        permissions: auth.permissions,
        ...(auth.permissionModelVersion !== undefined
          ? { permissionModelVersion: auth.permissionModelVersion }
          : {}),
        ...(auth.configVersionRef !== undefined ? { configVersionRef: auth.configVersionRef } : {}),
        authOrigin: auth.origin === 'online' ? 'online' : 'offline-pin',
      },
      ttlMs,
      this.clock,
    );
  }

  async enqueueCreateShiftDefinition(
    input: Parameters<ScheduleEnqueuePort['enqueueCreateShiftDefinition']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'insert',
      entityType: ENTITY_SHIFT_DEFINITION,
      entityId: input.definition.id,
      payload: { definition: input.definition },
      idempotencyKey: input.definition.idempotencyKey,
      authorization: this.snapshotNow(auth),
      trace: {
        storeId: input.definition.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 2,
      },
    });
  }

  async enqueueChangeWorkPeriod(
    input: Parameters<ScheduleEnqueuePort['enqueueChangeWorkPeriod']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    // a troca depende no DAG da jornada recém-criada offline que referencia e
    // do CADASTRO do colaborador ainda pendente (FKs no servidor)
    const all = await this.queue.all();
    const dependsOn = all
      .filter(
        (item) =>
          (item.entityType === ENTITY_SHIFT_DEFINITION &&
            item.entityId === input.openedAssignment.shiftDefinitionId) ||
          (item.entityType === ENTITY_EMPLOYEE &&
            item.entityId === input.openedAssignment.employeeId),
      )
      .map((item) => item.id);
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'update',
      entityType: ENTITY_EMPLOYEE_ASSIGNMENT,
      entityId: input.openedAssignment.id,
      payload: {
        closedAssignment: input.closedAssignment,
        openedAssignment: input.openedAssignment,
      },
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
      idempotencyKey: input.idempotencyKey,
      authorization: this.snapshotNow(auth),
      trace: {
        storeId: input.openedAssignment.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 2,
      },
    });
  }
}

/**
 * Diretório de equipe (TeamDirectoryPort) sobre o CADASTRO REAL da Gestão de
 * Equipe. members() expõe a posição VIGENTE na data operacional de hoje
 * (validFrom ≤ hoje < validUntil) — vigência de vínculo, NUNCA presença de
 * escala (equipe ≠ presença; presença chega com a Escala Operacional V1).
 */
export class LocalTeamDirectory implements TeamDirectoryPort {
  constructor(
    private readonly workforce: LocalWorkforceRepository,
    /** Data operacional corrente YYYY-MM-DD no fuso da LOJA (wiring). */
    private readonly today: () => string,
  ) {}

  async positions(storeId: string): Promise<readonly OperationalPositionView[]> {
    const records = await this.workforce.positions(storeId);
    return records.map((record) => ({ id: record.id, key: record.key, name: record.name }));
  }

  async members(storeId: string): Promise<readonly TeamMemberView[]> {
    const today = this.today();
    const [employees, assignments] = await Promise.all([
      this.workforce.employees(storeId),
      this.workforce.assignments(storeId),
    ]);
    return employees
      .filter((employee) => employee.active)
      .map((employee) => {
        // regra ÚNICA de vigência de vínculo — mesma do resolver de escala
        const current = currentAssignmentFor(assignments, employee.id, today);
        return {
          employeeId: employee.id,
          fullName: employee.fullName,
          positionId: current?.operationalPositionId ?? null,
        };
      });
  }
}

/**
 * ShiftSchedulePort REAL (Recorrência V1): responde "a posição está escalada
 * nesta data?" delegando ao ÚNICO resolver de escala do sistema
 * (resolvePlannedDay — Escala Operacional V1). Substitui a antiga
 * FixtureShiftSchedule na materialização: nenhuma regra própria aqui — uma
 * posição está escalada quando ALGUM colaborador vigente nela pertence a uma
 * equipe que trabalha na data (troca de OCUPANTE preserva o veredito, pois a
 * recorrência é da POSIÇÃO, nunca do funcionário).
 */
export class PlannedScheduleAdapter implements ShiftSchedulePort {
  constructor(
    private readonly workforce: LocalWorkforceRepository,
    private readonly schedule: LocalScheduleRepository,
    /** Âncora da rotação da LOJA (stores.shift_anchor_date) — dado, não regra. */
    private readonly anchorDate: () => string | null,
  ) {}

  async isPositionScheduled(
    storeId: string,
    positionId: string,
    workDate: string,
  ): Promise<boolean> {
    const [employees, assignments, teams, patterns] = await Promise.all([
      this.workforce.employees(storeId),
      this.workforce.assignments(storeId),
      this.workforce.teams(storeId),
      this.schedule.patterns(storeId),
    ]);
    const decision = resolvePlannedDay({
      storeId,
      operationalDate: workDate,
      anchorDate: this.anchorDate(),
      patterns: patterns.map((pattern) => ({
        id: pattern.id,
        name: pattern.name,
        effectiveFrom: pattern.effectiveFrom,
        effectiveUntil: pattern.effectiveUntil,
        days: pattern.days,
      })),
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        rotationOffset: team.rotationOffset,
      })),
      employees: employees.map((employee) => ({
        id: employee.id,
        fullName: employee.fullName,
        active: employee.active,
      })),
      assignments: assignments.map((assignment) => ({
        employeeId: assignment.employeeId,
        teamId: assignment.teamId,
        positionId: assignment.operationalPositionId,
        shiftDefinitionId: assignment.shiftDefinitionId,
        validFrom: assignment.validFrom,
        validUntil: assignment.validUntil,
      })),
    });
    if (decision.kind !== 'resolved') return false;
    return decision.employees.some((employee) => employee.positionId === positionId);
  }
}

/**
 * Diretório composto: cadastro base (fixtures de desenvolvimento até o
 * diretório real do backend) + Gestão de Equipe local — MESMO padrão do
 * CompositeTaskTemplateSource. Colaboradores e posições cadastrados aqui
 * aparecem imediatamente nos seletores de atribuição de tarefa.
 */
export class CompositeTeamDirectory implements TeamDirectoryPort {
  constructor(
    private readonly base: TeamDirectoryPort,
    private readonly local: LocalTeamDirectory,
  ) {}

  async positions(storeId: string): Promise<readonly OperationalPositionView[]> {
    const [base, local] = await Promise.all([
      this.base.positions(storeId),
      this.local.positions(storeId),
    ]);
    const seen = new Set(base.map((position) => position.id));
    return [...base, ...local.filter((position) => !seen.has(position.id))];
  }

  async members(storeId: string): Promise<readonly TeamMemberView[]> {
    const [base, local] = await Promise.all([
      this.base.members(storeId),
      this.local.members(storeId),
    ]);
    const seen = new Set(base.map((member) => member.employeeId));
    return [...base, ...local.filter((member) => !seen.has(member.employeeId))];
  }
}

/**
 * Fonte de definições para a materialização do dia: fixtures de
 * desenvolvimento (cadastro base) + definições criadas localmente pelo
 * encarregado. Trocável pelo adapter real sem tocar aplicação/UI.
 */
export class CompositeTaskTemplateSource implements TaskTemplateSourcePort {
  constructor(
    private readonly base: TaskTemplateSourcePort,
    private readonly local: LocalTaskTemplateRepository,
  ) {}

  async activeTemplates(storeId: string): Promise<readonly TaskTemplateSnapshot[]> {
    const [base, created] = await Promise.all([
      this.base.activeTemplates(storeId),
      this.local.byStore(storeId),
    ]);
    const createdSnapshots: readonly TaskTemplateSnapshot[] = created
      .filter((record) => record.active)
      .map((record) => ({
        templateId: record.id,
        title: record.title,
        frequency: record.frequency,
        requiresPhoto: record.requiresPhoto,
        expectedMin: record.expectedMin,
        expectedMax: record.expectedMax,
        targetPositionId: record.targetPositionId,
        dueOffsetMinutes: record.dueOffsetMinutes,
        effectiveFrom: record.effectiveFrom,
        plannedStartMinutes: record.plannedStartMinutes,
        recurrence: record.recurrence,
      }));
    return [...base, ...createdSnapshots];
  }
}

// ===== Auditoria da criação de definição (config.changed — tipo oficial) =====

export class TemplateAuditAdapter implements TemplateAuditPort {
  constructor(
    private readonly factory: AuditEventFactory,
    private readonly buffer: AuditBufferPort,
  ) {}

  async record(input: Parameters<TemplateAuditPort['record']>[0]): Promise<void> {
    const event = this.factory.fromDirect({
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      storeId: input.storeId,
      actorId: input.actorProfileId,
      actorType: 'human',
      sessionId: null,
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      entityType: ENTITY_TASK_TEMPLATE,
      entityId: input.templateId,
      operation: 'create',
      source: input.source,
      result: input.result,
      errorCode: input.errorCode ?? null,
    });
    await this.buffer.append(event);
  }
}

// ===== Criação de definição na fila oficial =====

export class TemplateQueueAdapter implements TemplateEnqueuePort {
  constructor(
    private readonly queue: LocalQueueRepository,
    private readonly authorization: () => EffectiveAuthorization,
    private readonly deviceId: string,
    private readonly clock: () => Date,
  ) {}

  async enqueueCreateTemplate(
    input: Parameters<TemplateEnqueuePort['enqueueCreateTemplate']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    const ttlMs = Math.max(1, auth.validUntil.getTime() - this.clock().getTime());
    const snapshot = captureSnapshot(
      {
        operatorProfileId: auth.operatorProfileId,
        operatorEmployeeId: auth.operatorEmployeeId,
        storeId: auth.storeId,
        sessionId: auth.sessionId,
        permissions: auth.permissions,
        ...(auth.permissionModelVersion !== undefined
          ? { permissionModelVersion: auth.permissionModelVersion }
          : {}),
        ...(auth.configVersionRef !== undefined ? { configVersionRef: auth.configVersionRef } : {}),
        authOrigin: auth.origin === 'online' ? 'online' : 'offline-pin',
      },
      ttlMs,
      this.clock,
    );
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'insert',
      entityType: ENTITY_TASK_TEMPLATE,
      entityId: input.template.id,
      payload: { template: input.template },
      idempotencyKey: input.template.idempotencyKey,
      authorization: snapshot,
      trace: {
        storeId: input.template.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 2,
      },
    });
  }
}

// ===== Gestão de Equipe na fila oficial =====

export class WorkforceQueueAdapter implements WorkforceEnqueuePort {
  constructor(
    private readonly queue: LocalQueueRepository,
    private readonly authorization: () => EffectiveAuthorization,
    private readonly deviceId: string,
    private readonly clock: () => Date,
  ) {}

  /** Snapshot de autorização vinculado ao item (RA-QUEUE-01). */
  private snapshotNow(auth: EffectiveAuthorization) {
    const ttlMs = Math.max(1, auth.validUntil.getTime() - this.clock().getTime());
    return captureSnapshot(
      {
        operatorProfileId: auth.operatorProfileId,
        operatorEmployeeId: auth.operatorEmployeeId,
        storeId: auth.storeId,
        sessionId: auth.sessionId,
        permissions: auth.permissions,
        ...(auth.permissionModelVersion !== undefined
          ? { permissionModelVersion: auth.permissionModelVersion }
          : {}),
        ...(auth.configVersionRef !== undefined ? { configVersionRef: auth.configVersionRef } : {}),
        authOrigin: auth.origin === 'online' ? 'online' : 'offline-pin',
      },
      ttlMs,
      this.clock,
    );
  }

  async enqueueRegisterEmployee(
    input: Parameters<WorkforceEnqueuePort['enqueueRegisterEmployee']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    // o cadastro só pode chegar ao servidor DEPOIS da posição recém-criada
    // offline que ele referencia (ordem do DAG — FK de employee_assignments)
    const all = await this.queue.all();
    const dependsOn = all
      .filter(
        (item) =>
          item.entityType === ENTITY_OPERATIONAL_POSITION &&
          item.entityId === input.assignment.operationalPositionId,
      )
      .map((item) => item.id);
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'insert',
      entityType: ENTITY_EMPLOYEE,
      entityId: input.employee.id,
      payload: { employee: input.employee, assignment: input.assignment },
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
      idempotencyKey: input.employee.idempotencyKey,
      authorization: this.snapshotNow(auth),
      trace: {
        storeId: input.employee.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 2,
      },
    });
  }

  async enqueueCreatePosition(
    input: Parameters<WorkforceEnqueuePort['enqueueCreatePosition']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'insert',
      entityType: ENTITY_OPERATIONAL_POSITION,
      entityId: input.position.id,
      payload: { position: input.position },
      idempotencyKey: input.position.idempotencyKey,
      authorization: this.snapshotNow(auth),
      trace: {
        storeId: input.position.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 2,
      },
    });
  }
}

// ===== Auditoria da gestão de equipe (tipos OFICIAIS do catálogo) =====

export class WorkforceAuditAdapter implements WorkforceAuditPort {
  constructor(
    private readonly factory: AuditEventFactory,
    private readonly buffer: AuditBufferPort,
  ) {}

  async record(input: Parameters<WorkforceAuditPort['record']>[0]): Promise<void> {
    const event = this.factory.fromDirect({
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      storeId: input.storeId,
      actorId: input.actorProfileId,
      actorType: 'human',
      sessionId: null,
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: 'create',
      source: input.source,
      result: input.result,
      errorCode: input.errorCode ?? null,
    });
    await this.buffer.append(event);
  }
}

// ===== Atribuição situacional da ocorrência (update na fila oficial) =====

export class DailyTaskAssignQueueAdapter implements DailyTaskAssignEnqueuePort {
  constructor(
    private readonly queue: LocalQueueRepository,
    private readonly authorization: () => EffectiveAuthorization,
    private readonly deviceId: string,
    private readonly clock: () => Date,
  ) {}

  async enqueueAssignDailyTask(
    input: Parameters<DailyTaskAssignEnqueuePort['enqueueAssignDailyTask']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    const task = input.dailyTask;
    const ttlMs = Math.max(1, auth.validUntil.getTime() - this.clock().getTime());
    const snapshot = captureSnapshot(
      {
        operatorProfileId: auth.operatorProfileId,
        operatorEmployeeId: auth.operatorEmployeeId,
        storeId: auth.storeId,
        sessionId: auth.sessionId,
        permissions: auth.permissions,
        ...(auth.permissionModelVersion !== undefined
          ? { permissionModelVersion: auth.permissionModelVersion }
          : {}),
        ...(auth.configVersionRef !== undefined ? { configVersionRef: auth.configVersionRef } : {}),
        authOrigin: auth.origin === 'online' ? 'online' : 'offline-pin',
      },
      ttlMs,
      this.clock,
    );
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'update',
      entityType: ENTITY_DAILY_TASK,
      entityId: task.id,
      payload: { dailyTask: task },
      // idempotência: a MESMA ocorrência + MESMA posição convergem numa atribuição
      idempotencyKey: `daily-task-assign:${task.id}:${task.assignedPositionId ?? ''}`,
      authorization: snapshot,
      trace: {
        storeId: task.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 2,
      },
    });
  }
}

// ===== Auditoria da negação de atribuição (access.denied — tipo oficial) =====

export class DailyTaskAuditAdapter implements DailyTaskAuditPort {
  constructor(
    private readonly factory: AuditEventFactory,
    private readonly buffer: AuditBufferPort,
  ) {}

  async record(input: Parameters<DailyTaskAuditPort['record']>[0]): Promise<void> {
    const event = this.factory.fromDirect({
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      storeId: input.storeId,
      actorId: input.actorProfileId,
      actorType: 'human',
      sessionId: null,
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      entityType: ENTITY_DAILY_TASK,
      entityId: input.dailyTaskId,
      operation: 'update',
      source: input.source,
      result: input.result,
      errorCode: input.errorCode ?? null,
    });
    await this.buffer.append(event);
  }
}

// ===== Política efetiva via Configuration Engine (ADR-019) =====

export class ConfigSessionPolicyAdapter implements SessionPolicyPort {
  constructor(private readonly resolver: ConfigResolver) {}

  async sessionOpeningPolicy(storeId: string) {
    return {
      sessionAbsoluteMaxMs: await this.resolver.resolve('session.absoluteMaxMs', storeId),
      pinOfflineValidityMs: await this.resolver.resolve('auth.pin.offlineValidityMs', storeId),
      configVersionRef: null, // versões de config chegam com o backend real
    };
  }

  async sessionClosingPolicy(storeId: string) {
    return {
      sessionAbsoluteMaxMs: await this.resolver.resolve('session.absoluteMaxMs', storeId),
      reauthOnAbsolute: await this.resolver.resolve('session.reauthOnAbsolute', storeId),
      configVersionRef: null,
    };
  }
}

// ===== Auditoria direta (eventos de segurança §13 do modelo congelado) =====

export class SessionAuditAdapter implements SessionAuditPort {
  constructor(
    private readonly factory: AuditEventFactory,
    private readonly buffer: AuditBufferPort,
  ) {}

  async record(input: Parameters<SessionAuditPort['record']>[0]): Promise<void> {
    const event = this.factory.fromDirect({
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      storeId: input.storeId,
      actorId: input.actorProfileId,
      actorType: 'human',
      sessionId: input.sessionId,
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      entityType: ENTITY_OPERATOR_SESSION,
      entityId: input.sessionId,
      operation: input.operation ?? 'open',
      source: input.source,
      result: input.result,
      errorCode: input.errorCode ?? null,
    });
    await this.buffer.append(event);
  }
}

// ===== Intenção durável na fila oficial (RA-QUEUE-01) =====

export class SessionQueueAdapter implements SessionEnqueuePort {
  constructor(
    private readonly queue: LocalQueueRepository,
    private readonly authorization: () => EffectiveAuthorization,
    private readonly deviceId: string,
    private readonly clock: () => Date,
  ) {}

  /** Snapshot de autorização vinculado ao item (RA-QUEUE-01). */
  private snapshotNow(auth: EffectiveAuthorization) {
    const ttlMs = Math.max(1, auth.validUntil.getTime() - this.clock().getTime());
    return captureSnapshot(
      {
        operatorProfileId: auth.operatorProfileId,
        operatorEmployeeId: auth.operatorEmployeeId,
        storeId: auth.storeId,
        sessionId: auth.sessionId,
        permissions: auth.permissions,
        ...(auth.permissionModelVersion !== undefined
          ? { permissionModelVersion: auth.permissionModelVersion }
          : {}),
        ...(auth.configVersionRef !== undefined ? { configVersionRef: auth.configVersionRef } : {}),
        authOrigin: auth.origin === 'online' ? 'online' : 'offline-pin',
      },
      ttlMs,
      this.clock,
    );
  }

  /** Itens ainda pendentes desta entidade — base das dependências do DAG. */
  private async pendingItemIdsFor(entityType: string, entityId: string): Promise<string[]> {
    const all = await this.queue.all();
    return all
      .filter((item) => item.entityType === entityType && item.entityId === entityId)
      .map((item) => item.id);
  }

  async enqueueCloseSession(
    input: Parameters<SessionEnqueuePort['enqueueCloseSession']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    // o fechamento só pode chegar ao servidor DEPOIS da abertura (ordem do DAG)
    const dependsOn = await this.pendingItemIdsFor(ENTITY_OPERATOR_SESSION, input.sessionId);
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'update',
      entityType: ENTITY_OPERATOR_SESSION,
      entityId: input.sessionId,
      payload: input.payload,
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
      idempotencyKey: input.idempotencyKey,
      authorization: this.snapshotNow(auth),
      trace: {
        storeId: input.payload.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 1,
      },
    });
  }

  async enqueueOpenSession(
    input: Parameters<SessionEnqueuePort['enqueueOpenSession']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'insert',
      entityType: ENTITY_OPERATOR_SESSION,
      entityId: input.record.id,
      payload: { record: input.record },
      idempotencyKey: input.record.idempotencyKey,
      authorization: this.snapshotNow(auth),
      trace: {
        storeId: input.record.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: 1,
        priority: 1,
      },
    });
  }
}

// ===== Execuções de tarefa na fila oficial (7.2) =====

export class TaskExecutionQueueAdapter implements TaskExecutionEnqueuePort {
  constructor(
    private readonly queue: LocalQueueRepository,
    private readonly authorization: () => EffectiveAuthorization,
    private readonly deviceId: string,
    private readonly clock: () => Date,
  ) {}

  async enqueueTaskExecution(
    input: Parameters<TaskExecutionEnqueuePort['enqueueTaskExecution']>[0],
  ): Promise<void> {
    const auth = this.authorization();
    const execution = input.execution;
    const ttlMs = Math.max(1, auth.validUntil.getTime() - this.clock().getTime());
    const snapshot = captureSnapshot(
      {
        operatorProfileId: auth.operatorProfileId,
        operatorEmployeeId: auth.operatorEmployeeId,
        storeId: auth.storeId,
        sessionId: auth.sessionId,
        permissions: auth.permissions,
        ...(auth.permissionModelVersion !== undefined
          ? { permissionModelVersion: auth.permissionModelVersion }
          : {}),
        ...(auth.configVersionRef !== undefined ? { configVersionRef: auth.configVersionRef } : {}),
        authOrigin: auth.origin === 'online' ? 'online' : 'offline-pin',
      },
      ttlMs,
      this.clock,
    );
    // a execução depende da ABERTURA do turno que lhe dá autoria (ADR-014)
    const all = await this.queue.all();
    const dependsOn = all
      .filter(
        (item) =>
          item.entityType === ENTITY_OPERATOR_SESSION &&
          item.entityId === execution.operatorSessionId,
      )
      .map((item) => item.id);
    await this.queue.enqueue({
      id: input.queueItemId,
      operation: 'insert',
      entityType: ENTITY_TASK_EXECUTION,
      entityId: execution.id,
      payload: { execution },
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
      idempotencyKey: execution.idempotencyKey,
      authorization: snapshot,
      trace: {
        storeId: execution.storeId,
        deviceId: this.deviceId,
        sessionId: auth.sessionId,
        schemaVersion: execution.schemaVersion,
        priority: 2,
      },
    });
  }
}
