// View model da Gestão de Equipe (seção "Equipe" da Área do Encarregado) —
// única fonte de cada estado; a UI não toca fila/IndexedDB/permissões e não
// monta chave de idempotência: tudo passa pelos use cases. Decisões de
// permissão PRONTAS (ADR-018): workforce.write governa colaboradores;
// config.write governa posições (dado configurável, ADR-019). Estados
// discriminados por formulário, nunca combinações frágeis de booleanos.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { operationalDateFor } from '@tauros/application';
import type {
  PlannedScheduleDay,
  ScheduleSyncStatus,
  TeamRecord,
  WorkforceSyncStatus,
} from '@tauros/contracts';
import { CAPABILITY_CONFIG_WRITE, CAPABILITY_WORKFORCE_WRITE } from '@tauros/contracts';

import type { AppContainer } from '../wiring/container.js';
import { FIXTURE_STORE } from '../wiring/fixtures.js';
import { useOperatorSession } from './operator-session-context.js';

export type TeamManagementTab = 'members' | 'positions' | 'teams' | 'schedule';

export type TeamFormState =
  | { readonly status: 'idle' }
  | { readonly status: 'open' }
  | { readonly status: 'submitting' }
  | { readonly status: 'error'; readonly message: string };

export interface TeamMemberItemView {
  readonly employeeId: string;
  readonly fullName: string;
  readonly positionName: string;
  readonly teamId: string | null;
  readonly teamName: string;
  /** Janela da JORNADA do vínculo ("07:30–19:30"); null = sem jornada. */
  readonly workPeriodLabel: string | null;
  /** dd/mm/aaaa (fuso da loja) — início do vínculo cadastrado. */
  readonly startDateLabel: string;
  readonly syncStatus: WorkforceSyncStatus;
  /**
   * Credencial de PIN existe neste aparelho (ADR-021). false = a pessoa NÃO
   * consegue se identificar — a gestão mostra "Sem PIN" e oferece definir.
   */
  readonly hasCredential: boolean;
}

export interface TeamPositionItemView {
  readonly id: string;
  readonly name: string;
  readonly syncStatus: WorkforceSyncStatus;
}

export interface TeamGroupMemberView {
  readonly employeeId: string;
  readonly fullName: string;
  readonly positionName: string;
  readonly workPeriodLabel: string | null;
}

/** Jornada cadastrada na loja (dado editável — nunca hardcode de horário). */
export interface ShiftDefinitionItemView {
  readonly id: string;
  readonly name: string;
  readonly windowLabel: string;
  readonly syncStatus: ScheduleSyncStatus;
}

export interface TeamGroupView {
  readonly id: string;
  readonly name: string;
  readonly members: readonly TeamGroupMemberView[];
}

export interface TeamManagementView {
  /** Decisão pronta: a seção só existe para quem gere a equipe. */
  readonly enabled: boolean;
  readonly canRegisterEmployee: boolean;
  /** Comprimento do PIN vindo do Configuration Engine (nunca hardcoded). */
  readonly pinLength: number;
  /** Posição é dado configurável (ADR-019) — decisão própria. */
  readonly canCreatePosition: boolean;
  readonly tab: TeamManagementTab;
  readonly members: readonly TeamMemberItemView[];
  /** null = todos; id da equipe para filtrar a lista de colaboradores. */
  readonly memberFilter: string | null;
  readonly teams: readonly TeamRecord[];
  readonly positionItems: readonly TeamPositionItemView[];
  /** Opções do formulário de colaborador — SEMPRE o cadastro real da loja. */
  readonly positionOptions: readonly { readonly id: string; readonly name: string }[];
  readonly groups: readonly TeamGroupView[];
  readonly registration: TeamFormState;
  readonly positionCreation: TeamFormState;
  /** Drawer "Definir/alterar PIN" — alvo atual e estado do formulário. */
  readonly pinTarget: { readonly employeeId: string; readonly fullName: string } | null;
  readonly pinUpdate: TeamFormState;
  /** Data operacional corrente YYYY-MM-DD (default do formulário). */
  readonly today: string;
  // ===== Escala Operacional =====
  /** Jornada é dado configurável (ADR-019) — mesma decisão de posições. */
  readonly canCreateShiftDefinition: boolean;
  readonly definitionItems: readonly ShiftDefinitionItemView[];
  /** Opções do formulário de colaborador (id + rótulo da janela). */
  readonly definitionOptions: readonly { readonly id: string; readonly label: string }[];
  /** Presença PLANEJADA resolvida: hoje + próximos dias (fonte oficial). */
  readonly scheduleDays: readonly PlannedScheduleDay[];
  readonly shiftDefinitionCreation: TeamFormState;
}

