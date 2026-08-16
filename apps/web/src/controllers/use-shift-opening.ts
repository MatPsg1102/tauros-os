// View model da jornada de abertura de turno (7.1 §29) — única fonte de cada
// estado; a UI não toca fila/IndexedDB/permissões. Consome o container por
// contrato. StrictMode-safe: efeitos idempotentes, submissão com guarda.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { EffectiveAuthorization, OperatorSessionRecord } from '@tauros/contracts';
import { CAPABILITY_CONFIG_WRITE, CAPABILITY_SESSION_OPEN } from '@tauros/contracts';

import { operationalDateFor } from '@tauros/application';
import type { AppContainer } from '../wiring/container.js';
import { FIXTURE_STORE } from '../wiring/fixtures.js';
import { useOperatorSession, type IdentifiedOperatorView } from './operator-session-context.js';
import { identityRejectionMessage } from './identity-messages.js';

export type ShiftOpeningPhase =
  | 'bootstrapping'
  | 'identify'
  | 'ready'
  | 'submitting'
  | 'opened'
  /** Turno ainda ABERTO de outro dia operacional — fechar antes de reabrir. */
  | 'stale-session'
  | 'denied'
  | 'config-error'
  | 'conflict'
  | 'error';

export interface ConnectivityView {
  readonly deviceOnline: boolean;
  readonly readyToSync: boolean;
}

export interface ShiftOpeningView {
  readonly phase: ShiftOpeningPhase;
  readonly store: { readonly name: string; readonly timeZone: string };
  readonly operator: { readonly name: string; readonly employeeId: string } | null;
  readonly operators: readonly { readonly employeeId: string; readonly name: string }[];
  /** Comprimento do PIN vindo do Configuration Engine (nunca hardcoded). */
  readonly pinLength: number;
  readonly operationalDate: string | null;
  readonly connectivity: ConnectivityView;
  readonly session: OperatorSessionRecord | null;
  readonly canOpenShift: boolean;
  /**
   * Decisão PRONTA (ADR-018): o operador identificado coordena a equipe
   * (capability oficial que governa a Área do Encarregado). A UI usa a
   * decisão para expor a navegação — nunca interpreta strings de permissão.
   */
  readonly canManageTeam: boolean;
  readonly identifyError: string | null;
  readonly actionError: string | null;
  /** Data operacional do turno VELHO ainda aberto (fase 'stale-session'). */
  readonly staleSessionDate: string | null;
}

export interface ShiftOpeningActions {
  readonly identify: (employeeId: string, pin: string) => Promise<void>;
  readonly openShift: () => Promise<void>;
  /** Fecha explicitamente o turno de outro dia (nunca fechamento silencioso). */
  readonly closeStaleShift: () => Promise<void>;
  readonly retrySync: () => Promise<void>;
  readonly reset: () => void;
}

