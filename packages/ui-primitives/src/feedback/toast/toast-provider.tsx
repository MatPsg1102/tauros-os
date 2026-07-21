// ToastProvider + useToast (6.3.5 §9) — arquitetura própria de fila.
// Separação: evento solicitado (toast()) → estado da fila (reducer no
// provider) → renderização (viewport em Portal) → temporização (timers por
// toast com pausa/retomada) → anúncio acessível (role status/alert por item,
// viewport como region estável que NUNCA recebe foco automático).
// Deduplicação apenas explícita (mesmo `id` ⇒ atualização). SSR: o provider
// renderiza children no servidor; o viewport só existe no cliente.

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cx } from '../../shared/class-names.js';
import { IconButton } from '../../primitives/icon-button/icon-button.js';
import { Portal } from '../overlay/portal.js';
import { TOAST_PARAMETERS } from './toast-parameters.js';

export type ToastPriority = 'status' | 'urgent';

export interface ToastOptions {
  /** ID explícito: repetir o mesmo id ATUALIZA o toast (deduplicação opt-in). */
  readonly id?: string;
  readonly title: string;
  readonly description?: string;
  readonly priority?: ToastPriority;
  /** Duração de leitura em ms; `null` ⇒ persistente (fechamento manual). */
  readonly duration?: number | null;
  /** Ação opcional: rótulo + callback (sem regra de negócio interna). */
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export interface ToastRecord extends Required<Pick<ToastOptions, 'id' | 'title'>> {
  readonly description: string | undefined;
  readonly priority: ToastPriority;
  readonly duration: number | null;
  readonly actionLabel: string | undefined;
  readonly onAction: (() => void) | undefined;
}

export interface ToastApi {
  readonly toast: (options: ToastOptions) => string;
  readonly dismiss: (id: string) => void;
  readonly update: (id: string, patch: Partial<Omit<ToastOptions, 'id'>>) => void;
  readonly clear: () => void;
}

export class ToastProviderMissingError extends Error {
  constructor() {
    super(
      'useToast exige um <ToastProvider> ancestral. ' +
        'Envolva a aplicação (ou a região) com ToastProvider antes de usar o hook.',
    );
    this.name = 'ToastProviderMissingError';
  }
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) throw new ToastProviderMissingError();
  return api;
}

interface TimerState {
  timeout: ReturnType<typeof setTimeout>;
  startedAt: number;
  remaining: number;
}

export interface ToastProviderProps {
  readonly children: ReactNode;
  readonly maxVisible?: number;
  /** Rótulo da região de notificações (default oficial pt-BR). */
  readonly regionLabel?: string;
  readonly dismissLabel?: string;
}

export function ToastProvider({
  children,
  maxVisible = TOAST_PARAMETERS.maxVisible,
  regionLabel = 'Notificações',
  dismissLabel = 'Fechar notificação',
}: ToastProviderProps): ReactNode {
  const [queue, setQueue] = useState<readonly ToastRecord[]>([]);
  const timersRef = useRef<Map<string, TimerState>>(new Map());
  const counterRef = useRef(0);

  const stopTimer = useCallback((id: string): void => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer.timeout);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string): void => {
      stopTimer(id);
      setQueue((prev) => prev.filter((t) => t.id !== id));
    },
    [stopTimer],
  );

  const startTimer = useCallback(
    (id: string, duration: number): void => {
      stopTimer(id);
      timersRef.current.set(id, {
        timeout: setTimeout(() => dismiss(id), duration),
        startedAt: Date.now(),
        remaining: duration,
      });
    },
    [dismiss, stopTimer],
  );

  const pauseTimer = useCallback((id: string): void => {
    const timer = timersRef.current.get(id);
    if (timer === undefined) return;
    clearTimeout(timer.timeout);
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
  }, []);

  const resumeTimer = useCallback(
    (id: string): void => {
      const timer = timersRef.current.get(id);
      if (timer === undefined) return;
      timer.startedAt = Date.now();
      timer.timeout = setTimeout(() => dismiss(id), timer.remaining);
    },
    [dismiss],
  );

  const toast = useCallback((options: ToastOptions): string => {
    counterRef.current += 1;
    const id = options.id ?? `toast-${String(counterRef.current)}`;
    const priority = options.priority ?? 'status';
    const duration =
      options.duration !== undefined
        ? options.duration
        : priority === 'urgent'
          ? TOAST_PARAMETERS.urgentReadingDurationMs
          : TOAST_PARAMETERS.readingDurationMs;
    const record: ToastRecord = {
      id,
      title: options.title,
      description: options.description,
      priority,
      duration,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    };
    setQueue((prev) => {
      const existing = prev.findIndex((t) => t.id === id);
      if (existing !== -1) {
        // deduplicação explícita: mesmo id substitui mantendo a posição
        const next = [...prev];
        next[existing] = record;
        return next;
      }
      return [...prev, record];
    });
    return id;
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<Omit<ToastOptions, 'id'>>): void => {
      setQueue((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                description: patch.description !== undefined ? patch.description : t.description,
                priority: patch.priority ?? t.priority,
                duration: patch.duration !== undefined ? patch.duration : t.duration,
                actionLabel: patch.actionLabel !== undefined ? patch.actionLabel : t.actionLabel,
                onAction: patch.onAction !== undefined ? patch.onAction : t.onAction,
              }
            : t,
        ),
      );
      // duração alterada: para o timer atual; o efeito de visibilidade
      // reinicia com a nova duração se o toast estiver visível
      if (patch.duration !== undefined) stopTimer(id);
    },
    [stopTimer],
  );

  const clear = useCallback((): void => {
    for (const id of Array.from(timersRef.current.keys())) stopTimer(id);
    setQueue([]);
  }, [stopTimer]);

  // cleanup integral no unmount do provider (nenhum timer global sobrevive)
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer.timeout);
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ toast, dismiss, update, clear }),
    [toast, dismiss, update, clear],
  );

  const visible = queue.slice(0, maxVisible);

  // temporização começa quando o toast fica VISÍVEL (fila não expira oculta)
  useEffect(() => {
    for (const item of visible) {
      if (item.duration !== null && !timersRef.current.has(item.id)) {
        startTimer(item.id, item.duration);
      }
    }
  }, [visible, startTimer]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Portal>
        <section className="t-toast-region" aria-label={regionLabel}>
          <ol className="t-toast-list">
            {visible.map((item) => (
              <li
                key={item.id}
                className={cx('t-toast')}
                role={item.priority === 'urgent' ? 'alert' : 'status'}
                data-priority={item.priority}
                onMouseEnter={() => pauseTimer(item.id)}
                onMouseLeave={() => resumeTimer(item.id)}
                onFocus={() => pauseTimer(item.id)}
                onBlur={() => resumeTimer(item.id)}
              >
                <div className="t-toast-body">
                  <p className="t-toast-title">{item.title}</p>
                  {item.description !== undefined && (
                    <p className="t-toast-desc">{item.description}</p>
                  )}
                </div>
                {item.actionLabel !== undefined && (
                  <button
                    type="button"
                    className="t-toast-action t-focusable"
                    onClick={() => {
                      item.onAction?.();
                      dismiss(item.id);
                    }}
                  >
                    {item.actionLabel}
                  </button>
                )}
                <IconButton aria-label={dismissLabel} onClick={() => dismiss(item.id)}>
                  <span aria-hidden="true">&times;</span>
                </IconButton>
              </li>
            ))}
          </ol>
        </section>
      </Portal>
    </ToastContext.Provider>
  );
}
