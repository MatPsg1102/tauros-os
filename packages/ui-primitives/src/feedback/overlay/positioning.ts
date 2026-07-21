// Adapter interno de posicionamento (6.3.5 §16) — Tooltip e Popover
// compartilham UMA estratégia. @floating-ui/dom fica isolado aqui: nenhum
// tipo da biblioteca atravessa a API pública. Offset tokenizado via CSS var
// resolvida no elemento (nunca número mágico).

'use client';

import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

export type OverlayPlacement = 'top' | 'right' | 'bottom' | 'left';

export interface PositionController {
  /** Cancela rastreamento (scroll/resize) e limpa estilos aplicados. */
  readonly destroy: () => void;
}

/** Lê o offset tokenizado (--tauros-space-gap-100) resolvido em px. */
function tokenOffsetPx(reference: Element): number {
  const doc = reference.ownerDocument;
  const raw = doc.defaultView
    ?.getComputedStyle(doc.documentElement)
    .getPropertyValue('--tauros-space-gap-100');
  const parsed = Number.parseFloat(raw ?? '');
  // fallback previsível quando o tema ainda não injetou variáveis (testes/SSR)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

/**
 * Posiciona `floating` relativo a `reference` com flip/shift de colisão e
 * atualização em scroll/resize. Retorna controlador com cleanup obrigatório.
 */
export function positionOverlay(
  reference: HTMLElement,
  floating: HTMLElement,
  placement: OverlayPlacement,
): PositionController {
  const update = (): void => {
    const gap = tokenOffsetPx(reference);
    void computePosition(reference, floating, {
      placement,
      middleware: [offset(gap), flip(), shift({ padding: gap })],
    }).then(({ x, y }) => {
      if (!floating.isConnected) return;
      floating.style.left = `${String(x)}px`;
      floating.style.top = `${String(y)}px`;
    });
  };
  const stop = autoUpdate(reference, floating, update, {
    // jsdom/ambientes sem ResizeObserver: rastreia apenas scroll/resize
    elementResize: typeof ResizeObserver === 'function',
  });
  return {
    destroy: () => {
      stop();
    },
  };
}
