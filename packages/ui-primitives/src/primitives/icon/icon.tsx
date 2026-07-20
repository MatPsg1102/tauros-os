// Icon — CONTRATO tipado (6.3.3 §10): não aceita strings SVG arbitrárias nem
// embute biblioteca de ícones. Consumidores registram `IconDefinition`s
// (path data validado por tipo); a escolha de biblioteca é decisão futura
// isolada atrás deste contrato.

import { forwardRef, type SVGAttributes } from 'react';

import { cssVar } from '@tauros/tokens';

import { cx } from '../../shared/class-names.js';

/** Definição estática de ícone — única forma aceita de fornecer desenho. */
export interface IconDefinition {
  readonly name: string;
  readonly viewBox: string;
  /** Path data (atributo `d`) de um único path com fill=currentColor. */
  readonly path: string;
}

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_VAR: Record<IconSize, string> = {
  sm: cssVar('space-gap-200'),
  md: cssVar('space-gap-300'),
  lg: cssVar('space-gap-400'),
};

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'viewBox'> {
  readonly icon: IconDefinition;
  readonly size?: IconSize;
  /** Nome acessível. Ausente ⇒ decorativo (aria-hidden). */
  readonly label?: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { icon, size = 'md', label, className, style, ...rest },
  ref,
) {
  const accessible =
    label === undefined
      ? ({ 'aria-hidden': 'true' } as const)
      : ({ role: 'img', 'aria-label': label } as const);
  return (
    <svg
      {...rest}
      {...accessible}
      ref={ref}
      className={cx('t-icon', className)}
      data-icon={icon.name}
      viewBox={icon.viewBox}
      fill="currentColor"
      focusable="false"
      style={{ width: SIZE_VAR[size], height: SIZE_VAR[size], flexShrink: 0, ...style }}
    >
      <path d={icon.path} />
    </svg>
  );
});
