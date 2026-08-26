// View model da Área do Encarregado — única fonte de cada estado; a UI não
// toca fila/IndexedDB/permissões, não monta chave de idempotência e não
// acessa repositório: tudo passa pelos use cases. Estados discriminados
// (fase do painel + fase da criação), nunca combinações frágeis de booleanos.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { operationalDateFor, storeDayStartFor } from '@tauros/application';
import type {
  DailyTaskRecord,
  OperationalPositionView,
  OperatorSessionRecord,
  TaskRecurrence,
  TaskSyncStatus,
  TeamMemberView,
} from '@tauros/contracts';
import {
  CAPABILITY_CONFIG_WRITE,
  CAPABILITY_SESSION_CLOSE,
  CAPABILITY_SESSION_OPEN,
} from '@tauros/contracts';

import type { AppContainer } from '../wiring/container.js';
import { timeOfDay } from './time-of-day.js';
import { FIXTURE_STORE } from '../wiring/fixtures.js';
import { useOperatorSession, type IdentifiedOperatorView } from './operator-session-context.js';
import { identityRejectionMessage } from './identity-messages.js';
import { useShiftClosing, type ShiftClosingView } from './use-shift-closing.js';

export type SupervisorPhase =
  | 'bootstrapping'
  | 'identify'
  | 'denied'
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'expired'
  | 'error';

export type SupervisorCreation =
  | { readonly status: 'idle' }
  | { readonly status: 'open' }
  | { readonly status: 'submitting' }
  | { readonly status: 'error'; readonly message: string };

export type SupervisorTaskState =
  | 'pending'
  | 'in-progress'
  | 'awaiting-review'
  | 'needs-correction'
  | 'overdue'
  | 'done'
  | 'skipped';

/** 'unassigned' = ocorrências sem responsável (fila do encarregado). */
export type SupervisorFilter = 'all' | 'unassigned' | SupervisorTaskState;

export interface SupervisorTaskView {
  readonly id: string;
  readonly title: string;
  readonly state: SupervisorTaskState;
  /** Início planejado HH:MM no fuso da LOJA (null se a definição não tem). */
  readonly startTime: string | null;
  /** Horário limite HH:MM no fuso da LOJA. */
  readonly dueTime: string;
  /** Posição responsável EFETIVA (atribuição situacional ou padrão da definição). */
  readonly positionId: string | null;
  readonly positionName: string;
  /** Funcionários que ocupam a posição responsável hoje. */
  readonly assigneeNames: readonly string[];
  /** Sem responsável efetivo — precisa de distribuição pelo encarregado. */
  readonly isUnassigned: boolean;
  readonly requiresPhoto: boolean;
  readonly syncStatus: TaskSyncStatus | null;
  /** Definição criada neste aparelho (Área do Encarregado). */
  readonly createdLocally: boolean;
}

export interface SupervisorCounts {
  readonly pending: number;
  readonly overdue: number;
  readonly done: number;
  readonly skipped: number;
  readonly unassigned: number;
  /** Fila do ENCARREGADO: entregues aguardando a conferência dele. */
  readonly awaitingReview: number;
  /** Devolvidas aguardando correção do executor — cobrança visível. */
  readonly needsCorrection: number;
  readonly inProgress: number;
}

export interface PositionOption {
  readonly id: string;
  readonly name: string;
  readonly memberNames: readonly string[];
}

/**
 * Candidatos da ATRIBUIÇÃO situacional: somente posições com ocupante
 * ESCALADO hoje (fonte oficial de presença planejada) — nunca o cadastro
 * inteiro. Atribuir é distribuir o dia real, não a estrutura da loja.
 */
export interface AssignablePositionOption {
  readonly id: string;
  readonly name: string;
  /** Ocupantes escalados hoje nesta posição. */
  readonly scheduledNames: readonly string[];
}

/**
 * Decisões de permissão PRONTAS para a UI (ADR-018): derivadas uma única vez
 * das permissões efetivas do operador identificado — a tela nunca recalcula
 * capability nem conhece strings de permissão.
 */
export interface SupervisorPermissions {
  readonly canOpenShift: boolean;
  readonly canCloseShift: boolean;
  readonly canCreateTask: boolean;
  readonly canViewTeamTasks: boolean;
}

