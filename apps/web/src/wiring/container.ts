// Composition root (7.1 §6/§14) — monta o vertical slice inteiro sobre a
// infraestrutura congelada. Browser usa IndexedDB; testes injetam Memory.
// Recuperação explícita: intenção durável (fila) sem registro local ⇒
// reconcileFromQueue reconstrói o estado no boot (atomicidade §35).

import {
  AddTaskEvidenceUseCase,
  AssignDailyTaskUseCase,
  ChangeEmployeeWorkPeriodUseCase,
  ClaimDailyTaskUseCase,
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
  ReviewTaskExecutionUseCase,
  StartDailyTaskUseCase,
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
  EvidenceBlobStorePort,
  EvidenceQueuePayload,
  OperatorSessionRecord,
  RegisterEmployeeQueuePayload,
  ReviewTaskExecutionQueuePayload,
  ShiftSchedulePort,
  TaskExecutionQueuePayload,
  TaskTemplateSourcePort,
  TeamDirectoryPort,
} from '@tauros/contracts';
import {
  ENTITY_ATTACHMENT,
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
  Pbkdf2PinHasher,
  resolveOfflineParameters,
  type ConnectivityPort,
  type LocalStorePort,
  type QueueItem,
  type SyncTransportPort,
  type TechnicalEventPort,
} from '@tauros/infrastructure';
import type {
  CredentialProvisioningPort,
  OperationalCredentialPort,
  OperatorIdentityPort,
  PinPolicyPort,
  SessionSyncStatus,
} from '@tauros/contracts';

