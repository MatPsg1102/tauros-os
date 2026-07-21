// Tabs (6.3.6 §8) — padrão ARIA completo: Tabs/TabList/Tab/TabPanel.
// Roving focus (setas/Home/End), ativação automática (default) ou manual
// (Enter/Space), controlled/uncontrolled, IDs estáveis (useId), painéis
// montados com hidden (SSR estável). Tabs de CONTEÚDO — se alteram URL,
// a coordenação é externa (não é menu nem link de navegação).

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cx } from '../../shared/class-names.js';

interface TabsContextValue {
  readonly value: string | undefined;
  readonly select: (value: string) => void;
  readonly activation: 'automatic' | 'manual';
  readonly orientation: 'horizontal' | 'vertical';
  readonly baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export class TabsContextMissingError extends Error {
  constructor(part: string) {
    super(`${part} deve ser usado dentro de <Tabs>.`);
    this.name = 'TabsContextMissingError';
  }
}

function useTabsContext(part: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (ctx === null) throw new TabsContextMissingError(part);
  return ctx;
}

export function tabId(baseId: string, value: string): string {
  return `${baseId}-tab-${value}`;
}
export function panelId(baseId: string, value: string): string {
  return `${baseId}-panel-${value}`;
}

export interface TabsProps {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly activation?: 'automatic' | 'manual';
  readonly orientation?: 'horizontal' | 'vertical';
  readonly className?: string;
  readonly children: ReactNode;
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  activation = 'automatic',
  orientation = 'horizontal',
  className,
  children,
}: TabsProps): ReactNode {
  const baseId = useId();
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const current = controlled ? value : internal;

  const select = useCallback(
    (next: string): void => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  const ctx = useMemo<TabsContextValue>(
    () => ({ value: current, select, activation, orientation, baseId }),
    [current, select, activation, orientation, baseId],
  );

  return (
    <div className={cx('t-tabs', className)} data-orientation={orientation}>
      <TabsContext.Provider value={ctx}>{children}</TabsContext.Provider>
    </div>
  );
}

export interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  /** Nome acessível da lista de abas. */
  readonly 'aria-label': string;
}

export function TabList({ className, children, onKeyDown, ...rest }: TabListProps): ReactNode {
  const { orientation } = useTabsContext('TabList');

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    );
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex(
      (tab) => tab === event.currentTarget.ownerDocument.activeElement,
    );
    const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    let target: HTMLButtonElement | undefined;
    if (event.key === nextKey) target = tabs[(currentIndex + 1) % tabs.length];
    else if (event.key === prevKey) target = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
    else if (event.key === 'Home') target = tabs[0];
    else if (event.key === 'End') target = tabs[tabs.length - 1];
    if (target !== undefined) {
      event.preventDefault();
      target.focus();
      if (target.dataset['activation'] === 'automatic') target.click();
    }
    onKeyDown?.(event);
  }

  return (
    <div
      {...rest}
      role="tablist"
      aria-orientation={orientation}
      className={cx('t-tablist', className)}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export interface TabProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'value'> {
  readonly value: string;
  readonly disabled?: boolean;
}

export function Tab({
  value,
  disabled = false,
  className,
  children,
  ...rest
}: TabProps): ReactNode {
  const { value: selected, select, activation, baseId } = useTabsContext('Tab');
  const isSelected = selected === value;
  return (
    <button
      {...rest}
      type="button"
      role="tab"
      id={tabId(baseId, value)}
      aria-selected={isSelected}
      aria-controls={panelId(baseId, value)}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      data-activation={activation}
      className={cx('t-tab', 't-focusable', className)}
      onClick={() => select(value)}
      onKeyDown={(event) => {
        if (activation === 'manual' && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          select(value);
        }
      }}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'value'> {
  readonly value: string;
}

export function TabPanel({ value, className, children, ...rest }: TabPanelProps): ReactNode {
  const { value: selected, baseId } = useTabsContext('TabPanel');
  const isSelected = selected === value;
  return (
    <div
      {...rest}
      role="tabpanel"
      id={panelId(baseId, value)}
      aria-labelledby={tabId(baseId, value)}
      hidden={!isSelected}
      tabIndex={0}
      className={cx('t-tabpanel', className)}
    >
      {children}
    </div>
  );
}