export interface SupervisorDashboardView {
  readonly phase: SupervisorPhase;
  readonly creation: SupervisorCreation;
  readonly supervisorName: string | null;
  /** Colaboradores selecionáveis na identificação (nome + employeeId; sem PIN). */
  readonly operators: readonly { readonly employeeId: string; readonly name: string }[];
  /** Comprimento do PIN vindo do Configuration Engine (nunca hardcoded). */
  readonly pinLength: number;
  readonly greeting: string;
  readonly operationalDate: string | null;
  readonly permissions: SupervisorPermissions;
  /** Turno do PRÓPRIO encarregado (encarregado também é operador). */
  readonly session: OperatorSessionRecord | null;
  readonly shiftSubmitting: boolean;
  readonly shiftError: string | null;
  readonly closing: ShiftClosingView;
  readonly tasks: readonly SupervisorTaskView[];
  readonly counts: SupervisorCounts;
  readonly filter: SupervisorFilter;
  readonly positionFilter: string | null;
  readonly positions: readonly PositionOption[];
  /** Posições com ocupante escalado HOJE (candidatas de atribuição). */
  readonly assignablePositions: readonly AssignablePositionOption[];
  readonly deviceOnline: boolean;
  readonly readyToSync: boolean;
  readonly pendingSyncCount: number;
  readonly identifyError: string | null;
  /** Falha da última atribuição — nunca silenciosa (linguagem operacional). */
  readonly assignError: string | null;
}

export interface CreateTaskFormInput {
  readonly title: string;
  /** '' quando "definir no dia" (sem responsável); id da posição se "agora". */
  readonly positionId: string;
  /** Data inicial de vigência YYYY-MM-DD (fuso da loja). */
  readonly effectiveFrom: string;
  /** Início planejado HH:MM (fuso da loja). */
  readonly startTime: string;
  /** Fim máximo planejado HH:MM (fuso da loja). */
  readonly endTime: string;
  readonly requiresPhoto: boolean;
  /** Exigir conferência do encarregado após a execução. */
  readonly requiresReview: boolean;
  readonly recurrence: TaskRecurrence;
}

export interface SupervisorDashboardActions {
  readonly identify: (employeeId: string, pin: string) => Promise<void>;
  readonly openCreate: () => void;
  readonly closeCreate: () => void;
  readonly createTask: (input: CreateTaskFormInput) => Promise<void>;
  readonly assignTask: (dailyTaskId: string, positionId: string) => Promise<void>;
  readonly setFilter: (filter: SupervisorFilter) => void;
  readonly setPositionFilter: (positionId: string | null) => void;
  readonly openShift: () => Promise<void>;
  readonly requestCloseShift: () => void;
  readonly cancelCloseShift: () => void;
  readonly confirmCloseShift: () => Promise<void>;
  readonly retrySync: () => Promise<void>;
  readonly reload: () => Promise<void>;
  /** Saída do estado expirado: limpa a identificação e volta ao PIN. */
  readonly reidentify: () => void;
}

function greetingFor(now: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', hour: '2-digit' }).format(now),
  );
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// (timeOfDay compartilhado, tolerante a valor ausente/inválido —
// ver controllers/time-of-day.ts)

/** "HH:MM" → minutos do dia. Entrada inválida vira 0 (o domínio rejeita). */
function hhmmToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function stateOf(record: DailyTaskRecord): SupervisorTaskState {
  if (record.status === 'DONE') return 'done';
  if (record.status === 'SKIPPED') return 'skipped';
  if (record.status === 'OVERDUE') return 'overdue';
  if (record.status === 'IN_PROGRESS') return 'in-progress';
  if (record.status === 'AWAITING_REVIEW') return 'awaiting-review';
  if (record.status === 'NEEDS_CORRECTION') return 'needs-correction';
  return 'pending';
}

