// ErrorState (6.3.5 §18) — falha que IMPEDE/substitui uma região de conteúdo
// (distinto de Alert, que convive com o conteúdo). Recebe apenas conteúdo
// SEGURO e previamente tratado: nunca stack trace, SQL, segredo ou exceção
// bruta. Sem integração automática com Audit Engine/telemetria.
// `errorReference` é um identificador de suporte (ex.: correlationId curto),
// exibido como texto — jamais o erro interno.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Heading } from '../../primitives/heading/heading.js';
import { Text } from '../../primitives/text/text.js';

export interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  readonly title: string;
  readonly description?: string;
  /** Referência de suporte segura (ex.: código de correlação exibível). */
  readonly errorReference?: string;
  /** Ação "tentar novamente" (ex.: <Button>). */
  readonly retryAction?: ReactNode;
  /** Ação "voltar". */
  readonly backAction?: ReactNode;
}

export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(function ErrorState(
  { title, description, errorReference, retryAction, backAction, className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      role="alert"
      className={cx('t-state', 't-error-state', className)}
      data-status="error"
    >
      <span className="t-state-marker" data-shape="square" aria-hidden="true" />
      <Heading level={2} visualLevel={3}>
        {title}
      </Heading>
      {description !== undefined && (
        <Text as="p" tone="secondary">
          {description}
        </Text>
      )}
      {errorReference !== undefined && (
        <Text as="p" role="data" tone="tertiary" className="t-state-reference">
          {errorReference}
        </Text>
      )}
      {(retryAction !== undefined || backAction !== undefined) && (
        <div className="t-state-actions">
          {retryAction}
          {backAction}
        </div>
      )}
    </div>
  );
});
