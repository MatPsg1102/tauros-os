// NavigationGroup (6.3.6 §4) — agrupamento com semântica de lista preservada,
// expansão controlada/não controlada e aninhamento LIMITADO a 2 níveis
// (Progressive Disclosure do Design Language) — além disso, erro orientado.

'use client';

import { createContext, useContext, useId, useState, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';

const DepthContext = createContext(0);
const MAX_DEPTH = 2;

export class NavigationDepthExceededError extends Error {
  constructor() {
    super(
      `NavigationGroup: profundidade máxima de aninhamento é ${String(MAX_DEPTH)} ` +
        '(Design Language — Progressive Disclosure). Reestruture a navegação.',
    );
    this.name = 'NavigationDepthExceededError';
  }
}

export interface NavigationGroupProps {
  /** Título do grupo (nome acessível da sublista). */
  readonly title: string;
  /** Grupo expansível? Default: conteúdo persistente (sem colapso). */
  readonly collapsible?: boolean;
  readonly expanded?: boolean;
  readonly defaultExpanded?: boolean;
  readonly onExpandedChange?: (expanded: boolean) => void;
  readonly className?: string;
  readonly children: ReactNode;
}

export function NavigationGroup({
  title,
  collapsible = false,
  expanded,
  defaultExpanded = true,
  onExpandedChange,
  className,
  children,
}: NavigationGroupProps): ReactNode {
  const depth = useContext(DepthContext);
  if (depth >= MAX_DEPTH) throw new NavigationDepthExceededError();

  const baseId = useId();
  const listId = `${baseId}-list`;
  const controlled = expanded !== undefined;
  const [internal, setInternal] = useState(defaultExpanded);
  const isExpanded = !collapsible || (controlled ? expanded : internal);

  function toggle(): void {
    const next = !isExpanded;
    if (!controlled) setInternal(next);
    onExpandedChange?.(next);
  }

  return (
    <li className={cx('t-navgroup', className)} data-depth={depth}>
      {collapsible ? (
        <button
          type="button"
          className="t-navgroup-header t-focusable"
          aria-expanded={isExpanded}
          aria-controls={listId}
          onClick={toggle}
        >
          <span className="t-navgroup-title">{title}</span>
          <span className="t-navgroup-chevron" data-expanded={isExpanded} aria-hidden="true" />
        </button>
      ) : (
        <span className="t-navgroup-header" id={`${baseId}-title`}>
          <span className="t-navgroup-title">{title}</span>
        </span>
      )}
      {isExpanded && (
        <ul id={listId} className="t-navgroup-list" aria-label={title}>
          <DepthContext.Provider value={depth + 1}>{children}</DepthContext.Provider>
        </ul>
      )}
    </li>
  );
}
