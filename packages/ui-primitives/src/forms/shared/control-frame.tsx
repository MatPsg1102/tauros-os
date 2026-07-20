// ControlFrame — moldura visual compartilhada dos campos de texto/select.
// INTERNO: não faz parte da API pública (6.3.4 §23). Adornos são decorativos
// (aria-hidden) e não interceptam foco nem seleção do texto.

'use client';

import type { ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';

export interface ControlFrameProps {
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly readOnly?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly startAdornment?: ReactNode;
  readonly endAdornment?: ReactNode;
  /** Conteúdo interativo pós-controle (ex.: botão limpar) — NÃO decorativo. */
  readonly trailing?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

export function ControlFrame({
  invalid,
  disabled,
  readOnly = false,
  size = 'md',
  startAdornment,
  endAdornment,
  trailing,
  className,
  children,
}: ControlFrameProps): ReactNode {
  return (
    <div
      className={cx('t-frame', className)}
      data-invalid={invalid ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      data-readonly={readOnly ? 'true' : undefined}
      data-size={size}
    >
      {startAdornment !== undefined && (
        <span className="t-adorn" aria-hidden="true">
          {startAdornment}
        </span>
      )}
      {children}
      {endAdornment !== undefined && (
        <span className="t-adorn" aria-hidden="true">
          {endAdornment}
        </span>
      )}
      {trailing}
    </div>
  );
}
