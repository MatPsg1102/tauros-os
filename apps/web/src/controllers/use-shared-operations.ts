// View model da OPERAÇÃO DE HOJE — quadro COMPARTILHADO da loja. A tela é
// do dispositivo (tablet no chão de operação): VISUALIZAR não exige
// identidade; cada AÇÃO CRÍTICA (assumir, iniciar, enviar, conferir) exige
// PIN just-in-time que resolve identidade + permissões efetivas, executa a
// ação com autoria real e DESCARTA a credencial — o tablet nunca vira
// "login do João" (ADR-018/ADR-014 intactos). A UI não toca fila/IndexedDB
// nem calcula capability: decisões chegam prontas dos use cases.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { operationalDateFor, storeDayStartFor } from '@tauros/application';
import { isOverdue } from '@tauros/domain';
import type {
  DailyTaskRecord,
  DailyTaskStatus,
  EffectiveAuthorization,
  EvidenceRecord,
  PlannedScheduleDay,
  TaskExecutionRecord,
} from '@tauros/contracts';

import type { AppContainer } from '../wiring/container.js';
import { FIXTURE_STORE } from '../wiring/fixtures.js';
import { identityRejectionMessage } from './identity-messages.js';

/** Ações críticas que exigem identificação just-in-time. */
export type SharedAction = 'materialize' | 'claim' | 'start' | 'submit' | 'review';

export type SharedFilter = 'all' | 'pending' | 'in-progress' | 'review' | 'returned' | 'done';

/**
 * Estado de PRAZO derivado de apresentação (UI Operacional V1.1) — nunca
 * persistido: NORMAL → DUE_SOON (janela tasks.dueSoonWindowMs do Configuration
 * Engine) → OVERDUE (regra oficial isOverdue do domínio). AWAITING_REVIEW e
 * terminais nunca entram: trabalho entregue não conta atraso do operador.
 */
export type DueState = 'NORMAL' | 'DUE_SOON' | 'OVERDUE';

/** Filtro de responsabilidade da sidebar: posição operacional OU sem responsável. */
export type AssignmentFilter =
  { readonly kind: 'position'; readonly positionId: string } | { readonly kind: 'unassigned' };

/** Filtro de prazo acionado pelos alertas do topo. */
export type DueFilter = 'due-soon' | 'overdue';

/** Posição operacional com tarefas hoje (triagem "onde está o problema?"). */
export interface PositionSummary {
  readonly positionId: string;
  readonly name: string;
  /** Tarefas que ainda exigem ação operacional. */
  readonly openCount: number;
  readonly overdueCount: number;
}

/** Colaborador ESCALADO hoje (fonte: presença planejada — Escala V1). */
export interface TeamMemberSummary {
  readonly employeeId: string;
  readonly name: string;
  readonly positionName: string | null;
  /** Jornada planejada "07:30–19:30" — null sem jornada declarada. */
  readonly workPeriodLabel: string | null;
  readonly openCount: number;
  readonly overdueCount: number;
  /** Entregues aguardando conferência (fila do encarregado, não atraso). */
  readonly awaitingReviewCount: number;
}

export interface SharedTaskView {
  readonly id: string;
  readonly title: string;
  readonly status: DailyTaskStatus;
  /** Rótulo operacional pt-BR do estado (nunca jargão técnico). */
  readonly statusLabel: string;
  /** Posição responsável EFETIVA (assignedPositionId ?? target) — filtros. */
  readonly positionId: string | null;
  readonly positionName: string | null;
  readonly startedByEmployeeId: string | null;
  /** Estado derivado de prazo + rótulo pronto ("Vence em 18 min"). */
  readonly dueState: DueState;
  readonly dueLabel: string | null;
  /**
   * Responsáveis NOMEADOS no card: colaboradores ESCALADOS hoje na posição
   * responsável (fonte oficial única — Escala V1). Quando NINGUÉM está
   * escalado nela, cai nos OCUPANTES vigentes do diretório para o card não
   * ficar mudo — sinalizado por `assigneesOffSchedule` (rótulo honesto).
   * Nomear NUNCA autoriza: claim/start seguem decididos pelo domínio.
   */
  readonly assigneeNames: readonly string[];
  /** true quando os nomes vieram do fallback de ocupantes (ninguém escalado). */
  readonly assigneesOffSchedule: boolean;
  /** Quem está executando (início real). */
  readonly startedByName: string | null;
  readonly startTime: string | null;
  readonly dueTime: string;
  readonly startedAtTime: string | null;
  readonly isUnassigned: boolean;
  readonly isLate: boolean;
  readonly requiresPhoto: boolean;
  readonly requiresReview: boolean;
  readonly evidenceCount: number;
  /** Motivo da devolução vigente (correção necessária). */
  readonly correctionReason: string | null;
  readonly syncLabel: string | null;
  /** Faixa esperada (medição obrigatória) — null sem faixa. */
  readonly expectedRange: { readonly min: number | null; readonly max: number | null } | null;
}

export interface SharedCounts {
  readonly pending: number;
  readonly inProgress: number;
  readonly awaitingReview: number;
  readonly done: number;
  readonly late: number;
  /** Tarefas ainda em aberto (exigem ação operacional). */
  readonly open: number;
  /** Próximas do prazo (DUE_SOON) — alimenta o alerta do topo. */
  readonly dueSoon: number;
  /** Devolvidas para correção (NEEDS_CORRECTION) — cobrança visível. */
  readonly needsCorrection: number;
}

/** Colaborador selecionável na identificação (nome + employeeId; sem PIN). */
export interface IdentityCandidate {
  readonly employeeId: string;
  readonly name: string;
}

/** Pedido de identificação em curso (Dialog: selecionar colaborador → PIN). */
export interface PinRequest {
  readonly action: SharedAction;
  readonly taskId: string | null;
  readonly taskTitle: string | null;
  /** Título operacional do pedido ("Identifique-se para assumir…"). */
  readonly prompt: string;
  /** Colaboradores selecionáveis (ADR-021: employeeId identifica, PIN verifica). */
  readonly candidates: readonly IdentityCandidate[];
  /** Comprimento do PIN vindo do Configuration Engine (nunca hardcoded). */
  readonly pinLength: number;
  readonly error: string | null;
  readonly busy: boolean;
}

