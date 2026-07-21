// StickyRegion (6.3.7 §18) — comportamento sticky previsível (top|bottom):
// z-sticky por token, fundo de superfície, separação visual, safe area no
// bottom (padrão reutilizado de NavigationBar/BottomSheet — sem duplicação
// em composições: a região NÃO deve envolver componentes que já aplicam a
// própria safe area, ex.: NavigationBar fixed).
// REQUISITO DO ANCESTRAL (documentado): sticky exige que nenhum ancestral
// entre a região e o container de scroll tenha overflow hidden/auto próprio
// — no AppShell, o container de scroll é a região de conteúdo (.t-shell-content).

'use client';

import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from '../../shared/class-names.js';

export interface StickyRegionProps extends HTMLAttributes<HTMLDivElement> {
  readonly position?: 'top' | 'bottom';
}

export const StickyRegion = forwardRef<HTMLDivElement, StickyRegionProps>(function StickyRegion(
  { position = 'bottom', className, children, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={cx('t-stickyregion', className)} data-position={position}>
      {children}
    </div>
  );
});
