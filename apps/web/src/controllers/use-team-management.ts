// View model da Gestão de Equipe (seção "Equipe" da Área do Encarregado) —
// única fonte de cada estado; a UI não toca fila/IndexedDB/permissões e não
// monta chave de idempotência: tudo passa pelos use cases. Decisões de
// permissão PRONTAS (ADR-018): workforce.write governa colaboradores;
// config.write governa posições (dado configurável, ADR-019). Estados
// discriminados por formulário, nunca combinações frágeis de booleanos.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { operationalDateFor } from '@tauros/application';
import type { TeamRecord, WorkforceSyncStatus } from '@tauros/contracts';
import { CAPABILITY_CONFIG_WRITE, CAPABILITY_WORKFORCE_WRITE } from '@tauros/contracts';

import type { AppContainer } from '../wiring/container.js';
import { FIXTURE_STORE } from '../wiring/fixtures.js';
import { useOperatorSession } from './operator-session-context.js';

export type TeamManagementTab = 'members' | 'positions' | 'teams';

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
  /** dd/mm/aaaa (fuso da loja) — início do vínculo cadastrado. */
  readonly startDateLabel: string;
  readonly syncStatus: WorkforceSyncStatus;
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
  /** Data operacional corrente YYYY-MM-DD (default do formulário). */
  readonly today: string;
}

export interface RegisterEmployeeFormInput {
  readonly fullName: string;
  /** Data civil YYYY-MM-DD (fuso da loja). */
  readonly startDate: string;
  readonly positionId: string;
  readonly teamId: string;
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
  readonly reload: () => Promise<void>;
}

function startDateLabelFor(civilDate: string): string {
  // YYYY-MM-DD → dd/mm/aaaa sem passar por Date (nenhum fuso envolvido)
  return `${civilDate.slice(8, 10)}/${civilDate.slice(5, 7)}/${civilDate.slice(0, 4)}`;
}

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
  const registeringRef = useRef(false);
  const creatingRef = useRef(false);
  // callback estável para não reamarrar os efeitos ao render do pai
  const changedRef = useRef(options.onWorkforceChanged);
  changedRef.current = options.onWorkforceChanged;

  const permissions = identity.operator?.permissions ?? [];
  const enabled = permissions.includes(CAPABILITY_WORKFORCE_WRITE);
  const canCreatePosition = permissions.includes(CAPABILITY_CONFIG_WRITE);

  const load = useCallback(async () => {
    const storeId = FIXTURE_STORE.id;
    const [employees, assignments, teamRecords, positionRecords] = await Promise.all([
      container.workforce.employees(storeId),
      container.workforce.assignments(storeId),
      container.workforce.teams(storeId),
      container.workforce.positions(storeId),
    ]);
    const teamById = new Map(teamRecords.map((team) => [team.id, team]));
    const positionById = new Map(positionRecords.map((position) => [position.id, position]));
    // vínculo mais recente por colaborador (cadastro V1: um vínculo por pessoa)
    const assignmentByEmployee = new Map<string, (typeof assignments)[number]>();
    for (const assignment of assignments) {
      const current = assignmentByEmployee.get(assignment.employeeId);
      if (current === undefined || assignment.validFrom > current.validFrom) {
        assignmentByEmployee.set(assignment.employeeId, assignment);
      }
    }

    const memberViews = employees
      .filter((employee) => employee.active)
      .map((employee) => {
        const assignment = assignmentByEmployee.get(employee.id);
        const team = assignment?.teamId != null ? teamById.get(assignment.teamId) : undefined;
        const position =
          assignment !== undefined ? positionById.get(assignment.operationalPositionId) : undefined;
        return {
          employeeId: employee.id,
          fullName: employee.fullName,
          positionName: position?.name ?? 'Sem posição',
          teamId: team?.id ?? null,
          teamName: team?.name ?? 'Sem equipe',
          startDateLabel: assignment !== undefined ? startDateLabelFor(assignment.validFrom) : '—',
          syncStatus: employee.syncStatus,
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
            })),
        })),
    );
  }, [container]);

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
      const authorization = identity.authorization;
      if (authorization === null) return;
      // guarda de submissão concorrente (duplo clique / StrictMode)
      if (registeringRef.current) return;
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
        // aparece imediatamente (persistido localmente); sincroniza depois
        if (readiness.readyToSync) await container.drainAndReflect();
        setRegistration({ status: 'idle' });
        await load();
        changedRef.current?.();
      } finally {
        registeringRef.current = false;
      }
    },
    [container, identity.authorization, load],
  );

  const createPosition = useCallback(
    async (name: string) => {
      const authorization = identity.authorization;
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
    [container, identity.authorization, load],
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

  const view: TeamManagementView = {
    enabled,
    canRegisterEmployee: enabled,
    canCreatePosition,
    tab,
    members: members.filter((member) => memberFilter === null || member.teamId === memberFilter),
    memberFilter,
    teams,
    positionItems,
    positionOptions: positionItems.map((position) => ({ id: position.id, name: position.name })),
    groups,
    registration,
    positionCreation,
    today: operationalDateFor(container.clock(), FIXTURE_STORE.timeZone),
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
      reload: load,
    },
  ];
}
