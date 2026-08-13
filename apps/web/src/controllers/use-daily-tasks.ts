// View model do quadro de tarefas do dia (7.2). A UI recebe itens já
// traduzidos para a linguagem operacional; nenhuma regra de domínio, chave de
// idempotência ou acesso a repositório acontece na camada visual.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { storeDayStartFor } from '@tauros/application';
import type { DailyTaskRecord, OperatorSessionRecord, TaskSyncStatus } from '@tauros/contracts';

import type { AppContainer } from '../wiring/container.js';
import { FIXTURE_STORE } from '../wiring/fixtures.js';
import { useOperatorSession } from './operator-session-context.js';

export type DailyTasksPhase =
  'loading' | 'ready' | 'no-session' | 'unavailable' | 'error' | 'expired';

/** Estado apresentável de uma tarefa — já resolvido, sem booleanos soltos. */
export type DailyTaskItemState = 'pending' | 'overdue' | 'done' | 'skipped';

export interface DailyTaskItemView {
  readonly id: string;
  readonly title: string;
  readonly state: DailyTaskItemState;
  readonly dueAt: string;
  readonly requiresPhoto: boolean;
  readonly expectedRange: { readonly min: number | null; readonly max: number | null } | null;
  readonly syncStatus: TaskSyncStatus | null;
}

export interface DailyTasksCounts {
  readonly pending: number;
  readonly overdue: number;
  readonly done: number;
  readonly skipped: number;
}

export interface DailyTasksView {
  readonly phase: DailyTasksPhase;
  readonly tasks: readonly DailyTaskItemView[];
  readonly counts: DailyTasksCounts;
  readonly operationalDate: string | null;
  readonly operatorName: string | null;
  readonly deviceOnline: boolean;
  readonly readyToSync: boolean;
  readonly pendingSyncCount: number;
  readonly hasConflict: boolean;
  readonly actionError: string | null;
  readonly busyTaskId: string | null;
}

export interface CompleteTaskInput {
  readonly numericValue: number | null;
  readonly hasEvidence: boolean;
}

export interface DailyTasksActions {
  readonly reload: () => Promise<void>;
  readonly complete: (taskId: string, input: CompleteTaskInput) => Promise<void>;
  readonly skip: (taskId: string) => Promise<void>;
  readonly retrySync: () => Promise<void>;
}

function toItem(record: DailyTaskRecord): DailyTaskItemView {
  const state: DailyTaskItemState =
    record.status === 'DONE'
      ? 'done'
      : record.status === 'SKIPPED'
        ? 'skipped'
        : record.status === 'OVERDUE'
          ? 'overdue'
          : 'pending';
  const hasRange = record.expectedMinSnapshot !== null || record.expectedMaxSnapshot !== null;
  return {
    id: record.id,
    title: record.template.title,
    state,
    dueAt: record.dueAt,
    requiresPhoto: record.template.requiresPhoto,
    expectedRange: hasRange
      ? { min: record.expectedMinSnapshot, max: record.expectedMaxSnapshot }
      : null,
    syncStatus: record.syncStatus,
  };
}

function countsOf(tasks: readonly DailyTaskItemView[]): DailyTasksCounts {
  return {
    pending: tasks.filter((task) => task.state === 'pending').length,
    overdue: tasks.filter((task) => task.state === 'overdue').length,
    done: tasks.filter((task) => task.state === 'done').length,
    skipped: tasks.filter((task) => task.state === 'skipped').length,
  };
}