export interface ReviewDetailView {
  readonly taskId: string;
  readonly title: string;
  readonly executorName: string;
  readonly positionName: string | null;
  readonly plannedWindow: string;
  readonly startedAtTime: string | null;
  readonly finishedAtTime: string;
  readonly notes: string | null;
  readonly evidence: readonly { readonly id: string; readonly url: string | null }[];
  readonly error: string | null;
  readonly busy: boolean;
}

export interface SubmitFormView {
  readonly taskId: string;
  readonly title: string;
  readonly requiresPhoto: boolean;
  readonly requiresReview: boolean;
  readonly expectedRange: { readonly min: number | null; readonly max: number | null } | null;
  readonly evidence: readonly { readonly id: string; readonly url: string | null }[];
  readonly error: string | null;
  readonly busy: boolean;
}

export interface SharedOperationsView {
  readonly phase: 'loading' | 'ready' | 'error';
  readonly operationalDate: string;
  readonly filter: SharedFilter;
  /** Filtros combináveis da sidebar (interseção; leitura pura — sem fila/audit). */
  readonly assignmentFilter: AssignmentFilter | null;
  readonly employeeFilter: string | null;
  /** Nome do colaborador filtrado (chip "Tarefas de João"). */
  readonly employeeFilterName: string | null;
  readonly dueFilter: DueFilter | null;
  readonly tasks: readonly SharedTaskView[];
  readonly counts: SharedCounts;
  /** Posições com tarefas hoje + contadores (dimensão real de agrupamento). */
  readonly positionSummaries: readonly PositionSummary[];
  /** Tarefas abertas ainda sem responsável (aguardam distribuição). */
  readonly unassignedCount: number;
  /** Colaboradores PLANEJADOS na data operacional (nunca o cadastro inteiro). */
  readonly teamToday: readonly TeamMemberSummary[];
  /** 'unconfigured' = loja sem padrão de escala vigente para a data. */
  readonly scheduleStatus: 'resolved' | 'unconfigured';
  readonly deviceOnline: boolean;
  readonly readyToSync: boolean;
  /** Registros deste quadro ainda aguardando envio (syncStatus 'queued'). */
  readonly pendingSyncCount: number;
  /** Nenhuma ocorrência materializada: o dia precisa ser aberto por alguém. */
  readonly dayNotMaterialized: boolean;
  readonly pinRequest: PinRequest | null;
  readonly submitForm: SubmitFormView | null;
  readonly reviewDetail: ReviewDetailView | null;
  readonly notice: string | null;
}

export interface SharedOperationsActions {
  readonly setFilter: (filter: SharedFilter) => void;
  readonly setAssignmentFilter: (filter: AssignmentFilter | null) => void;
  readonly setEmployeeFilter: (employeeId: string | null) => void;
  readonly setDueFilter: (filter: DueFilter | null) => void;
  /** Limpa TODOS os filtros (situação, posição, colaborador e prazo). */
  readonly clearFilters: () => void;
  /** Abre o pedido de PIN contextual para a ação crítica. */
  readonly requestAction: (action: SharedAction, taskId: string | null) => void;
  readonly cancelPin: () => void;
  /** employeeId + PIN → identidade → permissões → ação → credencial descartada. */
  readonly confirmPin: (employeeId: string, pin: string) => Promise<void>;
  readonly addEvidence: (file: File) => Promise<void>;
  readonly submitExecution: (input: {
    readonly numericValue: number | null;
    readonly notes: string;
  }) => Promise<void>;
  readonly cancelSubmit: () => void;
  readonly approve: () => Promise<void>;
  readonly sendBack: (reason: string) => Promise<void>;
  readonly cancelReview: () => void;
  readonly reload: () => Promise<void>;
  /** Drena a fila agora e recarrega o quadro (leitura + envio; sem PIN). */
  readonly syncNow: () => Promise<void>;
}

const STATUS_LABEL: Readonly<Record<DailyTaskStatus, string>> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em execução',
  AWAITING_REVIEW: 'Aguardando conferência',
  NEEDS_CORRECTION: 'Correção necessária',
  DONE: 'Concluída',
  OVERDUE: 'Atrasada',
  SKIPPED: 'Adiada',
};

const ACTION_PROMPT: Readonly<Record<SharedAction, string>> = {
  materialize: 'Identifique-se para abrir o dia da operação',
  claim: 'Identifique-se para assumir esta tarefa',
  start: 'Identifique-se para iniciar esta tarefa',
  submit: 'Identifique-se para finalizar esta tarefa',
  review: 'Identificação do encarregado',
};

// formatter CACHEADO por fuso: construir Intl.DateTimeFormat é caro e este
// caminho roda por tarefa a cada render (com 100 tarefas + tick de minuto,
// seriam centenas de construções por minuto)
const TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
function timeFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = TIME_FORMATTERS.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    });
    TIME_FORMATTERS.set(timeZone, formatter);
  }
  return formatter;
}

function timeOfDay(iso: string | null | undefined, timeZone: string): string | null {
  if (iso == null || iso === '') return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return timeFormatterFor(timeZone).format(date);
}

function syncLabelFor(status: DailyTaskRecord['syncStatus']): string | null {
  if (status === 'queued') return 'Salvo neste aparelho — aguardando sincronização';
  if (status === 'conflict') return 'Precisa de revisão (conflito entre aparelhos)';
  // 'failed' local = estado TERMINAL da fila (sem nova tentativa automática):
  // rótulo honesto — prometer retry aqui esconderia um registro parado
  if (status === 'failed') return 'Não foi possível enviar este registro — avise o encarregado';
  return null;
}

/**
 * Estado de prazo DERIVADO (apresentação): a regra de VENCIDA é
 * exclusivamente a oficial do domínio (isOverdue — trabalho entregue/terminal
 * nunca atrasa). DUE_SOON reaproveita o MESMO conjunto de exclusões
 * perguntando "esta tarefa ainda poderia vencer?" (isOverdue logo após o
 * prazo) — nenhuma lista de status é duplicada aqui.
 */