import {
  APP_STATE_SCHEMA,
  CompositeTaskTemplateSource,
  CompositeTeamDirectory,
  ConfigSessionPolicyAdapter,
  DailyTaskAssignQueueAdapter,
  DailyTaskAuditAdapter,
  EVIDENCE_BLOB_SCHEMA,
  IndexedDbEvidenceBlobStore,
  LocalDailyTaskRepository,
  LocalEvidenceRepository,
  LocalOperatorSessionRepository,
  LocalScheduleRepository,
  LocalTaskTemplateRepository,
  LocalTeamDirectory,
  LocalWorkforceRepository,
  MemoryEvidenceBlobStore,
  PlannedScheduleAdapter,
  ScheduleQueueAdapter,
  SessionAuditAdapter,
  SessionQueueAdapter,
  SharedOperationQueueAdapter,
  TaskExecutionQueueAdapter,
  TemplateAuditAdapter,
  TemplateQueueAdapter,
  WorkforceAuditAdapter,
  WorkforceQueueAdapter,
} from './adapters.js';
import {
  FIXTURE_STORE,
  FixtureOperatorIdentity,
  FixtureTaskTemplateSource,
  FixtureTeamDirectory,
  fixtureOperatorRoster,
} from './fixtures.js';
import {
  CompositeOperatorIdentity,
  ConfigPinPolicy,
  LocalCredentialIdentity,
  LocalOperationalCredentialStore,
  LocalPinLockoutStore,
  NullCredentialProvisioning,
  UnprovisionedAuthorizationSource,
} from './identity-adapters.js';
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
  readonly evidenceBlobs?: EvidenceBlobStorePort;
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
  /** Fronteira única de identificação (ADR-021): employeeId + PIN → autorização. */
  readonly identity: OperatorIdentityPort;
  /** Credencial de PIN local (criação no cadastro; verifier nunca é o PIN). */
  readonly credentials: OperationalCredentialPort;
  /** Política de PIN materializada do Configuration Engine (Baseline §3). */
  readonly pinPolicy: PinPolicyPort;
  /** Fronteira futura de provisionamento server-side (sem backend hoje). */
  readonly credentialProvisioning: CredentialProvisioningPort;
  /** Nomes+employeeId selecionáveis na identificação (reais ∪ DEV; sem PIN). */
  readonly identityRoster: (
    storeId: string,
  ) => Promise<readonly { employeeId: string; name: string }[]>;
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
  readonly evidence: LocalEvidenceRepository;
  readonly evidenceBlobs: EvidenceBlobStorePort;
  readonly claimDailyTask: ClaimDailyTaskUseCase;
  readonly startDailyTask: StartDailyTaskUseCase;
  readonly reviewTaskExecution: ReviewTaskExecutionUseCase;
  readonly addTaskEvidence: AddTaskEvidenceUseCase;
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

  // Identidade Operacional (ADR-021). Fronteira única OperatorIdentityPort: os
  // controllers NUNCA sabem se a identidade veio de credencial local real ou
  // de fixture DEV. Credencial local (verifier + lockout) em store dedicado;
  // a autorização de um colaborador real ainda-não-provisionado é HONESTA
  // (identificado ≠ autorizado — permissions vazias, sem derivar de posição).
  const pinPolicy: PinPolicyPort = new ConfigPinPolicy(config);
  const credentials: OperationalCredentialPort = new LocalOperationalCredentialStore(
    appStore,
    new Pbkdf2PinHasher(),
    pinPolicy,
    clock,
  );
  const lockouts = new LocalPinLockoutStore(appStore, clock);
  const localIdentity = new LocalCredentialIdentity(
    credentials,
    lockouts,
    pinPolicy,
    clock,
    new UnprovisionedAuthorizationSource(),
  );
  const fixtureIdentity = new FixtureOperatorIdentity({
    now: clock,
    offlineValidityMs: () => config.resolve('auth.pin.offlineValidityMs', FIXTURE_STORE.id),
    online: async () => (await connectivity.assess()).readyToSync,
  });
  const identity: OperatorIdentityPort = new CompositeOperatorIdentity(
    credentials,
    localIdentity,
    fixtureIdentity,
  );
  const credentialProvisioning: CredentialProvisioningPort = new NullCredentialProvisioning();

  // Lista de seleção de identidade (ADR-021 §4): colaboradores reais ativos ∪
  // identidades DEV. Só NOMES + employeeId — nunca PIN/permissão. A seleção não
  // é autorização: quem pode O QUÊ continua vindo da autorização efetiva.
  const identityRoster = async (
    storeId: string,
  ): Promise<readonly { employeeId: string; name: string }[]> => {
    const employees = await workforce.employees(storeId);
    const seen = new Set<string>();
    const roster: { employeeId: string; name: string }[] = [];
    for (const employee of employees) {
      if (!employee.active || seen.has(employee.id)) continue;
      seen.add(employee.id);
      roster.push({ employeeId: employee.id, name: employee.fullName });
    }
    // identidades DEV só aparecem se ainda não houver colaborador real homônimo
    for (const dev of fixtureOperatorRoster()) {
      if (seen.has(dev.employeeId)) continue;
      seen.add(dev.employeeId);
      roster.push(dev);
    }
    return roster;
  };

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

  // Cadastro real da loja (Gestão de Equipe + Escala) — declarado ANTES do
  // quadro de tarefas: a materialização consulta a escala real.
  const workforce = new LocalWorkforceRepository(appStore);
  const scheduleData = new LocalScheduleRepository(appStore);

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
  // Recorrência V1: o veredito "posição escalada?" vem do resolver REAL da
  // Escala Operacional (fixture de escala aposentada da materialização).
  const schedule: ShiftSchedulePort =
    options.schedule ??
    new PlannedScheduleAdapter(workforce, scheduleData, () => FIXTURE_STORE.shiftAnchorDate);
  const loadDailyTasks = new LoadDailyTasksUseCase({ now: clock }, templateSource, tasks, schedule);

  // Operação Compartilhada — evidência real (metadado no app-state; binário
  // em DB próprio via structured clone) + ciclo assumir/iniciar/conferir.
  const evidence = new LocalEvidenceRepository(appStore);
  const evidenceBlobStore: EvidenceBlobStorePort =
    options.evidenceBlobs ??
    (typeof indexedDB === 'undefined'
      ? new MemoryEvidenceBlobStore()
      : new IndexedDbEvidenceBlobStore(new IndexedDbLocalStore(EVIDENCE_BLOB_SCHEMA)));
  const sharedQueueAdapter = new SharedOperationQueueAdapter(queue, authorization, deviceId, clock);
  const recordTaskOutcome = new RecordTaskOutcomeUseCase(
    { now: clock },
    ids,
    tasks,
    taskQueueAdapter,
    evidence,
  );
  const startDailyTask = new StartDailyTaskUseCase(
    { now: clock },
    ids,
    tasks,
    workforce,
    sharedQueueAdapter,
  );
  const addTaskEvidence = new AddTaskEvidenceUseCase(
    { now: clock },
    ids,
    tasks,
    evidence,
    evidenceBlobStore,
    sharedQueueAdapter,
  );

  // Gestão de Equipe — o diretório de equipe COMPÕE base (fixtures até o
  // backend real) com o cadastro criado nesta loja.
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
  // Assumir (auto-serviço) reutiliza a MESMA fila da atribuição situacional;
  // conferência revalida task.review e audita admin.action (catálogo oficial).
  const claimDailyTask = new ClaimDailyTaskUseCase(
    { now: clock },
    ids,
    tasks,
    workforce,
    schedule,
    assignQueueAdapter,
  );
  const reviewTaskExecution = new ReviewTaskExecutionUseCase(
    { now: clock },
    ids,
    tasks,
    sharedQueueAdapter,
    workforceAuditAdapter,
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

      // metadado de evidência: reflete o desfecho da fila
      if (item.entityType === ENTITY_ATTACHMENT) {
        await evidence.updateSyncStatus(item.entityId, status);
        continue;
      }

      // atribuição situacional: reflete o desfecho na ocorrência
      if (item.entityType === ENTITY_DAILY_TASK) {
        const current = await tasks.byId(item.entityId);
        if (current !== null) await tasks.save({ ...current, syncStatus: status });
      }
    }
  };

  // Recuperação SÓ para intenção ainda não aplicada no servidor: itens em
  // estado terminal (SYNCED já refletido; CONFLICT/NEEDS_REVIEW preservados
  // para revisão; PERMANENT_FAILURE encerrado) NUNCA reconstroem estado
  // local — reprocessá-los regride atribuições e falsifica syncStatus.
  const RECONCILABLE_STATES = new Set([
    'PENDING',
    'BLOCKED_BY_DEPENDENCY',
    'SYNCING',
    'RETRY_SCHEDULED',
  ]);

  const reconcileFromQueue = async (): Promise<void> => {
    // catálogo inicial da loja (equipes/posições/jornadas/padrão) ANTES de
    // qualquer leitura
    await ensureWorkforceBaseline(workforce, scheduleData, FIXTURE_STORE.id);
    const items = await queue.all();
    for (const item of items) {
      if (!RECONCILABLE_STATES.has(item.state)) continue;
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

      // 3b) update da ocorrência (atribuir/assumir/iniciar) sem persistir
      if (item.entityType === ENTITY_DAILY_TASK && item.operation === 'update') {
        const payload = item.payload as AssignDailyTaskQueuePayload;
        const intended = payload.dailyTask;
        const existing = await tasks.byId(intended.id);
        if (existing !== null) {
          const missingAssign = existing.assignedPositionId !== intended.assignedPositionId;
          // início real perdido entre enqueue e save (nunca regride desfecho)
          const missingStart =
            (intended.startedAt ?? null) !== null &&
            (existing.startedAt ?? null) === null &&
            (existing.status === 'PENDING' ||
              existing.status === 'OVERDUE' ||
              existing.status === 'NEEDS_CORRECTION');
          if (missingAssign || missingStart) {
            await tasks.save({
              ...existing,
              assignedPositionId: intended.assignedPositionId,
              ...(missingStart
                ? {
                    status: intended.status,
                    startedAt: intended.startedAt ?? null,
                    startedByEmployeeId: intended.startedByEmployeeId ?? null,
                  }
                : {}),
              syncStatus: intended.syncStatus,
            });
          }
        }
        continue;
      }

      // 3g) metadado de evidência enfileirado sem registro local
      if (item.entityType === ENTITY_ATTACHMENT) {
        const payload = item.payload as EvidenceQueuePayload;
        const known = await evidence.byIds([payload.evidence.id]);
        if (known.length === 0) await evidence.save(payload.evidence);
        continue;
      }

      // 4b) conferência enfileirada sem persistir localmente
      if (item.entityType === ENTITY_TASK_EXECUTION && item.operation === 'update') {
        const payload = item.payload as ReviewTaskExecutionQueuePayload;
        const reviewed = payload.execution;
        if (reviewed.review != null) {
          const local = await tasks.executionById(reviewed.id);
          if (local !== null && local.review == null) {
            await tasks.attachExecutionReview(reviewed.id, reviewed.review);
            const task = await tasks.byId(reviewed.dailyTaskId);
            if (task !== null && task.status === 'AWAITING_REVIEW') {
              await tasks.save({
                ...task,
                status: reviewed.review.outcome === 'APPROVED' ? 'DONE' : 'NEEDS_CORRECTION',
              });
            }
          }
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
    identity,
    credentials,
    pinPolicy,
    credentialProvisioning,
    identityRoster,
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
    evidence,
    evidenceBlobs: evidenceBlobStore,
    claimDailyTask,
    startDailyTask,
    reviewTaskExecution,
    addTaskEvidence,
    drainAndReflect,
    reconcileFromQueue,
    queueItemForSession,
    close: async () => {
      await offlineStore.close();
      await appStore.close();
    },
  };
}
