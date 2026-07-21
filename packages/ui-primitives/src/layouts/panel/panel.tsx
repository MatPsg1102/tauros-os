// Panel (6.3.7 §13) — contrato de layout OPERACIONAL distinto de Card:
// coluna com cabeçalho fixo, CORPO ROLÁVEL independente (min-height: 0) e
// rodapé fixo; altura controlável (fill) para dashboards/painéis. Superfície
// visual composta sobre Surface (zero duplicação de estilo).
// Subcomponentes mínimos: Header (título+ações), Body (scroll), Footer.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Heading } from '../../primitives/heading/heading.js';
import { Surface } from '../../primitives/surface/surface.js';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Ocupa a altura disponível do pai (corpo rola internamente). */
  readonly fill?: boolean;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { fill = false, className, children, ...rest },
  ref,
) {
  return (
    <Surface
      {...rest}
      ref={ref}
      elevation="card"
      className={cx('t-panel', className)}
      data-fill={fill ? 'true' : undefined}
    >
      {children}
    </Surface>
  );
});

export interface PanelHeaderProps extends HTMLAttributes<HTMLDivElement> {
  readonly title?: string;
  readonly actions?: ReactNode;
}

export const PanelHeader = forwardRef<HTMLDivElement, PanelHeaderProps>(function PanelHeader(
  { title, actions, className, children, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={cx('t-panel-header', className)}>
      {title !== undefined && (
        <Heading level={3} visualLevel={4} className="t-panel-title">
          {title}
        </Heading>
      )}
      {children}
      {actions !== undefined && <div className="t-panel-actions">{actions}</div>}
    </div>
  );
});

export type PanelBodyProps = HTMLAttributes<HTMLDivElement>;

/** Corpo rolável independente do painel (única região com overflow). */
export const PanelBody = forwardRef<HTMLDivElement, PanelBodyProps>(function PanelBody(
  { className, children, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={cx('t-panel-body', className)}>
      {children}
    </div>
  );
});

export type PanelFooterProps = HTMLAttributes<HTMLDivElement>;

export const PanelFooter = forwardRef<HTMLDivElement, PanelFooterProps>(function PanelFooter(
  { className, children, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={cx('t-panel-footer', className)}>
      {children}
    </div>
  );
});