export function dueStateFor(
  status: DailyTaskStatus,
  dueAt: Date,
  now: Date,
  dueSoonWindowMs: number,
): DueState {
  if (isOverdue(status, dueAt, now)) return 'OVERDUE';
  const couldStillOverdue = isOverdue(status, dueAt, new Date(dueAt.getTime() + 1));
  if (!couldStillOverdue) return 'NORMAL';
  return dueAt.getTime() - now.getTime() <= dueSoonWindowMs ? 'DUE_SOON' : 'NORMAL';
}

/** Duração operacional legível — granularidade de minuto ("18 min", "1 h 24 min"). */
function formatDurationMinutes(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${String(minutes)} min`;
  if (minutes === 0) return `${String(hours)} h`;
  return `${String(hours)} h ${String(minutes)} min`;
}

function dueLabelFor(state: DueState, dueAt: Date, now: Date): string | null {
  if (state === 'DUE_SOON')
    return `Vence em ${formatDurationMinutes(dueAt.getTime() - now.getTime())}`;
  if (state === 'OVERDUE')
    return `Atrasada há ${formatDurationMinutes(now.getTime() - dueAt.getTime())}`;
  return null;
}

/** A tarefa ainda exige ação operacional (aberta)? */
function isOpenStatus(status: DailyTaskStatus): boolean {
  return (
    status === 'PENDING' ||
    status === 'OVERDUE' ||
    status === 'IN_PROGRESS' ||
    status === 'NEEDS_CORRECTION'
  );
}

/**
 * Atribuição de leitura tarefa→colaborador: quem INICIOU responde pela
 * tarefa; sem início, respondem os escalados na posição responsável. Regra
 * de APRESENTAÇÃO da triagem — nunca autorização (ADR-018 intacto).
 */
function taskBelongsToEmployee(
  task: SharedTaskView,
  employee: { readonly employeeId: string; readonly positionId: string | null },
): boolean {
  if (task.startedByEmployeeId !== null) return task.startedByEmployeeId === employee.employeeId;
  return task.positionId !== null && task.positionId === employee.positionId;
}

export function useSharedOperations(
  container: AppContainer,
): [SharedOperationsView, SharedOperationsActions] {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState<SharedFilter>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);
  const [dueFilter, setDueFilter] = useState<DueFilter | null>(null);
  const [records, setRecords] = useState<readonly DailyTaskRecord[]>([]);
  const [plannedDay, setPlannedDay] = useState<PlannedScheduleDay | null>(null);
  const [dueSoonWindowMs, setDueSoonWindowMs] = useState(0);
  // relógio de APRESENTAÇÃO: tick de minuto para NORMAL→DUE_SOON→OVERDUE sem
  // refresh manual — nenhuma mutation/materialização; só re-render (§21)
  const [nowMs, setNowMs] = useState(() => container.clock().getTime());
  const [evidenceByTask, setEvidenceByTask] = useState<
    ReadonlyMap<string, readonly EvidenceRecord[]>
  >(new Map());
  const [executionsById, setExecutionsById] = useState<ReadonlyMap<string, TaskExecutionRecord>>(
    new Map(),
  );
  const [employeeNames, setEmployeeNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [positionNames, setPositionNames] = useState<ReadonlyMap<string, string>>(new Map());
  // OCUPANTES vigentes por posição (diretório da loja) — fallback dos nomes do
  // card quando a posição não tem ninguém escalado hoje. Não é escala.
  const [occupantsByPosition, setOccupantsByPosition] = useState<
    ReadonlyMap<string, readonly string[]>
  >(new Map());
  const [connectivity, setConnectivity] = useState({ deviceOnline: true, readyToSync: false });
  const [pinRequest, setPinRequest] = useState<PinRequest | null>(null);
  const [submitForm, setSubmitForm] = useState<SubmitFormView | null>(null);
  const [reviewDetail, setReviewDetail] = useState<ReviewDetailView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busyRef = useRef(false);
  /**
   * Ator da AÇÃO em curso — efêmero por desenho: vive só entre o PIN e o fim
   * da ação (drawer de envio/conferência) e NUNCA vira sessão do tablet. A
   * autoria usa employeeId REAL; profileId/membershipId vêm da autorização.
   */
  const actorRef = useRef<{
    readonly employeeId: string;
    readonly authorization: EffectiveAuthorization;
  } | null>(null);
  const [pinLength, setPinLength] = useState(6);
  const [roster, setRoster] = useState<readonly IdentityCandidate[]>([]);

  const today = operationalDateFor(container.clock(), FIXTURE_STORE.timeZone);

  const load = useCallback(async () => {
    try {
      const readiness = await container.connectivity.assess();
      setConnectivity({ deviceOnline: readiness.deviceOnline, readyToSync: readiness.readyToSync });
      const [tasks, employees, positions, planned, roster, policy, dueSoonWindow] =
        await Promise.all([
          container.tasks.byWorkDate(FIXTURE_STORE.id, today),
          container.workforce.employees(FIXTURE_STORE.id),
          // diretório COMPLETO de posições (base + criadas na loja): os cards e
          // a triagem nomeiam qualquer posição responsável, nunca "Equipe"
          container.team.positions(FIXTURE_STORE.id),
          container.plannedDay(FIXTURE_STORE.id, today),
          container.identityRoster(FIXTURE_STORE.id),
          container.pinPolicy.resolve(FIXTURE_STORE.id),
          container.config.resolve('tasks.dueSoonWindowMs', FIXTURE_STORE.id),
        ]);
      setPlannedDay(planned);
      setDueSoonWindowMs(dueSoonWindow);
      setRoster(roster);
      setPinLength(policy.length);
      setNowMs(container.clock().getTime());
      setRecords([...tasks].sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
      setEmployeeNames(new Map(employees.map((employee) => [employee.id, employee.fullName])));
      setPositionNames(new Map(positions.map((position) => [position.id, position.name])));

      // FALLBACK dos nomes do card: OCUPANTES VIGENTES por posição (diretório
      // local, sem identidade — leitura do dispositivo; mesma regra única de
      // vigência do domínio). Só entra quando a posição não tem NINGUÉM
      // escalado hoje: a presença planejada é a fonte oficial e vem de
      // `plannedDay`. A autorização de um ator NUNCA é reutilizada em leituras.
      const occupants = new Map<string, string[]>();
      const members = await container.team.members(FIXTURE_STORE.id);
      for (const member of members) {
        if (member.positionId === null) continue;
        const names = occupants.get(member.positionId) ?? [];
        names.push(member.fullName);
        occupants.set(member.positionId, names);
      }
      setOccupantsByPosition(occupants);

      // leituras POR TAREFA em paralelo: sequenciais seriam 100–200
      // transações IndexedDB encadeadas com 100 tarefas (tablet fraco)
      const evidence = new Map<string, readonly EvidenceRecord[]>();
      const executions = new Map<string, TaskExecutionRecord>();
      await Promise.all(
        tasks.map(async (task) => {
          const [taskEvidence, execution] = await Promise.all([
            container.evidence.byDailyTask(FIXTURE_STORE.id, task.id),
            task.lastExecutionId !== null
              ? container.tasks.executionById(task.lastExecutionId)
              : Promise.resolve(null),
          ]);
          evidence.set(task.id, taskEvidence);
          if (execution !== null) executions.set(task.id, execution);
        }),
      );
      setEvidenceByTask(evidence);
      setExecutionsById(executions);
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [container, today]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await container.reconcileFromQueue();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [container, load]);

  // tick de MINUTO (granularidade operacional): re-render leve; o Clock
  // injetado continua sendo a única fonte de agora (testável). Sem leak:
  // clearInterval no unmount.
  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(container.clock().getTime());
    }, 60_000);
    return () => {
      clearInterval(id);
    };
  }, [container]);

  const requestAction = useCallback(
    (action: SharedAction, taskId: string | null) => {
      setNotice(null);
      const task = taskId !== null ? records.find((record) => record.id === taskId) : null;
      setPinRequest({
        action,
        taskId,
        taskTitle: task?.template.title ?? null,
        prompt: ACTION_PROMPT[action],
        candidates: roster,
        pinLength,
        error: null,
        busy: false,
      });
    },
    [records, roster, pinLength],
  );

  const cancelPin = useCallback(() => {
    setPinRequest((current) => (current?.busy === true ? current : null));
  }, []);

  /** Sessão operacional do ator (ADR-014): reusa a ativa ou abre agora. */
  const resolveActorSession = useCallback(
    async (
      authorization: EffectiveAuthorization,
      online: boolean,
    ): Promise<string | 'stale-session' | null> => {
      const active = await container.sessions.findActive(
        FIXTURE_STORE.id,
        authorization.operatorEmployeeId,
      );
      if (active !== null) {
        // virada do dia: sessão ACTIVE de OUTRO dia operacional não recebe a
        // execução de hoje — mesmo contrato das guardas de /turno
        if (
          active.operationalDate !== operationalDateFor(container.clock(), FIXTURE_STORE.timeZone)
        ) {
          return 'stale-session';
        }
        return active.id;
      }
      const opened = await container.openSession.execute({
        authorization,
        // membership de plataforma opcional (ADR-021): null até provisionamento
        membershipId: authorization.membershipId ?? null,
        deviceId: container.deviceId,
        storeTimeZone: FIXTURE_STORE.timeZone,
        openedOffline: !online,
      });
      if (opened.kind === 'opened' || opened.kind === 'already-open') return opened.record.id;
      return null;
    },
    [container],
  );

  /** Object URLs vivas dos drawers — revogadas ao recriar/fechar (memória). */
  const objectUrlsRef = useRef<string[]>([]);

  const revokeEvidenceUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ambiente sem object URLs */
      }
    }
    objectUrlsRef.current = [];
  }, []);

  const evidenceViews = useCallback(
    async (
      taskId: string,
      relevant?: (record: EvidenceRecord) => boolean,
    ): Promise<readonly { id: string; url: string | null }[]> => {
      revokeEvidenceUrls();
      const all = await container.evidence.byDailyTask(FIXTURE_STORE.id, taskId);
      // ESCOPO honesto: cada drawer vê SÓ o que conta para ele — a conferência
      // nunca decide com foto de outra execução; o envio nunca exibe foto que
      // não satisfaz requiresPhoto (órfã de tentativa abandonada de terceiro)
      const records = relevant === undefined ? all : all.filter(relevant);
      const views: { id: string; url: string | null }[] = [];
      for (const record of records) {
        const blob = await container.evidenceBlobs.get(record.localBlobKey);
        let url: string | null = null;
        if (blob !== null) {
          try {
            url = URL.createObjectURL(blob);
            objectUrlsRef.current.push(url);
          } catch {
            url = null; // ambiente sem object URLs — o metadado segue visível
          }
        }
        views.push({ id: record.id, url });
      }
      return views;
    },
    [container, revokeEvidenceUrls],
  );

  const confirmPin = useCallback(
    async (employeeId: string, pin: string) => {
      const request = pinRequest;
      if (request === null || busyRef.current) return;
      busyRef.current = true;
      setPinRequest({ ...request, busy: true, error: null });
      // só os fluxos com drawer (finalizar/conferir) retêm o ator até o
      // fechamento; qualquer outro desfecho descarta a credencial no finally
      let retainActor = false;
      // o diálogo foi fechado programaticamente neste fluxo? decide, de forma
      // DETERMINÍSTICA, para onde vai um erro inesperado (diálogo vs notice)
      let dialogDismissed = false;
      const dismissDialog = (): void => {
        dialogDismissed = true;
        setPinRequest(null);
      };
      try {
        // employeeId identifica, PIN verifica (ADR-021). O port resolve a
        // origem (credencial local real OU fixture DEV) — o controller não sabe.
        const outcome = await container.identity.verify({
          storeId: FIXTURE_STORE.id,
          employeeId,
          pin,
          deviceId: container.deviceId,
        });
        if (outcome.kind === 'rejected') {
          // catálogo único: condição permanente nunca vira "tente novamente"
          setPinRequest({
            ...request,
            busy: false,
            error: identityRejectionMessage(outcome.code),
          });
          return;
        }
        const authorization = outcome.authorization;
        const readiness = await container.connectivity.assess();
        // autorização vale SÓ para esta ação: nas ações de um passo
        // (abrir dia/assumir/iniciar) é descartada no finally; nos fluxos com
        // drawer (finalizar/conferir) sobrevive APENAS até o drawer fechar.
        container.setAuthorization(authorization);
        actorRef.current = { employeeId: authorization.operatorEmployeeId, authorization };

        const fail = (message: string): void => {
          setPinRequest({ ...request, busy: false, error: message });
        };

        switch (request.action) {
          case 'materialize': {
            const materialized = await container.loadDailyTasks.execute({
              authorization,
              workDate: today,
              operationalDayStart: storeDayStartFor(container.clock(), FIXTURE_STORE.timeZone),
              configVersionRef: null,
            });
            if (materialized.kind === 'failed') {
              fail('Não foi possível abrir o dia agora. Tente novamente.');
              return;
            }
            dismissDialog();
            await load();
            return;
          }
          case 'claim': {
            const claimed = await container.claimDailyTask.execute({
              authorization,
              deviceId: container.deviceId,
              dailyTaskId: request.taskId ?? '',
              workDate: today,
              claimedOffline: !readiness.readyToSync,
            });
            if (claimed.kind === 'failed') {
              fail(
                claimed.code === 'ACTOR_NOT_SCHEDULED'
                  ? 'Você não aparece na escala de hoje. Se a escala do dia não estiver configurada, avise o encarregado.'
                  : claimed.code === 'ACTOR_WITHOUT_POSITION'
                    ? 'Você ainda não tem posição cadastrada. Peça ao encarregado para configurar seu vínculo.'
                    : claimed.code === 'ALREADY_ASSIGNED'
                      ? 'Esta tarefa já tem responsável definido.'
                      : claimed.code === 'SNAPSHOT_EXPIRED'
                        ? 'Sua identificação expirou. Feche e identifique-se novamente.'
                        : 'Não foi possível assumir a tarefa agora.',
              );
              return;
            }
            if (readiness.readyToSync) await container.drainAndReflect();
            dismissDialog();
            setNotice('Tarefa assumida.');
            await load();
            return;
          }
          case 'start': {
            const started = await container.startDailyTask.execute({
              authorization,
              deviceId: container.deviceId,
              dailyTaskId: request.taskId ?? '',
              workDate: today,
              startedOffline: !readiness.readyToSync,
            });
            if (started.kind === 'failed') {
              fail(
                started.code === 'NOT_ELIGIBLE'
                  ? 'Esta tarefa é da responsabilidade de outra posição.'
                  : started.code === 'ALREADY_STARTED_BY_OTHER'
                    ? 'Outra pessoa já está executando esta tarefa.'
                    : started.code === 'TASK_UNASSIGNED'
                      ? 'Assuma a tarefa antes de iniciar.'
                      : started.code === 'TASK_NOT_STARTABLE'
                        ? 'Esta tarefa não está mais disponível para iniciar — pode já ter sido resolvida em outro aparelho.'
                        : started.code === 'SNAPSHOT_EXPIRED'
                          ? 'Sua identificação expirou. Feche e identifique-se novamente.'
                          : 'Não foi possível iniciar a tarefa agora.',
              );
              return;
            }
            if (readiness.readyToSync) await container.drainAndReflect();
            dismissDialog();
            setNotice('Tarefa iniciada.');
            await load();
            return;
          }
          case 'submit': {
            // abre o drawer de finalização COM o ator resolvido (a credencial
            // já foi descartada; a autorização efêmera segue no actorRef até
            // o envio ou cancelamento)
            const task = records.find((record) => record.id === request.taskId);
            if (task === undefined) {
              fail('Tarefa não encontrada neste aparelho.');
              return;
            }
            dismissDialog();
            retainActor = true;
            setSubmitForm({
              taskId: task.id,
              title: task.template.title,
              requiresPhoto: task.template.requiresPhoto,
              requiresReview: task.template.requiresReview ?? false,
              expectedRange:
                task.expectedMinSnapshot !== null || task.expectedMaxSnapshot !== null
                  ? { min: task.expectedMinSnapshot, max: task.expectedMaxSnapshot }
                  : null,
              // só o que CONTA para este envio: pendentes capturadas pelo
              // PRÓPRIO ator (mesmo critério do submitExecution)
              evidence: await evidenceViews(
                task.id,
                (record) =>
                  record.executionId === null &&
                  record.capturedByEmployeeId === authorization.operatorEmployeeId,
              ),
              error: null,
              busy: false,
            });
            return;
          }
          case 'review': {
            const task = records.find((record) => record.id === request.taskId);
            const execution = task !== undefined ? executionsById.get(task.id) : undefined;
            if (task === undefined || execution === undefined) {
              fail('Execução não encontrada neste aparelho.');
              return;
            }
            dismissDialog();
            retainActor = true;
            setReviewDetail({
              taskId: task.id,
              title: task.template.title,
              executorName:
                employeeNames.get(execution.performedByEmployeeId) ??
                execution.performedByEmployeeId,
              positionName:
                task.assignedPositionId !== null
                  ? (positionNames.get(task.assignedPositionId) ?? null)
                  : task.template.targetPositionId !== null
                    ? (positionNames.get(task.template.targetPositionId) ?? null)
                    : null,
              plannedWindow: `${timeOfDay(task.plannedStartAt, FIXTURE_STORE.timeZone) ?? '—'}–${timeOfDay(task.dueAt, FIXTURE_STORE.timeZone) ?? '—'}`,
              startedAtTime: timeOfDay(execution.startedAt, FIXTURE_STORE.timeZone),
              finishedAtTime: timeOfDay(execution.eventTime, FIXTURE_STORE.timeZone) ?? '—',
              notes: execution.notes,
              // P1: a conferência decide SOBRE ESTA execução — nunca com foto
              // órfã de terceiros nem de rodada devolvida anterior
              evidence: await evidenceViews(
                task.id,
                (record) => record.executionId === execution.id,
              ),
              error: null,
              busy: false,
            });
            return;
          }
        }
      } catch {
        // exceção inesperada (ex.: IndexedDB) NUNCA congela o diálogo em
        // busy — cancelar recusa fechar enquanto busy e o tablet ficaria
        // preso até reload. Mesmo canal de erro dos caminhos 'failed'.
        // Se o diálogo JÁ fechou (falha ao montar o drawer), o erro vai ao
        // notice do quadro — nunca silêncio.
        if (dialogDismissed) {
          // diálogo já fechado neste fluxo (falha após montar um drawer ou
          // no pós-processamento): o erro vai ao notice do quadro — nunca
          // silêncio, nunca duplicado
          setSubmitForm(null);
          setReviewDetail(null);
          setNotice('Algo deu errado neste aparelho. Tente novamente.');
        } else {
          setPinRequest((current) =>
            current === null
              ? null
              : {
                  ...current,
                  busy: false,
                  error: 'Algo deu errado neste aparelho. Tente novamente.',
                },
          );
        }
        retainActor = false;
      } finally {
        busyRef.current = false;
        // credencial fora da memória: o PIN nunca sai deste callback e a
        // autorização efetiva só sobrevive dentro de um drawer aberto
        if (!retainActor) {
          actorRef.current = null;
          container.setAuthorization(null);
        }
      }
    },
    [
      container,
      employeeNames,
      evidenceViews,
      executionsById,
      load,
      pinRequest,
      positionNames,
      records,
      today,
    ],
  );

  const endActorContext = useCallback(() => {
    actorRef.current = null;
    container.setAuthorization(null);
    revokeEvidenceUrls();
  }, [container, revokeEvidenceUrls]);

  // CONTENÇÃO DE AUTORIA (P0): se a tela desmontar com um drawer aberto
  // (navegação, back gesture), a autorização retida do ator NÃO pode
  // sobreviver no container — itens de fila de outra tela sairiam com a
  // autoria de quem abandonou o drawer. Mesmo destino das object URLs.
  useEffect(() => {
    return () => {
      actorRef.current = null;
      container.setAuthorization(null);
      revokeEvidenceUrls();
    };
  }, [container, revokeEvidenceUrls]);

  const addEvidence = useCallback(
    async (file: File) => {
      const actor = actorRef.current;
      const form = submitForm;
      if (actor === null || form === null || busyRef.current) return;
      busyRef.current = true;
      setSubmitForm({ ...form, busy: true, error: null });
      try {
        const readiness = await container.connectivity.assess();
        const added = await container.addTaskEvidence.execute({
          authorization: actor.authorization,
          deviceId: container.deviceId,
          dailyTaskId: form.taskId,
          blob: file,
          mimeType: file.type,
          capturedOffline: !readiness.readyToSync,
        });
        if (added.kind === 'failed') {
          setSubmitForm({
            ...form,
            busy: false,
            error:
              added.code === 'INVALID_TYPE'
                ? 'Escolha uma imagem.'
                : added.code === 'TOO_LARGE'
                  ? 'Imagem grande demais para este aparelho.'
                  : 'Não foi possível anexar a foto agora.',
          });
          return;
        }
        setSubmitForm({
          ...form,
          busy: false,
          evidence: await evidenceViews(
            form.taskId,
            (record) =>
              record.executionId === null && record.capturedByEmployeeId === actor.employeeId,
          ),
        });
      } catch {
        setSubmitForm((current) =>
          current === null
            ? null
            : { ...current, busy: false, error: 'Não foi possível anexar a foto agora.' },
        );
      } finally {
        busyRef.current = false;
      }
    },
    [container, evidenceViews, submitForm],
  );

  const submitExecution = useCallback(
    async (input: { numericValue: number | null; notes: string }) => {
      const actor = actorRef.current;
      const form = submitForm;
      if (actor === null || form === null || busyRef.current) return;
      busyRef.current = true;
      setSubmitForm({ ...form, busy: true, error: null });
      try {
        const readiness = await container.connectivity.assess();
        const sessionId = await resolveActorSession(actor.authorization, readiness.readyToSync);
        if (sessionId === 'stale-session') {
          setSubmitForm({
            ...form,
            busy: false,
            error:
              'Você tem um turno de outro dia ainda aberto. Feche-o na tela de turno antes de registrar.',
          });
          return;
        }
        if (sessionId === null) {
          // pode ser permissão OU falha técnica na abertura — não acusar o
          // perfil da pessoa sem certeza
          setSubmitForm({
            ...form,
            busy: false,
            error:
              'Não foi possível abrir seu turno para registrar a execução. Tente novamente; se persistir, avise o encarregado.',
          });
          return;
        }
        // só evidências pendentes capturadas PELO PRÓPRIO ator: foto órfã de
        // uma tentativa abandonada de outra pessoa não satisfaz requiresPhoto
        const evidence = await container.evidence.byDailyTask(FIXTURE_STORE.id, form.taskId);
        const pendingIds = evidence
          .filter(
            (record) =>
              record.executionId === null && record.capturedByEmployeeId === actor.employeeId,
          )
          .map((record) => record.id);
        const recorded = await container.recordTaskOutcome.execute({
          authorization: actor.authorization,
          dailyTaskId: form.taskId,
          operatorSessionId: sessionId,
          deviceId: container.deviceId,
          kind: 'complete',
          numericValue: input.numericValue,
          notes: input.notes.trim() === '' ? null : input.notes.trim(),
          hasEvidence: false,
          evidenceIds: pendingIds,
          performedOffline: !readiness.readyToSync,
        });
        if (recorded.kind === 'failed') {
          setSubmitForm({
            ...form,
            busy: false,
            error:
              recorded.code === 'EVIDENCE_REQUIRED'
                ? 'Adicione a foto solicitada antes de enviar para conferência.'
                : recorded.code === 'VALUE_REQUIRED'
                  ? 'Informe a medição registrada.'
                  : recorded.code === 'TASK_ALREADY_RESOLVED'
                    ? 'Esta tarefa já foi resolvida — possivelmente em outro aparelho. Nada foi perdido.'
                    : recorded.code === 'SNAPSHOT_EXPIRED'
                      ? 'Sua identificação expirou. Feche este painel e identifique-se novamente.'
                      : 'Não foi possível finalizar agora. Tente novamente.',
          });
          return;
        }
        if (readiness.readyToSync) await container.drainAndReflect();
        setSubmitForm(null);
        endActorContext();
        setNotice(
          recorded.kind === 'recorded' && recorded.execution.resultingStatus === 'AWAITING_REVIEW'
            ? 'Execução enviada para conferência.'
            : 'Tarefa concluída.',
        );
        await load();
      } catch {
        setSubmitForm((current) =>
          current === null
            ? null
            : {
                ...current,
                busy: false,
                error: 'Não foi possível finalizar agora. Tente novamente.',
              },
        );
      } finally {
        busyRef.current = false;
      }
    },
    [container, endActorContext, load, resolveActorSession, submitForm],
  );

  const cancelSubmit = useCallback(() => {
    setSubmitForm((current) => {
      if (current?.busy === true) return current;
      endActorContext();
      return null;
    });
  }, [endActorContext]);

  const finishReview = useCallback(
    async (outcome: 'APPROVED' | 'RETURNED', reason: string | null) => {
      const actor = actorRef.current;
      const detail = reviewDetail;
      if (actor === null || detail === null || busyRef.current) return;
      busyRef.current = true;
      setReviewDetail({ ...detail, busy: true, error: null });
      try {
        const readiness = await container.connectivity.assess();
        const reviewed = await container.reviewTaskExecution.execute({
          authorization: actor.authorization,
          deviceId: container.deviceId,
          dailyTaskId: detail.taskId,
          outcome,
          note: reason,
          reviewedOffline: !readiness.readyToSync,
        });
        if (reviewed.kind === 'failed') {
          setReviewDetail({
            ...detail,
            busy: false,
            error:
              reviewed.code === 'PERMISSION_DENIED'
                ? 'Seu perfil não permite conferir execuções.'
                : reviewed.code === 'REVIEWER_IS_EXECUTOR'
                  ? 'Quem executou não pode conferir a própria tarefa.'
                  : reviewed.code === 'REASON_REQUIRED'
                    ? 'Informe o motivo da devolução.'
                    : reviewed.code === 'TASK_NOT_IN_REVIEW' ||
                        reviewed.code === 'ALREADY_REVIEWED_DIFFERENTLY'
                      ? 'Esta execução já foi conferida — possivelmente em outro aparelho.'
                      : reviewed.code === 'SNAPSHOT_EXPIRED'
                        ? 'Sua identificação expirou. Feche este painel e identifique-se novamente.'
                        : 'Não foi possível registrar a conferência agora.',
          });
          return;
        }
        if (readiness.readyToSync) await container.drainAndReflect();
        setReviewDetail(null);
        endActorContext();
        setNotice(outcome === 'APPROVED' ? 'Execução aprovada.' : 'Devolvida para correção.');
        await load();
      } catch {
        setReviewDetail((current) =>
          current === null
            ? null
            : {
                ...current,
                busy: false,
                error: 'Não foi possível registrar a conferência agora.',
              },
        );
      } finally {
        busyRef.current = false;
      }
    },
    [container, endActorContext, load, reviewDetail],
  );

  const syncNow = useCallback(async () => {
    try {
      await container.drainAndReflect();
    } catch {
      /* transporte indisponível — o quadro segue com os rótulos por registro */
    }
    await load();
  }, [container, load]);

  const approve = useCallback(async () => finishReview('APPROVED', null), [finishReview]);
  const sendBack = useCallback(
    async (reason: string) => finishReview('RETURNED', reason),
    [finishReview],
  );
  const cancelReview = useCallback(() => {
    setReviewDetail((current) => {
      if (current?.busy === true) return current;
      endActorContext();
      return null;
    });
  }, [endActorContext]);

  // colaboradores PLANEJADOS hoje (Escala V1) — nunca o cadastro inteiro (§4)
  const plannedEmployees = plannedDay?.status === 'resolved' ? plannedDay.employees : [];

  // ESCALADOS hoje POR POSIÇÃO: fonte oficial dos nomes do card. Derivada da
  // presença planejada; o diretório de ocupantes só entra como fallback.
  const scheduledNamesByPosition = new Map<string, string[]>();
  for (const employee of plannedEmployees) {
    if (employee.positionId === null) continue;
    const names = scheduledNamesByPosition.get(employee.positionId) ?? [];
    names.push(employee.fullName);
    scheduledNamesByPosition.set(employee.positionId, names);
  }

  const now = new Date(nowMs);
  const views: readonly SharedTaskView[] = records.map((record) => {
    const positionId = record.assignedPositionId ?? record.template.targetPositionId;
    const startedBy = record.startedByEmployeeId ?? null;
    const lastExecution = executionsById.get(record.id);
    const dueAt = new Date(record.dueAt);
    // regra oficial única (domínio): entregue/terminal nunca atrasa (§9)
    const dueState = dueStateFor(record.status, dueAt, now, dueSoonWindowMs);
    // ESCALADOS da posição primeiro (fonte oficial); só sem ninguém escalado
    // o card cai nos OCUPANTES vigentes — e diz que estão fora da escala.
    const scheduledNames =
      positionId === null ? [] : (scheduledNamesByPosition.get(positionId) ?? []);
    const occupantNames = positionId === null ? [] : (occupantsByPosition.get(positionId) ?? []);
    const assigneeNames = scheduledNames.length > 0 ? scheduledNames : occupantNames;
    return {
      id: record.id,
      title: record.template.title,
      status: record.status,
      statusLabel: STATUS_LABEL[record.status],
      positionId,
      positionName: positionId === null ? null : (positionNames.get(positionId) ?? 'Equipe'),
      assigneeNames,
      assigneesOffSchedule: scheduledNames.length === 0 && occupantNames.length > 0,
      startedByEmployeeId: startedBy,
      startedByName: startedBy === null ? null : (employeeNames.get(startedBy) ?? startedBy),
      startTime: timeOfDay(record.plannedStartAt, FIXTURE_STORE.timeZone),
      dueTime: timeOfDay(record.dueAt, FIXTURE_STORE.timeZone) ?? '—',
      startedAtTime: timeOfDay(record.startedAt ?? null, FIXTURE_STORE.timeZone),
      isUnassigned: positionId === null,
      isLate: dueState === 'OVERDUE',
      dueState,
      dueLabel: dueLabelFor(dueState, dueAt, now),
      requiresPhoto: record.template.requiresPhoto,
      requiresReview: record.template.requiresReview ?? false,
      evidenceCount: evidenceByTask.get(record.id)?.length ?? 0,
      correctionReason:
        record.status === 'NEEDS_CORRECTION' ? (lastExecution?.review?.note ?? null) : null,
      syncLabel: syncLabelFor(record.syncStatus),
      expectedRange:
        record.expectedMinSnapshot !== null || record.expectedMaxSnapshot !== null
          ? { min: record.expectedMinSnapshot, max: record.expectedMaxSnapshot }
          : null,
    };
  });

  const byFilter = (view: SharedTaskView): boolean => {
    switch (filter) {
      case 'pending':
        return view.status === 'PENDING' || view.status === 'OVERDUE';
      case 'in-progress':
        return view.status === 'IN_PROGRESS' || view.status === 'NEEDS_CORRECTION';
      case 'review':
        return view.status === 'AWAITING_REVIEW';
      case 'returned':
        return view.status === 'NEEDS_CORRECTION';
      case 'done':
        return view.status === 'DONE' || view.status === 'SKIPPED';
      default:
        return true;
    }
  };

  const byAssignment = (view: SharedTaskView): boolean => {
    if (assignmentFilter === null) return true;
    if (assignmentFilter.kind === 'unassigned') return view.positionId === null;
    return view.positionId === assignmentFilter.positionId;
  };

  const filteredEmployee =
    employeeFilter === null
      ? null
      : (plannedEmployees.find((employee) => employee.employeeId === employeeFilter) ?? null);

  const byEmployee = (view: SharedTaskView): boolean => {
    if (employeeFilter === null) return true;
    if (filteredEmployee === null) return false;
    return taskBelongsToEmployee(view, filteredEmployee);
  };

  const byDue = (view: SharedTaskView): boolean => {
    if (dueFilter === null) return true;
    return dueFilter === 'overdue' ? view.dueState === 'OVERDUE' : view.dueState === 'DUE_SOON';
  };

  // triagem da sidebar: SEMPRE sobre o dia inteiro (não sobre o filtrado)
  const openViews = views.filter((task) => isOpenStatus(task.status));
  const positionSummaries: PositionSummary[] = [...positionNames.entries()]
    .map(([positionId, name]) => {
      const todays = views.filter((task) => task.positionId === positionId);
      const open = todays.filter((task) => isOpenStatus(task.status));
      return {
        positionId,
        name,
        openCount: open.length,
        overdueCount: open.filter((task) => task.dueState === 'OVERDUE').length,
        hasTasks: todays.length > 0,
      };
    })
    .filter((summary) => summary.hasTasks)
    .map(({ positionId, name, openCount, overdueCount }) => ({
      positionId,
      name,
      openCount,
      overdueCount,
    }));

  const teamToday: TeamMemberSummary[] = plannedEmployees.map((employee) => {
    const mine = views.filter((task) => taskBelongsToEmployee(task, employee));
    const open = mine.filter((task) => isOpenStatus(task.status));
    return {
      employeeId: employee.employeeId,
      name: employee.fullName,
      positionName: employee.positionName,
      workPeriodLabel:
        employee.workPeriod === null
          ? null
          : `${employee.workPeriod.startTime}–${employee.workPeriod.endTime}`,
      openCount: open.length,
      overdueCount: open.filter((task) => task.dueState === 'OVERDUE').length,
      awaitingReviewCount: mine.filter((task) => task.status === 'AWAITING_REVIEW').length,
    };
  });

  const view: SharedOperationsView = {
    phase,
    operationalDate: today,
    filter,
    assignmentFilter,
    employeeFilter,
    employeeFilterName: filteredEmployee?.fullName ?? null,
    dueFilter,
    tasks: views.filter(
      (task) => byFilter(task) && byAssignment(task) && byEmployee(task) && byDue(task),
    ),
    counts: {
      pending: views.filter((task) => task.status === 'PENDING' || task.status === 'OVERDUE')
        .length,
      inProgress: views.filter((task) => task.status === 'IN_PROGRESS').length,
      awaitingReview: views.filter((task) => task.status === 'AWAITING_REVIEW').length,
      done: views.filter((task) => task.status === 'DONE').length,
      late: views.filter((task) => task.isLate).length,
      open: openViews.length,
      dueSoon: views.filter((task) => task.dueState === 'DUE_SOON').length,
      needsCorrection: views.filter((task) => task.status === 'NEEDS_CORRECTION').length,
    },
    positionSummaries,
    unassignedCount: openViews.filter((task) => task.positionId === null).length,
    teamToday,
    scheduleStatus: plannedDay?.status === 'unconfigured' ? 'unconfigured' : 'resolved',
    deviceOnline: connectivity.deviceOnline,
    readyToSync: connectivity.readyToSync,
    pendingSyncCount: records.filter((record) => record.syncStatus === 'queued').length,
    dayNotMaterialized: phase === 'ready' && records.length === 0,
    pinRequest,
    submitForm,
    reviewDetail,
    notice,
  };

  const clearFilters = useCallback(() => {
    setFilter('all');
    setAssignmentFilter(null);
    setEmployeeFilter(null);
    setDueFilter(null);
  }, []);

  return [
    view,
    {
      setFilter,
      setAssignmentFilter,
      setEmployeeFilter,
      setDueFilter,
      clearFilters,
      requestAction,
      cancelPin,
      confirmPin,
      addEvidence,
      submitExecution,
      cancelSubmit,
      approve,
      sendBack,
      cancelReview,
      reload: load,
      syncNow,
    },
  ];
}
