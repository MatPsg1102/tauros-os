// EmptyState (6.3.5 §17) — ausência de conteúdo (NÃO erro). Composição dos
// primitivos existentes; ícone opcional (nunca ilustração obrigatória);
// ações glove-first por composição (Button do consumidor).

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Heading } from '../../primitives/heading/heading.js';
import { Text } from '../../primitives/text/text.js';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  readonly title: string;
  readonly description?: string;
  /** Ícone decorativo opcional (Icon do contrato 6.3.3). */
  readonly icon?: ReactNode;
  /** Ação principal (ex.: <Button>). */
  readonly action?: ReactNode;
  readonly secondaryAction?: ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { title, description, icon, action, secondaryAction, className, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={cx('t-state', 't-empty-state', className)}>
      {icon !== undefined && (
        <span className="t-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <Heading level={2} visualLevel={3}>
        {title}
      </Heading>
      {description !== undefined && (
        <Text as="p" tone="secondary">
          {description}
        </Text>
      )}
      {(action !== undefined || secondaryAction !== undefined) && (
        <div className="t-state-actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
});
