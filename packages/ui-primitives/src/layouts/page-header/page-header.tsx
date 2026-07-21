// PageHeader (6.3.7 §10) — contexto de UMA página (≠ TopBar, que é barra da
// aplicação). Composição por slots: breadcrumb, eyebrow, título (nível
// configurável — sem heading rígido), descrição, status, ações. Empilha no
// mobile via CSS; ações quebram linha; títulos longos truncam sem perder AT.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Heading, type HeadingLevel } from '../../primitives/heading/heading.js';

export interface PageHeaderProps extends HTMLAttributes<HTMLElement> {
  readonly title: string;
  /** Nível semântico do heading (default 1 — título da tela). */
  readonly headingLevel?: HeadingLevel;
  readonly description?: string;
  /** Trilha de navegação (ex.: <Breadcrumb/>). */
  readonly breadcrumb?: ReactNode;
  /** Rótulo curto acima do título (contexto). */
  readonly eyebrow?: string;
  /** Status da entidade/tela (ex.: <Badge/>). */
  readonly status?: ReactNode;
  readonly actions?: ReactNode;
}

export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(function PageHeader(
  {
    title,
    headingLevel = 1,
    description,
    breadcrumb,
    eyebrow,
    status,
    actions,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <header {...rest} ref={ref} className={cx('t-pageheader', className)}>
      {breadcrumb !== undefined && <div className="t-pageheader-breadcrumb">{breadcrumb}</div>}
      <div className="t-pageheader-row">
        <div className="t-pageheader-main">
          {eyebrow !== undefined && <span className="t-pageheader-eyebrow">{eyebrow}</span>}
          <div className="t-pageheader-titlerow">
            <Heading level={headingLevel} visualLevel={2} className="t-pageheader-title">
              {title}
            </Heading>
            {status !== undefined && <span className="t-pageheader-status">{status}</span>}
          </div>
          {description !== undefined && <p className="t-pageheader-desc">{description}</p>}
        </div>
        {actions !== undefined && <div className="t-pageheader-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
});
