// Section (6.3.7 §12) — região TEMÁTICA de página (organiza conteúdo;
// ≠ Panel, que é superfície). Com título: <section aria-labelledby> com
// heading real (nunca heading vazio). Sem título: região estrutural sem
// landmark nomeado. Espaçamento entre seções via CSS da página.

'use client';

import { forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Heading, type HeadingLevel } from '../../primitives/heading/heading.js';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  readonly title?: string;
  /** Nível semântico do heading (default 2 — seção de página). */
  readonly headingLevel?: HeadingLevel;
  readonly description?: string;
  readonly actions?: ReactNode;
}

export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  { title, headingLevel = 2, description, actions, className, children, ...rest },
  ref,
) {
  const baseId = useId();
  const headingId = title === undefined ? undefined : `${baseId}-heading`;
  return (
    <section
      {...rest}
      ref={ref}
      aria-labelledby={rest['aria-label'] === undefined ? headingId : undefined}
      className={cx('t-section', className)}
    >
      {(title !== undefined || actions !== undefined) && (
        <div className="t-section-header">
          <div className="t-section-heading">
            {title !== undefined && (
              <Heading level={headingLevel} visualLevel={3} id={headingId}>
                {title}
              </Heading>
            )}
            {description !== undefined && <p className="t-section-desc">{description}</p>}
          </div>
          {actions !== undefined && <div className="t-section-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
});
