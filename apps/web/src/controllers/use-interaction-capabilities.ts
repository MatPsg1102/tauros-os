// Capacidades de INTERAÇÃO do dispositivo (UX V1.2) — detectadas por media
// features (hover/pointer/prefers-reduced-motion), nunca por user-agent.
// SSR/jsdom sem matchMedia ⇒ defaults desktop-first (hover, motion normal).

'use client';

import { useEffect, useState } from 'react';

function useMediaFlag(query: string, fallback: boolean): boolean {
  const [matches, setMatches] = useState(fallback);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [query, fallback]);
  return matches;
}

/**
 * 'hover' = ponteiro fino com hover real (desktop/notebook) — a sidebar pode
 * expandir por aproximação. 'touch' = sem hover confiável (tablet/celular) —
 * abrir por toque, nunca por hover.
 */
export function usePointerMode(): 'hover' | 'touch' {
  return useMediaFlag('(hover: hover) and (pointer: fine)', true) ? 'hover' : 'touch';
}

/** Usuário pediu menos movimento: transições viram troca instantânea. */
export function usePrefersReducedMotion(): boolean {
  return useMediaFlag('(prefers-reduced-motion: reduce)', false);
}