export interface RegisterEmployeeFormInput {
  readonly fullName: string;
  /** Data civil YYYY-MM-DD (fuso da loja). */
  readonly startDate: string;
  readonly positionId: string;
  readonly teamId: string;
  /** Jornada do vínculo ('' = sem jornada declarada). */
  readonly shiftDefinitionId: string;
  /**
   * Identidade operacional (ADR-021): PIN + confirmação. Opcional — o
   * colaborador EXISTE sem credencial (cadastro administrativo); a credencial
   * é conceito separado. Vazio nos dois campos ⇒ cadastra sem PIN.
   */
  readonly pin: string;
  readonly pinConfirmation: string;
}

export interface CreateShiftDefinitionFormInput {
  readonly name: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface TeamManagementActions {
  readonly setTab: (tab: TeamManagementTab) => void;
  readonly setMemberFilter: (teamId: string | null) => void;
  readonly openRegister: () => void;
  readonly closeRegister: () => void;
  readonly register: (input: RegisterEmployeeFormInput) => Promise<void>;
  readonly openCreatePosition: () => void;
  readonly closeCreatePosition: () => void;
  readonly createPosition: (name: string) => Promise<void>;
  readonly openCreateShiftDefinition: () => void;
  readonly closeCreateShiftDefinition: () => void;
  readonly createShiftDefinition: (input: CreateShiftDefinitionFormInput) => Promise<void>;
  /** Definir/alterar o PIN de um colaborador existente (credencial separada). */
  readonly openSetPin: (employeeId: string) => void;
  readonly closeSetPin: () => void;
  readonly updatePin: (pin: string, confirmation: string) => Promise<void>;
  readonly reload: () => Promise<void>;
}

function startDateLabelFor(civilDate: string): string {
  // YYYY-MM-DD → dd/mm/aaaa sem passar por Date (nenhum fuso envolvido)
  return `${civilDate.slice(8, 10)}/${civilDate.slice(5, 7)}/${civilDate.slice(0, 4)}`;
}

/** Sequência de datas civis a partir de `start` — apresentação, não escala. */
function civilDateRange(start: string, count: number): readonly string[] {
  const base = Date.UTC(
    Number(start.slice(0, 4)),
    Number(start.slice(5, 7)) - 1,
    Number(start.slice(8, 10)),
  );
  return Array.from({ length: count }, (_, index) =>
    new Date(base + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}

/** Dias de escala exibidos: hoje + próximos 6 (sem calendário complexo). */
const SCHEDULE_DAYS_SHOWN = 7;

export function useTeamManagement(
  container: AppContainer,
  options: { readonly onWorkforceChanged?: () => void } = {},
): [TeamManagementView, TeamManagementActions] {
  const identity = useOperatorSession();
  const [tab, setTab] = useState<TeamManagementTab>('members');
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [members, setMembers] = useState<readonly TeamMemberItemView[]>([]);
  const [teams, setTeams] = useState<readonly TeamRecord[]>([]);
  const [positionItems, setPositionItems] = useState<readonly TeamPositionItemView[]>([]);
  const [groups, setGroups] = useState<readonly TeamGroupView[]>([]);
  const [registration, setRegistration] = useState<TeamFormState>({ status: 'idle' });
  const [positionCreation, setPositionCreation] = useState<TeamFormState>({ status: 'idle' });
  const [pinTarget, setPinTarget] = useState<{
    readonly employeeId: string;
    readonly fullName: string;
  } | null>(null);
  const [pinUpdate, setPinUpdate] = useState<TeamFormState>({ status: 'idle' });
  const updatingPinRef = useRef(false);
  const [shiftDefinitionCreation, setShiftDefinitionCreation] = useState<TeamFormState>({
    status: 'idle',
  });
  const [definitionItems, setDefinitionItems] = useState<readonly ShiftDefinitionItemView[]>([]);
  const [scheduleDays, setScheduleDays] = useState<readonly PlannedScheduleDay[]>([]);
  const [pinLength, setPinLength] = useState(6);
  const registeringRef = useRef(false);
  const creatingRef = useRef(false);
  const creatingDefinitionRef = useRef(false);
  // callback estável para não reamarrar os efeitos ao render do pai
  const changedRef = useRef(options.onWorkforceChanged);
  changedRef.current = options.onWorkforceChanged;

  const permissions = identity.operator?.permissions ?? [];
  const enabled = permissions.includes(CAPABILITY_WORKFORCE_WRITE);
  const canCreatePosition = permissions.includes(CAPABILITY_CONFIG_WRITE);

  const authorization = identity.authorization;

  const load = useCallback(async () => {
    const storeId = FIXTURE_STORE.id;
    const [employees, assignments, teamRecords, positionRecords, definitionRecords, policy] =
      await Promise.all([
        container.workforce.employees(storeId),
        container.workforce.assignments(storeId),
        container.workforce.teams(storeId),
        container.workforce.positions(storeId),
        container.scheduleData.definitions(storeId),
        container.pinPolicy.resolve(storeId),
      ]);
    setPinLength(policy.length);
    const teamById = new Map(teamRecords.map((team) => [team.id, team]));
    const positionById = new Map(positionRecords.map((position) => [position.id, position]));
    const definitionById = new Map(
      definitionRecords.map((definition) => [definition.id, definition]),
    );
    // vínculo mais recente por colaborador (cadastro V1: um vínculo por pessoa)
    const assignmentByEmployee = new Map<string, (typeof assignments)[number]>();
    for (const assignment of assignments) {
      const current = assignmentByEmployee.get(assignment.employeeId);
      if (current === undefined || assignment.validFrom > current.validFrom) {
        assignmentByEmployee.set(assignment.employeeId, assignment);
      }
    }

    const activeEmployees = employees.filter((employee) => employee.active);
    // credencial por colaborador (ADR-021): a gestão mostra quem NÃO tem PIN
    // — sem isso, a pessoa cai em identificação impossível no quadro
    const credentialEntries = await Promise.all(
      activeEmployees.map(
        async (employee) =>
          [employee.id, await container.credentials.get(storeId, employee.id)] as const,
      ),
    );
    const credentialByEmployee = new Map(credentialEntries);

    const memberViews = activeEmployees
      .map((employee) => {
        const assignment = assignmentByEmployee.get(employee.id);
        const team = assignment?.teamId != null ? teamById.get(assignment.teamId) : undefined;
        const position =
          assignment !== undefined ? positionById.get(assignment.operationalPositionId) : undefined;
        const definition =
          assignment?.shiftDefinitionId != null
            ? definitionById.get(assignment.shiftDefinitionId)
            : undefined;
        return {
          employeeId: employee.id,
          fullName: employee.fullName,
          positionName: position?.name ?? 'Sem posição',
          teamId: team?.id ?? null,
          teamName: team?.name ?? 'Sem equipe',
          workPeriodLabel:
            definition !== undefined ? `${definition.startTime}–${definition.endTime}` : null,
          startDateLabel: assignment !== undefined ? startDateLabelFor(assignment.validFrom) : '—',
          syncStatus: employee.syncStatus,
          hasCredential: (credentialByEmployee.get(employee.id) ?? null) !== null,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));

    setMembers(memberViews);
    setTeams([...teamRecords].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    setPositionItems(
      [...positionRecords]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map((position) => ({
          id: position.id,
          name: position.name,
          syncStatus: position.syncStatus,
        })),
    );
    setGroups(
      [...teamRecords]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map((team) => ({
          id: team.id,
          name: team.name,
          members: memberViews
            .filter((member) => member.teamId === team.id)
            .map((member) => ({
              employeeId: member.employeeId,
              fullName: member.fullName,
              positionName: member.positionName,
              workPeriodLabel: member.workPeriodLabel,
            })),
        })),
    );
    setDefinitionItems(
      [...definitionRecords]
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((definition) => ({
          id: definition.id,
          name: definition.name,
          windowLabel: `${definition.startTime}–${definition.endTime}`,
          syncStatus: definition.syncStatus,
        })),
    );

    // presença planejada: hoje + próximos dias pela FONTE OFICIAL (o resolver
    // vive no domínio — este controller apenas pergunta)
    if (authorization !== null) {
      const today = operationalDateFor(container.clock(), FIXTURE_STORE.timeZone);
      const planned = await container.loadPlannedSchedule.execute({
        authorization,
        storeAnchorDate: FIXTURE_STORE.shiftAnchorDate,
        operationalDates: civilDateRange(today, SCHEDULE_DAYS_SHOWN),
      });
      setScheduleDays(planned.kind === 'loaded' ? planned.days : []);
    }
  }, [authorization, container]);

  // Boot: o catálogo baseline chega pela reconciliação (mesmo caminho das
  // outras telas); só carrega para quem tem a capability.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      await container.reconcileFromQueue();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [container, enabled, load]);

  const register = useCallback(
    async (input: RegisterEmployeeFormInput) => {
      if (authorization === null) return;
      // guarda de submissão concorrente (duplo clique / StrictMode)
      if (registeringRef.current) return;
      // credencial é OPCIONAL, mas se informada precisa confirmar e respeitar o
      // comprimento do Baseline (nunca hardcoded). Validado ANTES de cadastrar.
      const wantsPin = input.pin !== '' || input.pinConfirmation !== '';
      if (wantsPin) {
        if (input.pin.length !== pinLength) {
          setRegistration({ status: 'error', message: `O PIN deve ter ${pinLength} dígitos.` });
          return;
        }
        if (input.pin !== input.pinConfirmation) {
          setRegistration({ status: 'error', message: 'A confirmação do PIN não confere.' });
          return;
        }
      }
      registeringRef.current = true;
      setRegistration({ status: 'submitting' });
      try {
        const readiness = await container.connectivity.assess();
        const result = await container.registerEmployee.execute({
          authorization,
          deviceId: container.deviceId,
          storeTimeZone: FIXTURE_STORE.timeZone,
          fullName: input.fullName,
          startDate: input.startDate,
          positionId: input.positionId,
          teamId: input.teamId,
          shiftDefinitionId: input.shiftDefinitionId === '' ? null : input.shiftDefinitionId,
          createdOffline: !readiness.readyToSync,
        });
        if (result.kind === 'failed') {
          switch (result.code) {
            case 'NAME_REQUIRED':
              setRegistration({ status: 'error', message: 'Informe o nome do colaborador.' });
              return;
            case 'INVALID_DATE':
              setRegistration({ status: 'error', message: 'Informe uma data de início válida.' });
              return;
            case 'UNKNOWN_POSITION':
              setRegistration({ status: 'error', message: 'Escolha a função/posição.' });
              return;
            case 'UNKNOWN_TEAM':
              setRegistration({ status: 'error', message: 'Escolha a equipe.' });
              return;
            case 'UNKNOWN_DEFINITION':
              setRegistration({ status: 'error', message: 'Escolha o horário de trabalho.' });
              return;
            case 'PERMISSION_DENIED':
              setRegistration({
                status: 'error',
                message: 'Seu perfil não permite cadastrar colaboradores.',
              });
              return;
            case 'SNAPSHOT_EXPIRED':
              setRegistration({
                status: 'error',
                message: 'Identificação expirada. Identifique-se novamente.',
              });
              return;
            default:
              setRegistration({
                status: 'error',
                message: 'Não foi possível cadastrar agora. Tente novamente.',
              });
              return;
          }
        }
        // credencial de PIN: conceito SEPARADO do Employee (ADR-021). Criada
        // APÓS o cadastro, com o employeeId REAL; offline ⇒ nasce
        // LOCAL_PENDING_PROVISIONING (só neste aparelho até sincronizar). O PIN
        // é derivado em verifier e descartado — nunca entra no EmployeeRecord.
        if (wantsPin && result.kind === 'registered') {
          await container.credentials.upsert({
            storeId: result.employee.storeId,
            employeeId: result.employee.id,
            pin: input.pin,
            status: 'LOCAL_PENDING_PROVISIONING',
          });
        }
        // aparece imediatamente (persistido localmente); sincroniza depois
        if (readiness.readyToSync) await container.drainAndReflect();
        setRegistration({ status: 'idle' });
        await load();
        changedRef.current?.();
      } finally {
        registeringRef.current = false;
      }
    },
    [authorization, container, load, pinLength],
  );

  const openSetPin = useCallback(
    (employeeId: string) => {
      const member = members.find((candidate) => candidate.employeeId === employeeId);
      if (member === undefined) return;
      setPinUpdate({ status: 'open' });
      setPinTarget({ employeeId: member.employeeId, fullName: member.fullName });
    },
    [members],
  );

  const closeSetPin = useCallback(() => {
    if (updatingPinRef.current) return;
    setPinUpdate({ status: 'idle' });
    setPinTarget(null);
  }, []);

  /**
   * Define/redefine a credencial de PIN de um colaborador EXISTENTE
   * (ADR-021: credencial separada; upsert deriva o verifier e descarta o
   * PIN). Redefinir também: (a) reabre a janela offline (updatedAt vira a
   * âncora — sem backend não há confirmação online que a renove); (b) zera o
   * lockout DESTE aparelho (quem esqueceu o PIN acumulou falhas).
   */
  const updatePin = useCallback(
    async (pin: string, confirmation: string) => {
      const target = pinTarget;
      if (target === null || authorization === null) return;
      if (updatingPinRef.current) return;
      if (pin.length !== pinLength) {
        setPinUpdate({ status: 'error', message: `O PIN deve ter ${pinLength} dígitos.` });
        return;
      }
      if (pin !== confirmation) {
        setPinUpdate({ status: 'error', message: 'Os PINs digitados não conferem.' });
        return;
      }
      updatingPinRef.current = true;
      setPinUpdate({ status: 'submitting' });
      try {
        await container.credentials.upsert({
          storeId: FIXTURE_STORE.id,
          employeeId: target.employeeId,
          pin,
          status: 'LOCAL_PENDING_PROVISIONING',
        });
        await container.lockouts.reset(FIXTURE_STORE.id, target.employeeId, container.deviceId);
        setPinUpdate({ status: 'idle' });
        setPinTarget(null);
        await load();
      } catch {
        setPinUpdate({
          status: 'error',
          message: 'Não foi possível salvar o PIN agora. Tente novamente.',
        });
      } finally {
        updatingPinRef.current = false;
      }
    },
    [authorization, container, load, pinLength, pinTarget],
  );

  const createPosition = useCallback(
    async (name: string) => {
      if (authorization === null) return;
      if (creatingRef.current) return;
      creatingRef.current = true;
      setPositionCreation({ status: 'submitting' });
      try {
        const readiness = await container.connectivity.assess();
        const result = await container.createPosition.execute({
          authorization,
          deviceId: container.deviceId,
          name,
          createdOffline: !readiness.readyToSync,
        });
        if (result.kind === 'failed') {
          switch (result.code) {
            case 'NAME_REQUIRED':
              setPositionCreation({ status: 'error', message: 'Dê um nome para a posição.' });
              return;
            case 'PERMISSION_DENIED':
              setPositionCreation({
                status: 'error',
                message: 'Seu perfil não permite criar posições.',
              });
              return;
            case 'SNAPSHOT_EXPIRED':
              setPositionCreation({
                status: 'error',
                message: 'Identificação expirada. Identifique-se novamente.',
              });
              return;
            default:
              setPositionCreation({
                status: 'error',
                message: 'Não foi possível criar a posição agora. Tente novamente.',
              });
              return;
          }
        }
        // 'already-created' converge para a posição existente — não é erro
        if (readiness.readyToSync) await container.drainAndReflect();
        setPositionCreation({ status: 'idle' });
        await load();
        changedRef.current?.();
      } finally {
        creatingRef.current = false;
      }
    },
    [authorization, container, load],
  );

  const createShiftDefinition = useCallback(
    async (input: CreateShiftDefinitionFormInput) => {
      if (authorization === null) return;
      if (creatingDefinitionRef.current) return;
      creatingDefinitionRef.current = true;
      setShiftDefinitionCreation({ status: 'submitting' });
      try {
        const readiness = await container.connectivity.assess();
        const result = await container.createShiftDefinition.execute({
          authorization,
          deviceId: container.deviceId,
          name: input.name,
          startTime: input.startTime,
          endTime: input.endTime,
          createdOffline: !readiness.readyToSync,
        });
        if (result.kind === 'failed') {
          switch (result.code) {
            case 'INVALID_TIME':
              setShiftDefinitionCreation({
                status: 'error',
                message: 'Informe início e fim válidos (HH:MM), diferentes entre si.',
              });
              return;
            case 'PERMISSION_DENIED':
              setShiftDefinitionCreation({
                status: 'error',
                message: 'Seu perfil não permite criar horários de trabalho.',
              });
              return;
            case 'SNAPSHOT_EXPIRED':
              setShiftDefinitionCreation({
                status: 'error',
                message: 'Identificação expirada. Identifique-se novamente.',
              });
              return;
            default:
              setShiftDefinitionCreation({
                status: 'error',
                message: 'Não foi possível criar o horário agora. Tente novamente.',
              });
              return;
          }
        }
        // 'already-created' converge para a jornada existente — não é erro
        if (readiness.readyToSync) await container.drainAndReflect();
        setShiftDefinitionCreation({ status: 'idle' });
        await load();
        changedRef.current?.();
      } finally {
        creatingDefinitionRef.current = false;
      }
    },
    [authorization, container, load],
  );

  const openRegister = useCallback(() => setRegistration({ status: 'open' }), []);
  const closeRegister = useCallback(
    () =>
      setRegistration((current) =>
        current.status === 'submitting' ? current : { status: 'idle' },
      ),
    [],
  );
  const openCreatePosition = useCallback(() => setPositionCreation({ status: 'open' }), []);
  const closeCreatePosition = useCallback(
    () =>
      setPositionCreation((current) =>
        current.status === 'submitting' ? current : { status: 'idle' },
      ),
    [],
  );
  const openCreateShiftDefinition = useCallback(
    () => setShiftDefinitionCreation({ status: 'open' }),
    [],
  );
  const closeCreateShiftDefinition = useCallback(
    () =>
      setShiftDefinitionCreation((current) =>
        current.status === 'submitting' ? current : { status: 'idle' },
      ),
    [],
  );

  const view: TeamManagementView = {
    enabled,
    canRegisterEmployee: enabled,
    canCreatePosition,
    pinLength,
    tab,
    members: members.filter((member) => memberFilter === null || member.teamId === memberFilter),
    memberFilter,
    teams,
    positionItems,
    positionOptions: positionItems.map((position) => ({ id: position.id, name: position.name })),
    groups,
    registration,
    positionCreation,
    pinTarget,
    pinUpdate,
    today: operationalDateFor(container.clock(), FIXTURE_STORE.timeZone),
    canCreateShiftDefinition: canCreatePosition,
    definitionItems,
    definitionOptions: definitionItems.map((definition) => ({
      id: definition.id,
      label:
        definition.name === definition.windowLabel
          ? definition.windowLabel
          : `${definition.name} (${definition.windowLabel})`,
    })),
    scheduleDays,
    shiftDefinitionCreation,
  };

  return [
    view,
    {
      setTab,
      setMemberFilter,
      openRegister,
      closeRegister,
      register,
      openCreatePosition,
      closeCreatePosition,
      createPosition,
      openCreateShiftDefinition,
      closeCreateShiftDefinition,
      createShiftDefinition,
      openSetPin,
      closeSetPin,
      updatePin,
      reload: load,
    },
  ];
}