export function useDailyTasks(
  container: AppContainer,
  session: OperatorSessionRecord | null,
): [DailyTasksView, DailyTasksActions] {
  const identity = useOperatorSession();
  const [phase, setPhase] = useState<DailyTasksPhase>('loading');
  const [tasks, setTasks] = useState<readonly DailyTaskItemView[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [connectivity, setConnectivity] = useState({ deviceOnline: true, readyToSync: false });
  const busyRef = useRef(false);

  const authorization = identity.authorization;
  const activeSession = session !== null && session.status === 'ACTIVE' ? session : null;

  const load = useCallback(async () => {
    if (authorization === null || activeSession === null) {
      setPhase('no-session');
      setTasks([]);
      return;
    }
    const readiness = await container.connectivity.assess();
    setConnectivity({
      deviceOnline: readiness.deviceOnline,
      readyToSync: readiness.readyToSync,
    });
    const result = await container.loadDailyTasks.execute({
      authorization,
      workDate: activeSession.operationalDate,
      // vencimento conta do início do dia operacional da LOJA (base única
      // com o quadro do encarregado — dueOffsetMinutes = horário do dia)
      operationalDayStart: storeDayStartFor(container.clock(), FIXTURE_STORE.timeZone),
      configVersionRef: activeSession.configVersionRef,
    });
    if (result.kind === 'failed') {
      if (result.code === 'SNAPSHOT_EXPIRED' || result.code === 'SNAPSHOT_VERSION_INCOMPATIBLE') {
        setPhase('expired');
        return;
      }
      if (result.code === 'CONFIG_UNAVAILABLE') {
        setPhase('unavailable');
        return;
      }
      setActionError('Não foi possível carregar as tarefas de hoje.');
      setPhase('error');
      return;
    }
    setTasks(result.tasks.map(toItem));
    setPhase('ready');
  }, [activeSession, authorization, container]);

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

  const runOutcome = useCallback(
    async (taskId: string, kind: 'complete' | 'skip', input: CompleteTaskInput) => {
      if (authorization === null || activeSession === null) return;
      if (busyRef.current) return;
      busyRef.current = true;
      setBusyTaskId(taskId);
      setActionError(null);
      try {
        const readiness = await container.connectivity.assess();
        const result = await container.recordTaskOutcome.execute({
          authorization,
          dailyTaskId: taskId,
          operatorSessionId: activeSession.id,
          deviceId: container.deviceId,
          kind,
          numericValue: input.numericValue,
          notes: null,
          hasEvidence: input.hasEvidence,
          performedOffline: !readiness.readyToSync,
        });
        if (result.kind === 'failed') {
          switch (result.code) {
            case 'EVIDENCE_REQUIRED':
              setActionError('Esta tarefa exige o registro de uma foto para ser concluída.');
              break;
            case 'VALUE_REQUIRED':
              setActionError('Informe a medição registrada para concluir esta tarefa.');
              break;
            case 'TASK_ALREADY_RESOLVED':
              setActionError('Esta tarefa já foi resolvida. Nada foi perdido.');
              break;
            case 'SNAPSHOT_EXPIRED':
              setPhase('expired');
              break;
            default:
              setActionError('Não foi possível registrar agora. Tente novamente.');
          }
          await load();
          return;
        }
        if (readiness.readyToSync) await container.drainAndReflect();
        await load();
      } finally {
        busyRef.current = false;
        setBusyTaskId(null);
      }
    },
    [activeSession, authorization, container, load],
  );

  const complete = useCallback(
    (taskId: string, input: CompleteTaskInput) => runOutcome(taskId, 'complete', input),
    [runOutcome],
  );
  const skip = useCallback(
    (taskId: string) => runOutcome(taskId, 'skip', { numericValue: null, hasEvidence: false }),
    [runOutcome],
  );
  const retrySync = useCallback(async () => {
    await container.drainAndReflect();
    await load();
  }, [container, load]);

  const view: DailyTasksView = {
    phase,
    tasks,
    counts: countsOf(tasks),
    operationalDate: activeSession?.operationalDate ?? null,
    operatorName: identity.operator?.name ?? null,
    deviceOnline: connectivity.deviceOnline,
    readyToSync: connectivity.readyToSync,
    pendingSyncCount: tasks.filter((task) => task.syncStatus === 'queued').length,
    hasConflict: tasks.some((task) => task.syncStatus === 'conflict'),
    actionError,
    busyTaskId,
  };

  return [view, { reload: load, complete, skip, retrySync }];
}