export function useSupervisorDashboard(
  container: AppContainer,
): [SupervisorDashboardView, SupervisorDashboardActions] {
  const identity = useOperatorSession();
  const [phase, setPhase] = useState<SupervisorPhase>('bootstrapping');
  const [creation, setCreation] = useState<SupervisorCreation>({ status: 'idle' });
  const [tasks, setTasks] = useState<readonly SupervisorTaskView[]>([]);
  const [positions, setPositions] = useState<readonly PositionOption[]>([]);
  const [assignablePositions, setAssignablePositions] = useState<
    readonly AssignablePositionOption[]
  >([]);
  const [filter, setFilter] = useState<SupervisorFilter>('all');
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [operators, setOperators] = useState<
    readonly { readonly employeeId: string; readonly name: string }[]
  >([]);
  const [pinLength, setPinLength] = useState(6);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [connectivity, setConnectivity] = useState({ deviceOnline: true, readyToSync: false });
  const [session, setSession] = useState<OperatorSessionRecord | null>(null);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const openingRef = useRef(false);
  const sessionRef = useRef<OperatorSessionRecord | null>(null);

  const authorization = identity.authorization;
  const hasCapability = identity.operator?.permissions.includes(CAPABILITY_CONFIG_WRITE) ?? false;
  const operatorEmployeeId = identity.operator?.employeeId ?? null;

  // Decisões prontas (ADR-018): a UI recebe booleanos, nunca strings de
  // capability. Encarregado também é operador: abre/fecha o PRÓPRIO turno.
  const permissions: SupervisorPermissions = {
    canOpenShift: identity.operator?.permissions.includes(CAPABILITY_SESSION_OPEN) ?? false,
    canCloseShift: identity.operator?.permissions.includes(CAPABILITY_SESSION_CLOSE) ?? false,
    canCreateTask: hasCapability,
    canViewTeamTasks: hasCapability,
  };

  const updateSession = useCallback((record: OperatorSessionRecord | null) => {
    sessionRef.current = record;
    setSession(record);
  }, []);

  // Fechamento: MESMO application layer da rota /turno (nenhum use case novo).
  const [closing, closingActions] = useShiftClosing(container, session, updateSession);

  const load = useCallback(async () => {
    if (authorization === null) {
      setPhase('identify');
      return;
    }
    if (!hasCapability) {
      setPhase('denied');
      return;
    }
    const readiness = await container.connectivity.assess();
    setConnectivity({ deviceOnline: readiness.deviceOnline, readyToSync: readiness.readyToSync });

    // Turno do próprio encarregado: ativa restaura; fechada segue refletindo
    // o estado de sincronização (local × servidor) até sair da tela.
    if (operatorEmployeeId !== null) {
      const active = await container.sessions.findActive(FIXTURE_STORE.id, operatorEmployeeId);
      if (active !== null) {
        updateSession(active);
      } else if (sessionRef.current !== null) {
        updateSession(await container.sessions.byId(sessionRef.current.id));
      }
    }

    const now = container.clock();
    const [members, positionViews, localTemplates, plannedToday] = await Promise.all([
      container.team.members(FIXTURE_STORE.id),
      container.team.positions(FIXTURE_STORE.id),
      container.templates.byStore(FIXTURE_STORE.id),
      // candidatos de atribuição: presença PLANEJADA de hoje (fonte oficial)
      container.loadPlannedSchedule.execute({
        authorization,
        storeAnchorDate: FIXTURE_STORE.shiftAnchorDate,
        operationalDates: [operationalDateFor(now, FIXTURE_STORE.timeZone)],
      }),
    ]);
    const result = await container.loadDailyTasks.execute({
      authorization,
      workDate: operationalDateFor(now, FIXTURE_STORE.timeZone),
      operationalDayStart: storeDayStartFor(now, FIXTURE_STORE.timeZone),
      configVersionRef: null,
    });
    if (result.kind === 'failed') {
      if (result.code === 'SNAPSHOT_EXPIRED' || result.code === 'SNAPSHOT_VERSION_INCOMPATIBLE') {
        setPhase('expired');
        return;
      }
      setPhase(result.code === 'CONFIG_UNAVAILABLE' ? 'unavailable' : 'error');
      return;
    }

    const positionById = new Map<string, OperationalPositionView>(
      positionViews.map((position) => [position.id, position]),
    );
    const membersByPosition = new Map<string, TeamMemberView[]>();
    for (const member of members) {
      if (member.positionId === null) continue;
      const list = membersByPosition.get(member.positionId) ?? [];
      list.push(member);
      membersByPosition.set(member.positionId, list);
    }
    const localTemplateById = new Map(localTemplates.map((template) => [template.id, template]));

    setTasks(
      result.tasks.map((record) => {
        // responsável EFETIVO: atribuição situacional da ocorrência tem
        // precedência sobre a posição padrão da definição.
        const positionId = record.assignedPositionId ?? record.template.targetPositionId;
        const localTemplate = localTemplateById.get(record.templateId);
        return {
          id: record.id,
          title: record.template.title,
          state: stateOf(record),
          startTime: timeOfDay(record.plannedStartAt, FIXTURE_STORE.timeZone),
          dueTime: timeOfDay(record.dueAt, FIXTURE_STORE.timeZone) ?? '—',
          positionId,
          positionName:
            positionId === null
              ? 'Sem responsável'
              : (positionById.get(positionId)?.name ?? 'Equipe'),
          assigneeNames:
            positionId === null
              ? []
              : (membersByPosition.get(positionId) ?? []).map((member) => member.fullName),
          isUnassigned: positionId === null,
          requiresPhoto: record.template.requiresPhoto,
          // definição recém-criada: o estado que importa é o da CRIAÇÃO
          syncStatus: localTemplate?.syncStatus ?? record.syncStatus,
          createdLocally: localTemplate !== undefined,
        };
      }),
    );
    setPositions(
      positionViews.map((position) => ({
        id: position.id,
        name: position.name,
        memberNames: (membersByPosition.get(position.id) ?? []).map((member) => member.fullName),
      })),
    );
    // agrupa os ESCALADOS de hoje por posição — só elas recebem atribuição
    const scheduledByPosition = new Map<string, string[]>();
    if (plannedToday.kind === 'loaded') {
      for (const employee of plannedToday.days[0]?.employees ?? []) {
        if (employee.positionId === null) continue;
        const names = scheduledByPosition.get(employee.positionId) ?? [];
        names.push(employee.fullName);
        scheduledByPosition.set(employee.positionId, names);
      }
    }
    setAssignablePositions(
      [...scheduledByPosition.entries()].map(([positionId, names]) => ({
        id: positionId,
        name: positionById.get(positionId)?.name ?? 'Posição',
        scheduledNames: names,
      })),
    );
    setPendingSyncCount(
      localTemplates.filter((template) => template.syncStatus === 'queued').length,
    );
    setPhase('ready');
  }, [authorization, container, hasCapability, operatorEmployeeId, updateSession]);

  // Boot: reconciliação de recuperação + decide entre identificar e carregar
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await container.reconcileFromQueue();
      const [roster, policy] = await Promise.all([
        container.identityRoster(FIXTURE_STORE.id),
        container.pinPolicy.resolve(FIXTURE_STORE.id),
      ]);
      if (cancelled) return;
      setOperators(roster);
      setPinLength(policy.length);
      if (identity.operator === null) {
        setPhase('identify');
        return;
      }
      // reidrata a autorização do container: as ações JIT do quadro
      // compartilhado zeram o snapshot global ao descartar o ator — sem isso,
      // todo enqueue do encarregado falharia com ENQUEUE_FAILED (autoria).
      // Mesmo contrato de use-shift-opening.
      container.setAuthorization(identity.authorization);
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [container, identity.operator, load]);

  const identify = useCallback(
    async (employeeId: string, pin: string) => {
      setIdentifyError(null);
      // employeeId identifica, PIN verifica (ADR-021). Ninguém é "encarregado"
      // por nome/cargo: quem seleciona a si mesmo e prova o PIN é identificado;
      // o painel de gestão só abre se a AUTORIZAÇÃO trouxer config.write.
      const outcome = await container.identity.verify({
        storeId: FIXTURE_STORE.id,
        employeeId,
        pin,
        deviceId: container.deviceId,
      });
      if (outcome.kind === 'rejected') {
        setIdentifyError(identityRejectionMessage(outcome.code));
        return;
      }
      const auth = outcome.authorization;
      const name =
        operators.find((candidate) => candidate.employeeId === employeeId)?.name ?? employeeId;
      const view: IdentifiedOperatorView = {
        employeeId: auth.operatorEmployeeId,
        profileId: auth.operatorProfileId,
        membershipId: auth.membershipId ?? null,
        name,
        permissions: auth.permissions,
      };
      container.setAuthorization(auth);
      identity.identify(view, auth);
      setPhase('loading');
    },
    [container, identity, operators],
  );

  const openCreate = useCallback(() => {
    setCreation({ status: 'open' });
  }, []);
  const closeCreate = useCallback(() => {
    setCreation((current) => (current.status === 'submitting' ? current : { status: 'idle' }));
  }, []);

  const createTask = useCallback(
    async (input: CreateTaskFormInput) => {
      if (authorization === null) return;
      // guarda de submissão concorrente (duplo clique / StrictMode)
      if (submittingRef.current) return;
      submittingRef.current = true;
      setCreation({ status: 'submitting' });
      try {
        const readiness = await container.connectivity.assess();
        const result = await container.createTaskTemplate.execute({
          authorization,
          deviceId: container.deviceId,
          storeTimeZone: FIXTURE_STORE.timeZone,
          title: input.title,
          // '' ⇒ "definir no dia": null representa a ausência real de responsável
          targetPositionId: input.positionId === '' ? null : input.positionId,
          requiresPhoto: input.requiresPhoto,
          requiresReview: input.requiresReview,
          expectedMin: null,
          expectedMax: null,
          effectiveFrom: input.effectiveFrom,
          plannedStartMinutes: hhmmToMinutes(input.startTime),
          dueOffsetMinutes: hhmmToMinutes(input.endTime),
          recurrence: input.recurrence,
          createdOffline: !readiness.readyToSync,
        });
        if (result.kind === 'failed') {
          switch (result.code) {
            case 'TITLE_REQUIRED':
              setCreation({ status: 'error', message: 'Dê um título para a tarefa.' });
              return;
            case 'ASSIGNMENT_REQUIRED':
              setCreation({
                status: 'error',
                message: '"Quando estiver escalado" precisa de uma posição responsável.',
              });
              return;
            case 'UNKNOWN_POSITION':
              setCreation({ status: 'error', message: 'Escolha o responsável pela tarefa.' });
              return;
            case 'INVALID_RECURRENCE':
              setCreation({ status: 'error', message: 'Escolha ao menos um dia da semana.' });
              return;
            case 'INVALID_DATE':
              setCreation({ status: 'error', message: 'Informe uma data inicial válida.' });
              return;
            case 'INVALID_DUE_TIME':
              setCreation({
                status: 'error',
                message: 'Informe horários dentro do dia operacional.',
              });
              return;
            case 'INVALID_TIME_RANGE':
              setCreation({
                status: 'error',
                message: 'O fim máximo deve ser maior que o início planejado.',
              });
              return;
            case 'PERMISSION_DENIED':
              setPhase('denied');
              setCreation({ status: 'idle' });
              return;
            case 'SNAPSHOT_EXPIRED':
              setPhase('expired');
              setCreation({ status: 'idle' });
              return;
            default:
              setCreation({
                status: 'error',
                message: 'Não foi possível criar a tarefa agora. Tente novamente.',
              });
              return;
          }
        }
        // tarefa aparece imediatamente (persistida localmente); sync depois
        if (readiness.readyToSync) await container.drainAndReflect();
        setCreation({ status: 'idle' });
        await load();
      } finally {
        submittingRef.current = false;
      }
    },
    [authorization, container, load],
  );

  const assignTask = useCallback(
    async (dailyTaskId: string, positionId: string) => {
      if (authorization === null || positionId === '') return;
      setAssignError(null);
      const readiness = await container.connectivity.assess();
      const result = await container.assignDailyTask.execute({
        authorization,
        deviceId: container.deviceId,
        dailyTaskId,
        positionId,
        assignedOffline: !readiness.readyToSync,
      });
      if (result.kind === 'failed') {
        if (result.code === 'PERMISSION_DENIED') {
          setPhase('denied');
          return;
        }
        if (result.code === 'SNAPSHOT_EXPIRED') {
          setPhase('expired');
          return;
        }
        // nunca falhar em silêncio: o botão "não fazer nada" é o pior erro
        setAssignError(
          result.code === 'NOT_ASSIGNABLE' || result.code === 'TASK_IN_EXECUTION'
            ? 'Esta tarefa já está em andamento ou concluída e não pode ser redistribuída.'
            : result.code === 'UNKNOWN_POSITION'
              ? 'Posição não encontrada nesta loja. Recarregue e tente novamente.'
              : result.code === 'TASK_NOT_FOUND'
                ? 'Tarefa não encontrada neste aparelho. Recarregue o quadro.'
                : 'Não foi possível atribuir agora. Tente novamente.',
        );
        return;
      }
      // atribuição reflete imediatamente; sincroniza quando houver conexão
      if (readiness.readyToSync) await container.drainAndReflect();
      await load();
    },
    [authorization, container, load],
  );

  // Abertura do PRÓPRIO turno: mesmo use case da rota /turno (nenhuma regra
  // duplicada) — a aplicação revalida a capability no snapshot (ADR-018).
  const openShift = useCallback(async () => {
    const auth = identity.authorization;
    const operator = identity.operator;
    if (auth === null || operator === null) return;
    // guarda de submissão concorrente (duplo clique / StrictMode)
    if (openingRef.current) return;
    openingRef.current = true;
    setShiftError(null);
    setShiftSubmitting(true);
    try {
      const readiness = await container.connectivity.assess();
      const result = await container.openSession.execute({
        authorization: auth,
        membershipId: operator.membershipId,
        deviceId: container.deviceId,
        storeTimeZone: FIXTURE_STORE.timeZone,
        openedOffline: !readiness.readyToSync,
      });
      if (result.kind === 'opened' || result.kind === 'already-open') {
        updateSession(result.record);
        if (readiness.readyToSync) {
          await container.drainAndReflect();
          const current = await container.sessions.byId(result.record.id);
          if (current !== null) updateSession(current);
        }
        return;
      }
      switch (result.code) {
        case 'PERMISSION_DENIED':
          setShiftError('Seu perfil não permite abrir o turno nesta loja.');
          return;
        case 'SESSION_ALREADY_ACTIVE': {
          const active = await container.sessions.findActive(FIXTURE_STORE.id, operator.employeeId);
          if (active !== null) updateSession(active);
          return;
        }
        case 'SNAPSHOT_EXPIRED':
          setPhase('expired');
          return;
        case 'CONFIG_UNAVAILABLE':
          setShiftError('Configuração indisponível no momento. Tente novamente.');
          return;
        default:
          setShiftError('Não foi possível abrir o turno agora. Tente novamente.');
          return;
      }
    } finally {
      openingRef.current = false;
      setShiftSubmitting(false);
    }
  }, [container, identity.authorization, identity.operator, updateSession]);

  const retrySync = useCallback(async () => {
    await container.drainAndReflect();
    await load();
  }, [container, load]);

  const reidentify = useCallback(() => {
    container.setAuthorization(null);
    identity.clear();
    updateSession(null);
    setPhase('identify');
  }, [container, identity, updateSession]);

  const visibleTasks = tasks.filter((task) => {
    if (filter === 'unassigned') {
      if (!task.isUnassigned) return false;
    } else if (filter !== 'all' && task.state !== filter) {
      return false;
    }
    if (positionFilter !== null && task.positionId !== positionFilter) return false;
    return true;
  });

  const view: SupervisorDashboardView = {
    phase,
    creation,
    supervisorName: identity.operator?.name ?? null,
    operators,
    pinLength,
    greeting: greetingFor(container.clock(), FIXTURE_STORE.timeZone),
    operationalDate:
      phase === 'ready' ? operationalDateFor(container.clock(), FIXTURE_STORE.timeZone) : null,
    permissions,
    session,
    shiftSubmitting,
    shiftError,
    closing,
    tasks: visibleTasks,
    counts: {
      pending: tasks.filter((task) => task.state === 'pending').length,
      overdue: tasks.filter((task) => task.state === 'overdue').length,
      done: tasks.filter((task) => task.state === 'done').length,
      skipped: tasks.filter((task) => task.state === 'skipped').length,
      unassigned: tasks.filter((task) => task.isUnassigned).length,
      awaitingReview: tasks.filter((task) => task.state === 'awaiting-review').length,
      needsCorrection: tasks.filter((task) => task.state === 'needs-correction').length,
      inProgress: tasks.filter((task) => task.state === 'in-progress').length,
    },
    filter,
    positionFilter,
    positions,
    assignablePositions,
    deviceOnline: connectivity.deviceOnline,
    readyToSync: connectivity.readyToSync,
    pendingSyncCount,
    identifyError,
    assignError,
  };

  return [
    view,
    {
      identify,
      openCreate,
      closeCreate,
      createTask,
      assignTask,
      setFilter,
      setPositionFilter,
      openShift,
      requestCloseShift: closingActions.requestClose,
      cancelCloseShift: closingActions.cancelClose,
      confirmCloseShift: closingActions.confirmClose,
      retrySync,
      reload: load,
      reidentify,
    },
  ];
}
