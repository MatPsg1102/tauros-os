// Portal (6.3.5 §3) — cliente-only, SSR-safe: no servidor nada é emitido e a
// hidratação monta o conteúdo apenas após o mount (sem inconsistência
// silenciosa). Container customizável; fallback previsível: document.body.

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  readonly children: ReactNode;
  /** Container alvo. Default (após mount): document.body. */
  readonly container?: HTMLElement | null;
}

export function Portal({ children, container }: PortalProps): ReactNode {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  const target = container ?? globalThis.document?.body;
  if (target === undefined || target === null) return null;
  return createPortal(children, target);
}
