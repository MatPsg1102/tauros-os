// View model da Área do Encarregado — única fonte de cada estado; a UI não
// toca fila/IndexedDB/permissões, não monta chave de idempotência e não
// acessa repositório: tudo passa pelos use cases. Estados discriminados
// (fase do painel + fase da criação), nunca combinações frágeis de booleanos.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { operationalDateFor, storeDayStartFor } from '@tauros/application';
import type {
  DailyTaskRecord,
  EffectiveAuthorization,
  OperationalPositionView,
  OperatorSessionRecord,
  TaskSyncStatus,
  TeamMemberView,
} from '@tauros/contracts';
import {
  CAPABILITY_CONFIG_WRITE,
  CAPABILITY_SESSION_CLOSE,
  CAPABILITY_SESSION_OPEN,
  PERMISSION_MODEL_VERSION,
} from '@tauros/contracts';

import type { AppContainer } from '../wiring/container.js';
import {
  FIXTURE_OPERATORS,
  FIXTURE_STORE,
  identifyOperator,
  type FixtureOperator,
} from '../wiring/fixtures.js';
import { useOperatorSession } from './operator-session-context.js';
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

export type SupervisorTaskState = 'pending' | 'overdue' | 'done' | 'skipped';

export type SupervisorFilter = 'all' | SupervisorTaskState;

export interface SupervisorTaskView {
  readonly id: string;
  readonly title: string;
  readonly state: SupervisorTaskState;
  /** Horário limite HH:MM no fuso da LOJA. */
  readonly dueTime: string;
  readonly positionId: string | null;
  readonly positionName: string;
  /** Funcionários que ocupam a posição responsável hoje. */
  readonly assigneeNames: readonly string[];
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
}

export interface PositionOption {
  readonly id: string;
  readonly name: string;
  readonly memberNames: readonly string[];
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
  readonly deviceOnline: boolean;
  readonly readyToSync: boolean;
  readonly pendingSyncCount: number;
  readonly identifyError: string | null;
}

export interface CreateTaskFormInput {
  readonly title: string;
  readonly positionId: string;
  /** Horário limite HH:MM (fuso da loja). */
  readonly dueTime: string;
  readonly requiresPhoto: boolean;
}

export interface SupervisorDashboardActions {
  readonly identify: (pin: string) => Promise<void>;
  readonly openCreate: () => void;
  readonly closeCreate: () => void;
  readonly createTask: (input: CreateTaskFormInput) => Promise<void>;
  readonly setFilter: (filter: SupervisorFilter) => void;
  readonly setPositionFilter: (positionId: string | null) => void;
  readonly openShift: () => Promise<void>;
  readonly requestCloseShift: () => void;
  readonly cancelCloseShift: () => void;
  readonly confirmCloseShift: () => Promise<void>;
  readonly retrySync: () => Promise<void>;
  readonly reload: () => Promise<void>;
}

/** Encarregados de desenvolvimento = fixtures com a capability oficial. */
function supervisorFixture(): FixtureOperator | null {
  return (
    FIXTURE_OPERATORS.find((operator) => operator.permissions.includes(CAPABILITY_CONFIG_WRITE)) ??
    null
  );
}

function greetingFor(now: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', hour: '2-digit' }).format(now),
  );
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function dueTimeFor(dueAtIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dueAtIso));
}

function toAuthorization(
  operator: FixtureOperator,
  now: Date,
  validityMs: number,
  online: boolean,
): EffectiveAuthorization {
  return {
    operatorProfileId: operator.profileId,
    operatorEmployeeId: operator.employeeId,
    storeId: FIXTURE_STORE.id,
    sessionId: `platform:${operator.profileId}`,
    permissions: operator.permissions,
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: undefined,
    validUntil: new Date(now.getTime() + validityMs),
    origin: online ? 'online' : 'offline-snapshot',
  };
}