export function useShiftOpening(container: AppContainer): [ShiftOpeningView, ShiftOpeningActions] {
  const identity = useOperatorSession();
  const [phase, setPhase] = useState<ShiftOpeningPhase>('bootstrapping');
  const [operator, setOperator] = useState<IdentifiedOperatorView | null>(null);
  const [operators, setOperators] = useState<
    readonly { readonly employeeId: string; readonly name: string }[]
  >([]);
  const [pinLength, setPinLength] = useState(6);
  const [session, setSession] = useState<OperatorSessionRecord | null>(null);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityView>({
    deviceOnline: true,
    readyToSync: false,
  });
  const authRef = useRef<EffectiveAuthorization | null>(null);
  const submittingRef = useRef(false);

  const refreshConnectivity = useCallback(async () => {
    const readiness = await container.connectivity.assess();
    setConnectivity({ deviceOnline: readiness.deviceOnline, readyToSync: readiness.readyToSync });
    return readiness;
  }, [container]);

  const refreshSession = useCallback(
    async (employeeId: string): Promise<OperatorSessionRecord | null> => {
      const active = await container.sessions.findActive(FIXTURE_STORE.id, employeeId);
      setSession(active);
      return active;
    },
    [container],
  );

  // Identidade compartilhada sempre atual sem religar o efeito de boot: o
  // contexto muda quando identify()/clear() rodam, mas o boot só interessa
  // uma vez por montagem da rota.
  const identityRef = useRef(identity);
  identityRef.current = identity;

  // Boot: reconciliação de recuperação + restauração da identificação vinda
  // do CONTEXTO (7.2 — navegar entre rotas não exige novo PIN; /turno segue
  // a mesma regra do quadro e da Área do Encarregado) + sessão ativa (reload)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await container.reconcileFromQueue();
      await refreshConnectivity();
      const [roster, policy] = await Promise.all([
        container.identityRoster(FIXTURE_STORE.id),
        container.pinPolicy.resolve(FIXTURE_STORE.id),
      ]);
      if (cancelled) return;
      setOperators(roster);
      setPinLength(policy.length);
      const shared = identityRef.current;
      // restaura a identificação vinda do CONTEXTO — origem-agnóstica (real ou
      // DEV): navegar entre rotas nunca exige novo PIN.
      if (shared.operator !== null && shared.authorization !== null) {
        authRef.current = shared.authorization;
        container.setAuthorization(shared.authorization);
        setOperator(shared.operator);
        const active = await refreshSession(shared.operator.employeeId);
        if (cancelled) return;
        if (active !== null) {
          // virada do dia: turno de OUTRO dia operacional não é "aberto" —
          // exige fechamento explícito antes de operar hoje
          if (
            active.operationalDate !== operationalDateFor(container.clock(), FIXTURE_STORE.timeZone)
          ) {
            setPhase('stale-session');
            return;
          }
          setPhase(active.syncStatus === 'conflict' ? 'conflict' : 'opened');
          return;
        }
        setPhase(
          shared.operator.permissions.includes(CAPABILITY_SESSION_OPEN) ? 'ready' : 'denied',
        );
        return;
      }
      setPhase('identify');
    })();
    return () => {
      cancelled = true;
    };
  }, [container, refreshConnectivity, refreshSession]);

  const identify = useCallback(
    async (employeeId: string, pin: string) => {
      setIdentifyError(null);
      // employeeId identifica, PIN verifica (ADR-021); o port resolve a origem.
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
      const authorization = outcome.authorization;
      const name =
        operators.find((candidate) => candidate.employeeId === employeeId)?.name ?? employeeId;
      const view: IdentifiedOperatorView = {
        employeeId: authorization.operatorEmployeeId,
        profileId: authorization.operatorProfileId,
        membershipId: authorization.membershipId ?? null,
        name,
        permissions: authorization.permissions,
      };
      authRef.current = authorization;
      container.setAuthorization(authorization);
      setOperator(view);
      // publica no contexto de cliente: o quadro de tarefas usa a MESMA
      // identificação, sem reidentificar ao navegar entre rotas
      identity.identify(view, authorization);

      const active = await refreshSession(view.employeeId);
      if (active !== null) {
        if (
          active.operationalDate !== operationalDateFor(container.clock(), FIXTURE_STORE.timeZone)
        ) {
          setPhase('stale-session');
          return;
        }
        setPhase(active.syncStatus === 'conflict' ? 'conflict' : 'opened');
        return;
      }
      if (!authorization.permissions.includes(CAPABILITY_SESSION_OPEN)) {
        setPhase('denied');
        return;
      }
      setPhase('ready');
    },
    [container, identity, operators, refreshSession],
  );

  const openShift = useCallback(async () => {
    const authorization = authRef.current;
    const current = operator;
    if (authorization === null || current === null) return;
    // guarda de submissão concorrente (duplo clique / StrictMode)
    if (submittingRef.current) return;
    submittingRef.current = true;
    setActionError(null);
    setPhase('submitting');
    try {
      const readiness = await refreshConnectivity();
      const result = await container.openSession.execute({
        authorization,
        membershipId: current.membershipId,
        deviceId: container.deviceId,
        // membership de plataforma opcional (ADR-021): null até provisionamento
        storeTimeZone: FIXTURE_STORE.timeZone,
        openedOffline: !readiness.readyToSync,
      });
      if (result.kind === 'opened' || result.kind === 'already-open') {
        setSession(result.record);
        setPhase('opened');
        if (readiness.readyToSync) {
          await container.drainAndReflect();
          await refreshSession(current.employeeId);
        }
        return;
      }
      switch (result.code) {
        case 'PERMISSION_DENIED':
          setPhase('denied');
          return;
        case 'CONFIG_UNAVAILABLE':
          setPhase('config-error');
          return;
        case 'SESSION_ALREADY_ACTIVE': {
          await refreshSession(current.employeeId);
          setPhase('opened');
          return;
        }
        case 'SNAPSHOT_EXPIRED':
          setActionError('A autorização offline expirou. Identifique-se novamente.');
          setPhase('identify');
          setOperator(null);
          authRef.current = null;
          return;
        default:
          setActionError('Não foi possível abrir o turno agora. Tente novamente.');
          setPhase('error');
          return;
      }
    } finally {
      submittingRef.current = false;
    }
  }, [container, operator, refreshConnectivity, refreshSession]);

  const retrySync = useCallback(async () => {
    if (operator === null) return;
    await container.drainAndReflect();
    const active = await refreshSession(operator.employeeId);
    await refreshConnectivity();
    if (active?.syncStatus === 'conflict') setPhase('conflict');
  }, [container, operator, refreshConnectivity, refreshSession]);

  /**
   * Fecha o turno VENCIDO (de outro dia operacional) — ação EXPLÍCITA do
   * próprio operador identificado, com a autoria dele; nunca fechamento
   * silencioso na virada. Depois libera a abertura do turno de hoje.
   */
  const closeStaleShift = useCallback(async () => {
    const authorization = authRef.current;
    const current = operator;
    if (authorization === null || current === null || session === null) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setActionError(null);
    setPhase('submitting');
    try {
      const readiness = await refreshConnectivity();
      const result = await container.closeSession.execute({
        authorization,
        sessionId: session.id,
        deviceId: container.deviceId,
        storeTimeZone: FIXTURE_STORE.timeZone,
        closedOffline: !readiness.readyToSync,
        endReason: 'LOGOUT',
      });
      if (result.kind === 'closed' || result.kind === 'already-closed') {
        if (readiness.readyToSync) await container.drainAndReflect();
        setSession(null);
        setPhase(current.permissions.includes(CAPABILITY_SESSION_OPEN) ? 'ready' : 'denied');
        return;
      }
      if (result.code === 'SESSION_NOT_ACTIVE') {
        setSession(null);
        setPhase(current.permissions.includes(CAPABILITY_SESSION_OPEN) ? 'ready' : 'denied');
        return;
      }
      // condições PERMANENTES nunca viram "tente novamente"
      setActionError(
        result.code === 'PERMISSION_DENIED'
          ? 'Seu perfil não permite fechar turno. Peça ao encarregado para fechar o turno anterior.'
          : result.code === 'SNAPSHOT_EXPIRED'
            ? 'Sua identificação expirou. Identifique-se novamente para fechar o turno anterior.'
            : 'Não foi possível fechar o turno anterior agora. Tente novamente.',
      );
      setPhase('stale-session');
    } finally {
      submittingRef.current = false;
    }
  }, [container, operator, refreshConnectivity, session]);

  const reset = useCallback(() => {
    setOperator(null);
    setSession(null);
    setIdentifyError(null);
    setActionError(null);
    authRef.current = null;
    container.setAuthorization(null);
    identity.clear();
    setPhase('identify');
  }, [container, identity]);

  const view: ShiftOpeningView = {
    phase,
    store: { name: FIXTURE_STORE.name, timeZone: FIXTURE_STORE.timeZone },
    operator: operator === null ? null : { name: operator.name, employeeId: operator.employeeId },
    operators,
    pinLength,
    operationalDate: session?.operationalDate ?? null,
    connectivity,
    session,
    canOpenShift: operator?.permissions.includes(CAPABILITY_SESSION_OPEN) ?? false,
    canManageTeam: operator?.permissions.includes(CAPABILITY_CONFIG_WRITE) ?? false,
    identifyError,
    actionError,
    staleSessionDate: phase === 'stale-session' ? (session?.operationalDate ?? null) : null,
  };

  return [view, { identify, openShift, closeStaleShift, retrySync, reset }];
}
