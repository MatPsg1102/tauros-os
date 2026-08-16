// Viewport estreito? Mesmo limiar do DS (core.breakpoint.tablet) que oculta
// a sidebar do AppShell via CSS — o app decide APENAS qual gatilho mostrar
// (Drawer no mobile), nunca duplica estilo. SSR/jsdom sem matchMedia ⇒ false
// (desktop-first: sidebar visível é o estado seguro).

'use client';

import { useEffect, useState } from 'react';

import { core } from '@tauros/tokens';

const NARROW_QUERY = `(max-width: calc(${core.breakpoint.tablet} - 0.02px))`;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(NARROW_QUERY);
    setIsMobile(media.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      setIsMobile(event.matches);
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  return isMobile;
}