function stateOf(record: DailyTaskRecord): SupervisorTaskState {
  if (record.status === 'DONE') return 'done';
  if (record.status === 'SKIPPED') return 'skipped';
  if (record.status === 'OVERDUE') return 'overdue';
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
  const [filter, setFilter] = useState<SupervisorFilter>('all');
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
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
    const [members, positionViews, localTemplates] = await Promise.all([
      container.team.members(FIXTURE_STORE.id),
      container.team.positions(FIXTURE_STORE.id),
      container.templates.byStore(FIXTURE_STORE.id),
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
        const positionId = record.template.targetPositionId;
        const localTemplate = localTemplateById.get(record.templateId);
        return {
          id: record.id,
          title: record.template.title,
          state: stateOf(record),
          dueTime: dueTimeFor(record.dueAt, FIXTURE_STORE.timeZone),
          positionId,
          positionName:
            positionId === null ? 'Equipe' : (positionById.get(positionId)?.name ?? 'Equipe'),
          assigneeNames:
            positionId === null
              ? []
              : (membersByPosition.get(positionId) ?? []).map((member) => member.fullName),
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
      if (cancelled) return;
      if (identity.operator === null) {
        setPhase('identify');
        return;
      }
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [container, identity.operator, load]);

  const identify = useCallback(
    async (pin: string) => {
      setIdentifyError(null);
      const supervisor = supervisorFixture();
      if (supervisor === null) {
        setPhase('denied');
        return;
      }
      const identified = identifyOperator(supervisor.employeeId, pin);
      if (identified === null) {
        // mensagem NÃO revela detalhes internos nem se o PIN existe
        setIdentifyError('Não foi possível confirmar a identificação. Confira e tente novamente.');
        return;
      }
      const readiness = await container.connectivity.assess();
      const validityMs = await container.config.resolve(
        'auth.pin.offlineValidityMs',
        FIXTURE_STORE.id,
      );
      const auth = toAuthorization(
        identified.operator,
        container.clock(),
        validityMs,
        readiness.readyToSync,
      );
      container.setAuthorization(auth);
      identity.identify(
        {
          employeeId: identified.operator.employeeId,
          profileId: identified.operator.profileId,
          membershipId: identified.operator.membershipId,
          name: identified.operator.name,
          permissions: identified.operator.permissions,
        },
        auth,
      );
      setPhase('loading');
    },
    [container, identity],
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
        const [hours = 0, minutes = 0] = input.dueTime.split(':').map(Number);
        const result = await container.createTaskTemplate.execute({
          authorization,
          deviceId: container.deviceId,
          storeTimeZone: FIXTURE_STORE.timeZone,
          title: input.title,
          targetPositionId: input.positionId,
          requiresPhoto: input.requiresPhoto,
          expectedMin: null,
          expectedMax: null,
          dueOffsetMinutes: hours * 60 + minutes,
          frequency: 'ONCE',
          createdOffline: !readiness.readyToSync,
        });
        if (result.kind === 'failed') {
          switch (result.code) {
            case 'TITLE_REQUIRED':
              setCreation({ status: 'error', message: 'Dê um título para a tarefa.' });
              return;
            case 'ASSIGNMENT_REQUIRED':
            case 'UNKNOWN_POSITION':
              setCreation({ status: 'error', message: 'Escolha o responsável pela tarefa.' });
              return;
            case 'INVALID_DUE_TIME':
              setCreation({
                status: 'error',
                message: 'Informe um horário limite dentro do dia de hoje.',
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

  const visibleTasks = tasks.filter((task) => {
    if (filter !== 'all' && task.state !== filter) return false;
    if (positionFilter !== null && task.positionId !== positionFilter) return false;
    return true;
  });

  const view: SupervisorDashboardView = {
    phase,
    creation,
    supervisorName: identity.operator?.name ?? supervisorFixture()?.name ?? null,
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
    },
    filter,
    positionFilter,
    positions,
    deviceOnline: connectivity.deviceOnline,
    readyToSync: connectivity.readyToSync,
    pendingSyncCount,
    identifyError,
  };

  return [
    view,
    {
      identify,
      openCreate,
      closeCreate,
      createTask,
      setFilter,
      setPositionFilter,
      openShift,
      requestCloseShift: closingActions.requestClose,
      cancelCloseShift: closingActions.cancelClose,
      confirmCloseShift: closingActions.confirmClose,
      retrySync,
      reload: load,
    },
  ];
}
