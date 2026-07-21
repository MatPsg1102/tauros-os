// View model do fechamento de turno (7.2) — única fonte de cada estado.
// A UI não monta chave de idempotência, não toca fila/IndexedDB e não decide
// permissão: tudo passa pelo use case. Estados discriminados (uma fase),
// nunca combinação frágil de booleanos.

'use client';

import { useCallback, useRef, useState } from 'react';

import type { OperatorSessionRecord } from '@tauros/contracts';
import { CAPABILITY_SESSION_CLOSE } from '@tauros/contracts';

import type { AppContainer } from '../wiring/container.js';
import { FIXTURE_STORE } from '../wiring/fixtures.js';
import { useOperatorSession } from './operator-session-context.js';

export type ShiftClosingPhase =
  | 'idle'
  | 'confirming'
  | 'submitting'
  | 'closed'
  | 'denied'
  | 'config-error'
  | 'conflict'
  | 'error';

export interface ShiftClosingView {
  readonly phase: ShiftClosingPhase;
  readonly canCloseShift: boolean;
  readonly session: OperatorSessionRecord | null;
  readonly actionError: string | null;
}

export interface ShiftClosingActions {
  readonly requestClose: () => void;
  readonly cancelClose: () => void;
  readonly confirmClose: () => Promise<void>;
  readonly retrySync: () => Promise<void>;
}

export function useShiftClosing(
  container: AppContainer,
  session: OperatorSessionRecord | null,
  onSessionChanged: (record: OperatorSessionRecord | null) => void,
): [ShiftClosingView, ShiftClosingActions] {
  const identity = useOperatorSession();
  const [phase, setPhase] = useState<ShiftClosingPhase>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const canCloseShift = identity.operator?.permissions.includes(CAPABILITY_SESSION_CLOSE) ?? false;

  const requestClose = useCallback(() => {
    setActionError(null);
    setPhase('confirming');
  }, []);

  const cancelClose = useCallback(() => {
    // o diálogo também emite o fechamento APÓS confirmar: só volta ao início
    // quando ainda estávamos perguntando (não apaga o desfecho já alcançado).
    setPhase((current) => (current === 'confirming' ? 'idle' : current));
  }, []);

  const refresh = useCallback(async (): Promise<OperatorSessionRecord | null> => {
    if (session === null) return null;
    const current = await container.sessions.byId(session.id);
    onSessionChanged(current);
    return current;
  }, [container, onSessionChanged, session]);

  const confirmClose = useCallback(async () => {
    const authorization = identity.authorization;
    if (authorization === null || session === null) return;
    // guarda de submissão concorrente (duplo clique / StrictMode)
    if (submittingRef.current) return;
    submittingRef.current = true;
    setActionError(null);
    setPhase('submitting');
    try {
      const readiness = await container.connectivity.assess();
      const result = await container.closeSession.execute({
        authorization,
        sessionId: session.id,
        deviceId: container.deviceId,
        storeTimeZone: FIXTURE_STORE.timeZone,
        closedOffline: !readiness.readyToSync,
        endReason: 'LOGOUT',
      });
      if (result.kind === 'closed' || result.kind === 'already-closed') {
        onSessionChanged(result.record);
        setPhase('closed');
        if (readiness.readyToSync) {
          await container.drainAndReflect();
          const current = await refresh();
          if (current?.closeSyncStatus === 'conflict') setPhase('conflict');
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
        case 'SESSION_NOT_ACTIVE': {
          await refresh();
          setPhase('closed');
          return;
        }
        case 'SNAPSHOT_EXPIRED':
          setActionError('A autorização expirou. Identifique-se novamente para fechar o turno.');
          setPhase('error');
          return;
        default:
          setActionError('Não foi possível fechar o turno agora. Tente novamente.');
          setPhase('error');
          return;
      }
    } finally {
      submittingRef.current = false;
    }
  }, [container, identity.authorization, onSessionChanged, refresh, session]);

  const retrySync = useCallback(async () => {
    await container.drainAndReflect();
    const current = await refresh();
    if (current?.closeSyncStatus === 'conflict') setPhase('conflict');
  }, [container, refresh]);

  return [
    { phase, canCloseShift, session, actionError },
    { requestClose, cancelClose, confirmClose, retrySync },
  ];
}
