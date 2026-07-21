// Scroll lock com contador (6.3.5 §6) — suporta overlays aninhados, preserva
// posição, compensa a scrollbar (sem layout shift) e restaura estilos
// anteriores. Sobrevive a unmount inesperado: cada aquisição devolve um
// release idempotente; o último release restaura tudo.

'use client';

let lockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

/** Bloqueia o scroll do documento; retorna release idempotente. */
export function acquireScrollLock(doc: Document = document): () => void {
  const body = doc.body;
  if (lockCount === 0) {
    previousOverflow = body.style.overflow;
    previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = (doc.defaultView?.innerWidth ?? 0) - doc.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const current = doc.defaultView?.getComputedStyle(body).paddingRight ?? '0px';
      body.style.paddingRight = `calc(${current} + ${String(scrollbarWidth)}px)`;
    }
    body.style.overflow = 'hidden';
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    }
  };
}

/** Exposto apenas para testes internos da fundação. */
export function scrollLockCount(): number {
  return lockCount;
}
