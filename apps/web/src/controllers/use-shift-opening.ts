// View model da jornada de abertura de turno (7.1 §29) — única fonte de cada
// estado; a UI não toca fila/IndexedDB/permissões. Consome o container por
// contrato. StrictMode-safe: efeitos idempotentes, submissão com guarda.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { EffectiveAuthorization, OperatorSessionRecord } from '@tauros/contracts';
import {
  CAPABILITY_CONFIG_WRITE,
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

export type ShiftOpeningPhase =
  | 'bootstrapping'
  | 'identify'
  | 'ready'
  | 'submitting'
  | 'opened'
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
}

export interface ShiftOpeningActions {
  readonly identify: (employeeId: string, pin: string) => Promise<void>;
  readonly openShift: () => Promise<void>;
  readonly retrySync: () => Promise<void>;
  readonly reset: () => void;
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

export function useShiftOpening(container: AppContainer): [ShiftOpeningView, ShiftOpeningActions] {
  const identity = useOperatorSession();
  const [phase, setPhase] = useState<ShiftOpeningPhase>('bootstrapping');
  const [operator, setOperator] = useState<FixtureOperator | null>(null);
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
      if (cancelled) return;
      const shared = identityRef.current;
      if (shared.operator !== null && shared.authorization !== null) {
        const sharedEmployeeId = shared.operator.employeeId;
        const fixture = FIXTURE_OPERATORS.find(
          (candidate) => candidate.employeeId === sharedEmployeeId,
        );
        if (fixture !== undefined) {
          authRef.current = shared.authorization;
          container.setAuthorization(shared.authorization);
          setOperator(fixture);
          const active = await refreshSession(fixture.employeeId);
          if (cancelled) return;
          if (active !== null) {
            setPhase(active.syncStatus === 'conflict' ? 'conflict' : 'opened');
            return;
          }
          setPhase(fixture.permissions.includes(CAPABILITY_SESSION_OPEN) ? 'ready' : 'denied');
          return;
        }
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
      const identified = identifyOperator(employeeId, pin);
      if (identified === null) {
        // mensagem NÃO revela se o identificador existe (§8)
        setIdentifyError('Não foi possível confirmar a identificação. Confira e tente novamente.');
        return;
      }
      const readiness = await refreshConnectivity();
      const policy = await container.config.resolve('auth.pin.offlineValidityMs', FIXTURE_STORE.id);
      const authorization = toAuthorization(
        identified.operator,
        container.clock(),
        policy,
        readiness.readyToSync,
      );
      authRef.current = authorization;
      container.setAuthorization(authorization);
      setOperator(identified.operator);
      // publica no contexto de cliente: o quadro de tarefas usa a MESMA
      // identificação, sem reidentificar ao navegar entre rotas
      identity.identify(
        {
          employeeId: identified.operator.employeeId,
          profileId: identified.operator.profileId,
          membershipId: identified.operator.membershipId,
          name: identified.operator.name,
          permissions: identified.operator.permissions,
        },
        authorization,
      );

      const active = await refreshSession(identified.operator.employeeId);
      if (active !== null) {
        setPhase(active.syncStatus === 'conflict' ? 'conflict' : 'opened');
        return;
      }
      if (!identified.operator.permissions.includes(CAPABILITY_SESSION_OPEN)) {
        setPhase('denied');
        return;
      }
      setPhase('ready');
    },
    [container, identity, refreshConnectivity, refreshSession],
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
    operators: FIXTURE_OPERATORS.map(({ employeeId, name }) => ({ employeeId, name })),
    operationalDate: session?.operationalDate ?? null,
    connectivity,
    session,
    canOpenShift: operator?.permissions.includes(CAPABILITY_SESSION_OPEN) ?? false,
    canManageTeam: operator?.permissions.includes(CAPABILITY_CONFIG_WRITE) ?? false,
    identifyError,
    actionError,
  };

  return [view, { identify, openShift, retrySync, reset }];
}
