// Composition root (7.1 §6/§14) — monta o vertical slice inteiro sobre a
// infraestrutura congelada. Browser usa IndexedDB; testes injetam Memory.
// Recuperação explícita: intenção durável (fila) sem registro local ⇒
// reconcileFromQueue reconstrói o estado no boot (atomicidade §35).

import {
  AssignDailyTaskUseCase,
  ChangeEmployeeWorkPeriodUseCase,
  CloseOperatorSessionUseCase,
  CreateOperationalPositionUseCase,
  CreateShiftDefinitionUseCase,
  CreateTaskTemplateUseCase,
  LoadDailyTasksUseCase,
  LoadPlannedScheduleUseCase,
  OpenOperatorSessionUseCase,
  operationalDateFor,
  RecordTaskOutcomeUseCase,
  RegisterEmployeeUseCase,
} from '@tauros/application';
import { ConfigResolver } from '@tauros/config-engine';
import type {
  AssignDailyTaskQueuePayload,
  ChangeWorkPeriodQueuePayload,
  CloseSessionQueuePayload,
  CreatePositionQueuePayload,
  CreateShiftDefinitionQueuePayload,
  CreateTemplateQueuePayload,
  EffectiveAuthorization,
  OperatorSessionRecord,
  RegisterEmployeeQueuePayload,
  ShiftSchedulePort,
  TaskExecutionQueuePayload,
  TaskTemplateSourcePort,
  TeamDirectoryPort,
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
import {
  AuditEventFactory,
  AuditingEventBridge,
  CompositeConnectivity,
  DefaultAuditPolicy,
  DefaultAuditSanitizer,
  IndexedDbLocalStore,
  LocalAuditBuffer,
  LocalQueueRepository,
  MemoryLocalStore,
  NoopEventEmitter,
  OFFLINE_SCHEMA,
  QueueProcessor,
  QueueScheduler,
  RetryPolicy,
  SyncCoordinator,
  ConflictResolverRegistry,
  resolveOfflineParameters,
  type ConnectivityPort,
  type LocalStorePort,
  type QueueItem,
  type SyncTransportPort,
  type TechnicalEventPort,
} from '@tauros/infrastructure';
import type { SessionSyncStatus } from '@tauros/contracts';

import {
  APP_STATE_SCHEMA,
  CompositeTaskTemplateSource,
  CompositeTeamDirectory,
  ConfigSessionPolicyAdapter,
  DailyTaskAssignQueueAdapter,
  DailyTaskAuditAdapter,
  LocalDailyTaskRepository,
  LocalOperatorSessionRepository,
  LocalScheduleRepository,
  LocalTaskTemplateRepository,
  LocalTeamDirectory,
  LocalWorkforceRepository,
  ScheduleQueueAdapter,
  SessionAuditAdapter,
  SessionQueueAdapter,
  TaskExecutionQueueAdapter,
  TemplateAuditAdapter,
  TemplateQueueAdapter,
  WorkforceAuditAdapter,
  WorkforceQueueAdapter,
} from './adapters.js';
import {
  FIXTURE_STORE,
  FixtureShiftSchedule,
  FixtureTaskTemplateSource,
  FixtureTeamDirectory,
} from './fixtures.js';
import { ensureWorkforceBaseline } from './workforce-baseline.js';
import { FakeSessionSyncTransport } from './transport-fake.js';

export interface ContainerOptions {
  readonly clock?: () => Date;
  readonly deviceId?: string;
  readonly offlineStore?: LocalStorePort;
  readonly appStore?: LocalStorePort;
  readonly transport?: SyncTransportPort;
  readonly deviceOnline?: () => boolean;
  readonly events?: TechnicalEventPort;
  readonly templates?: TaskTemplateSourcePort;
  readonly team?: TeamDirectoryPort;
  readonly schedule?: ShiftSchedulePort;
}

export interface AppContainer {
  readonly clock: () => Date;
  readonly deviceId: string;
  readonly config: ConfigResolver;
  readonly sessions: LocalOperatorSessionRepository;
  readonly queue: LocalQueueRepository;
  readonly transport: SyncTransportPort;
  readonly connectivity: ConnectivityPort;
  readonly tasks: LocalDailyTaskRepository;
  readonly templates: LocalTaskTemplateRepository;
  readonly team: TeamDirectoryPort;
  readonly workforce: LocalWorkforceRepository;
  readonly scheduleData: LocalScheduleRepository;
  readonly setAuthorization: (auth: EffectiveAuthorization | null) => void;
  readonly openSession: OpenOperatorSessionUseCase;
  readonly closeSession: CloseOperatorSessionUseCase;
  readonly loadDailyTasks: LoadDailyTasksUseCase;
  readonly recordTaskOutcome: RecordTaskOutcomeUseCase;
  readonly createTaskTemplate: CreateTaskTemplateUseCase;
  readonly assignDailyTask: AssignDailyTaskUseCase;
  readonly registerEmployee: RegisterEmployeeUseCase;
  readonly createPosition: CreateOperationalPositionUseCase;
  readonly createShiftDefinition: CreateShiftDefinitionUseCase;
  readonly changeWorkPeriod: ChangeEmployeeWorkPeriodUseCase;
  readonly loadPlannedSchedule: LoadPlannedScheduleUseCase;
  /** Drena a fila e reflete o desfecho no syncStatus do registro local. */
  readonly drainAndReflect: () => Promise<void>;
  /** Recuperação de boot: fila com intenção sem registro local ⇒ reconstrói. */
  readonly reconcileFromQueue: () => Promise<void>;
  readonly queueItemForSession: (sessionId: string) => Promise<QueueItem | undefined>;
  readonly close: () => Promise<void>;
}

export function buildContainer(options: ContainerOptions = {}): AppContainer {
  // ref mutável: a ponte de auditoria precisa da fila que só existe depois
  const queueRef: { current?: LocalQueueRepository } = {};
  const clock = options.clock ?? ((): Date => new Date());
  const deviceId = options.deviceId ?? 'device-web-01';

  const offlineStore =
    options.offlineStore ??
    (typeof indexedDB === 'undefined'
      ? new MemoryLocalStore(OFFLINE_SCHEMA)
      : new IndexedDbLocalStore(OFFLINE_SCHEMA));
  const appStore =
    options.appStore ??
    (typeof indexedDB === 'undefined'
      ? new MemoryLocalStore(APP_STATE_SCHEMA)
      : new IndexedDbLocalStore(APP_STATE_SCHEMA));

  // Configuration Engine com fonte local (overrides chegam com o backend real)
  const config = new ConfigResolver({ loadStoreOverrides: () => Promise.resolve([]) }, clock);

  // Auditoria: outbox durável + ponte que promove eventos técnicos por política
  const policy = new DefaultAuditPolicy();
  const sanitizer = new DefaultAuditSanitizer();
  const factory = new AuditEventFactory(policy, sanitizer, clock);
  const buffer = new LocalAuditBuffer(offlineStore, clock);
  const events: TechnicalEventPort =
    options.events ??
    new AuditingEventBridge(new NoopEventEmitter(), policy, factory, buffer, (id) =>
      queueRef.current!.get(id),
    );

  const params = resolveOfflineParameters({ instanceId: `web:${deviceId}` });
  const queue = new LocalQueueRepository(offlineStore, events, clock, params);
  queueRef.current = queue;
  const retry = new RetryPolicy(config, () => 0.5);
  const conflicts = new ConflictResolverRegistry();
  const transport = options.transport ?? new FakeSessionSyncTransport();
  const processor = new QueueProcessor(queue, transport, retry, conflicts, events, clock, params);
  const scheduler = new QueueScheduler(queue, config, events, clock);

  const deviceOnline =
    options.deviceOnline ??
    ((): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const backendUp = (): Promise<boolean> =>
    Promise.resolve(transport instanceof FakeSessionSyncTransport ? transport.available : true);
  const connectivity = new CompositeConnectivity({
    device: () => Promise.resolve(deviceOnline()),
    backend: backendUp,
    auth: () => Promise.resolve(true),
    service: backendUp,
  });

  const coordinator = new SyncCoordinator(connectivity, queue, scheduler, processor, events, clock);

  const sessions = new LocalOperatorSessionRepository(appStore);

  let currentAuth: EffectiveAuthorization | null = null;
  const authorization = (): EffectiveAuthorization => {
    if (currentAuth === null) throw new Error('sessão operacional não identificada');
    return currentAuth;
  };

  const queueAdapter = new SessionQueueAdapter(queue, authorization, deviceId, clock);
  const auditAdapter = new SessionAuditAdapter(factory, buffer);
  const policyAdapter = new ConfigSessionPolicyAdapter(config);
  const ids = { uuid: (): string => crypto.randomUUID() };

  const openSession = new OpenOperatorSessionUseCase(
    { now: clock },
    ids,
    policyAdapter,
    sessions,
    queueAdapter,
    auditAdapter,
  );

  const closeSession = new CloseOperatorSessionUseCase(
    { now: clock },
    ids,
    policyAdapter,
    sessions,
    queueAdapter,
    auditAdapter,
  );

  // Quadro de tarefas do dia (7.2) — mesma infraestrutura congelada.
  // Fonte de definições = cadastro base (fixtures/backend) + definições
  // criadas localmente pelo encarregado (Área do Encarregado).
  const tasks = new LocalDailyTaskRepository(appStore);
  const templates = new LocalTaskTemplateRepository(appStore);
  const templateSource = new CompositeTaskTemplateSource(
    options.templates ?? new FixtureTaskTemplateSource(),
    templates,
  );
  const taskQueueAdapter = new TaskExecutionQueueAdapter(queue, authorization, deviceId, clock);
  const schedule: ShiftSchedulePort = options.schedule ?? new FixtureShiftSchedule();
  const loadDailyTasks = new LoadDailyTasksUseCase({ now: clock }, templateSource, tasks, schedule);
  const recordTaskOutcome = new RecordTaskOutcomeUseCase(
    { now: clock },
    ids,
    tasks,
    taskQueueAdapter,
  );

  // Gestão de Equipe — cadastro real local (colaboradores/posições/equipes);
  // o diretório de equipe passa a COMPOR base (fixtures até o backend real)
  // com o cadastro criado nesta loja.
  const workforce = new LocalWorkforceRepository(appStore);
  const scheduleData = new LocalScheduleRepository(appStore);
  const localDirectory = new LocalTeamDirectory(workforce, () =>
    operationalDateFor(clock(), FIXTURE_STORE.timeZone),
  );
  const workforceQueueAdapter = new WorkforceQueueAdapter(queue, authorization, deviceId, clock);
  const workforceAuditAdapter = new WorkforceAuditAdapter(factory, buffer);
  const registerEmployee = new RegisterEmployeeUseCase(
    { now: clock },
    ids,
    workforce,
    scheduleData,
    workforceQueueAdapter,
    workforceAuditAdapter,
  );
  const createPosition = new CreateOperationalPositionUseCase(
    { now: clock },
    ids,
    workforce,
    workforceQueueAdapter,
    workforceAuditAdapter,
  );

  // Escala Operacional — jornadas/padrões como dados da loja + fonte oficial
  // de presença planejada (o ÚNICO resolver de escala vive no domínio).
  const scheduleQueueAdapter = new ScheduleQueueAdapter(queue, authorization, deviceId, clock);
  const createShiftDefinition = new CreateShiftDefinitionUseCase(
    { now: clock },
    ids,
    scheduleData,
    scheduleQueueAdapter,
    workforceAuditAdapter,
  );
  const changeWorkPeriod = new ChangeEmployeeWorkPeriodUseCase(
    { now: clock },
    ids,
    workforce,
    scheduleData,
    scheduleQueueAdapter,
    workforceAuditAdapter,
  );
  const loadPlannedSchedule = new LoadPlannedScheduleUseCase(
    { now: clock },
    workforce,
    scheduleData,
  );

  // Área do Encarregado — criação de definição de tarefa + atribuição situacional
  const team: TeamDirectoryPort = new CompositeTeamDirectory(
    options.team ?? new FixtureTeamDirectory(),
    localDirectory,
  );
  const templateQueueAdapter = new TemplateQueueAdapter(queue, authorization, deviceId, clock);
  const templateAuditAdapter = new TemplateAuditAdapter(factory, buffer);
  const createTaskTemplate = new CreateTaskTemplateUseCase(
    { now: clock },
    ids,
    team,
    templates,
    templateQueueAdapter,
    templateAuditAdapter,
  );
  const assignQueueAdapter = new DailyTaskAssignQueueAdapter(queue, authorization, deviceId, clock);
  const assignAuditAdapter = new DailyTaskAuditAdapter(factory, buffer);
  const assignDailyTask = new AssignDailyTaskUseCase(
    { now: clock },
    ids,
    team,
    tasks,
    assignQueueAdapter,
    assignAuditAdapter,
  );

  const queueItemForSession = async (sessionId: string): Promise<QueueItem | undefined> => {
    const all = await queue.all();
    return all.find(
      (item) => item.entityType === ENTITY_OPERATOR_SESSION && item.entityId === sessionId,
    );
  };

  /** Traduz o desfecho da fila para a linguagem de estado local. */
  const syncStatusFor = (finalState: string): SessionSyncStatus | null => {
    if (finalState === 'SYNCED') return 'synced';
    if (finalState === 'CONFLICT') return 'conflict';
    if (finalState === 'PERMANENT_FAILURE' || finalState === 'NEEDS_REVIEW') return 'failed';
    return null;
  };

  const drainAndReflect = async (): Promise<void> => {
    const report = await coordinator.drain();
    for (const result of report.processed) {
      const item = await queue.get(result.itemId);
      if (item === undefined) continue;
      const status = syncStatusFor(result.finalState);
      if (status === null) continue;

      if (item.entityType === ENTITY_OPERATOR_SESSION) {
        // 'update' = fechamento; 'insert' = abertura (estados distintos)
        if (item.operation === 'update') {
          const current = await sessions.byId(item.entityId);
          if (current !== null) {
            await sessions.save({
              ...current,
              closeSyncStatus: status,
              // confirmado pelo servidor: o turno passa a CLOSED_CONFIRMED
              status: status === 'synced' ? 'CLOSED_CONFIRMED' : current.status,
            });
          }
        } else {
          await sessions.updateSyncStatus(item.entityId, status);
        }
        continue;
      }

      if (item.entityType === ENTITY_TASK_EXECUTION) {
        await tasks.updateExecutionSyncStatus(item.entityId, status);
        const payload = item.payload as TaskExecutionQueuePayload;
        const task = await tasks.byId(payload.execution.dailyTaskId);
        // conflito NUNCA apaga o desfecho local — só marca para revisão
        if (task !== null) await tasks.save({ ...task, syncStatus: status });
        continue;
      }

      if (item.entityType === ENTITY_TASK_TEMPLATE) {
        await templates.updateSyncStatus(item.entityId, status);
        continue;
      }

      // Gestão de Equipe: reflete o desfecho no registro local
      if (item.entityType === ENTITY_EMPLOYEE) {
        await workforce.updateEmployeeSyncStatus(item.entityId, status);
        continue;
      }
      if (item.entityType === ENTITY_OPERATIONAL_POSITION) {
        await workforce.updatePositionSyncStatus(item.entityId, status);
        continue;
      }
      if (item.entityType === ENTITY_SHIFT_DEFINITION) {
        await scheduleData.updateDefinitionSyncStatus(item.entityId, status);
        continue;
      }
      // troca de vínculo: o estado local já foi aplicado na operação
      if (item.entityType === ENTITY_EMPLOYEE_ASSIGNMENT) continue;

      // atribuição situacional: reflete o desfecho na ocorrência
      if (item.entityType === ENTITY_DAILY_TASK) {
        const current = await tasks.byId(item.entityId);
        if (current !== null) await tasks.save({ ...current, syncStatus: status });
      }
    }
  };

  const reconcileFromQueue = async (): Promise<void> => {
    // catálogo inicial da loja (equipes/posições/jornadas/padrão) ANTES de
    // qualquer leitura
    await ensureWorkforceBaseline(workforce, scheduleData, FIXTURE_STORE.id);
    const items = await queue.all();
    for (const item of items) {
      // 1) abertura enfileirada sem registro local (falha entre enqueue e save)
      if (item.entityType === ENTITY_OPERATOR_SESSION && item.operation === 'insert') {
        const payload = item.payload as { record?: OperatorSessionRecord };
        const record = payload.record;
        if (record === undefined) continue;
        const existing = await sessions.byId(record.id);
        if (existing === null) await sessions.save(record);
        continue;
      }

      // 2) fechamento enfileirado que não chegou a marcar a sessão local
      if (item.entityType === ENTITY_OPERATOR_SESSION && item.operation === 'update') {
        const payload = item.payload as CloseSessionQueuePayload;
        const existing = await sessions.byId(payload.sessionId);
        if (existing !== null && existing.status === 'ACTIVE') {
          await sessions.save({
            ...existing,
            status: 'CLOSED_LOCAL',
            clientClosedAt: payload.clientClosedAt,
            closedOffline: payload.closedOffline,
            endReason: payload.endReason,
            closeIdempotencyKey: item.idempotencyKey,
            closeSyncStatus: 'queued',
          });
        }
        continue;
      }

      // 3) definição enfileirada sem registro local (falha entre enqueue e save)
      if (item.entityType === ENTITY_TASK_TEMPLATE) {
        const payload = item.payload as CreateTemplateQueuePayload;
        const template = payload.template;
        const known = await templates.byIdempotencyKey(template.storeId, template.idempotencyKey);
        if (known === null) await templates.save(template);
        continue;
      }

      // 3c) cadastro de colaborador enfileirado sem registro local
      if (item.entityType === ENTITY_EMPLOYEE) {
        const payload = item.payload as RegisterEmployeeQueuePayload;
        const known = await workforce.employeeByIdempotencyKey(
          payload.employee.storeId,
          payload.employee.idempotencyKey,
        );
        if (known === null) {
          await workforce.saveRegistration(payload.employee, payload.assignment);
        }
        continue;
      }

      // 3d) posição enfileirada sem registro local
      if (item.entityType === ENTITY_OPERATIONAL_POSITION) {
        const payload = item.payload as CreatePositionQueuePayload;
        const known = await workforce.positionByKey(payload.position.storeId, payload.position.key);
        if (known === null) await workforce.savePosition(payload.position);
        continue;
      }

      // 3e) jornada enfileirada sem registro local
      if (item.entityType === ENTITY_SHIFT_DEFINITION) {
        const payload = item.payload as CreateShiftDefinitionQueuePayload;
        const known = await scheduleData.definitionByWindow(
          payload.definition.storeId,
          payload.definition.startTime,
          payload.definition.endTime,
        );
        if (known === null) await scheduleData.saveDefinition(payload.definition);
        continue;
      }

      // 3f) troca de jornada enfileirada sem persistir os vínculos locais
      if (item.entityType === ENTITY_EMPLOYEE_ASSIGNMENT) {
        const payload = item.payload as ChangeWorkPeriodQueuePayload;
        const assignments = await workforce.assignments(payload.openedAssignment.storeId);
        if (!assignments.some((known) => known.id === payload.openedAssignment.id)) {
          await workforce.saveAssignment(payload.closedAssignment);
          await workforce.saveAssignment(payload.openedAssignment);
        }
        continue;
      }

      // 3b) atribuição enfileirada sem persistir na ocorrência local
      if (item.entityType === ENTITY_DAILY_TASK && item.operation === 'update') {
        const payload = item.payload as AssignDailyTaskQueuePayload;
        const assigned = payload.dailyTask;
        const existing = await tasks.byId(assigned.id);
        if (existing !== null && existing.assignedPositionId !== assigned.assignedPositionId) {
          await tasks.save({
            ...existing,
            assignedPositionId: assigned.assignedPositionId,
            syncStatus: assigned.syncStatus,
          });
        }
        continue;
      }

      // 4) execução enfileirada sem registro local (append-only reconstruído)
      if (item.entityType === ENTITY_TASK_EXECUTION) {
        const payload = item.payload as TaskExecutionQueuePayload;
        const execution = payload.execution;
        const known = await tasks.executionByIdempotencyKey(
          execution.storeId,
          execution.idempotencyKey,
        );
        if (known === null) await tasks.saveExecution(execution);
        const task = await tasks.byId(execution.dailyTaskId);
        if (task !== null && task.lastExecutionId === null) {
          await tasks.save({
            ...task,
            status: execution.resultingStatus,
            lastExecutionId: execution.id,
            syncStatus: execution.syncStatus,
          });
        }
      }
    }
  };

  return {
    clock,
    deviceId,
    config,
    sessions,
    queue,
    transport,
    connectivity,
    tasks,
    templates,
    team,
    workforce,
    scheduleData,
    setAuthorization: (auth) => {
      currentAuth = auth;
    },
    openSession,
    closeSession,
    loadDailyTasks,
    recordTaskOutcome,
    createTaskTemplate,
    assignDailyTask,
    registerEmployee,
    createPosition,
    createShiftDefinition,
    changeWorkPeriod,
    loadPlannedSchedule,
    drainAndReflect,
    reconcileFromQueue,
    queueItemForSession,
    close: async () => {
      await offlineStore.close();
      await appStore.close();
    },
  };
}
