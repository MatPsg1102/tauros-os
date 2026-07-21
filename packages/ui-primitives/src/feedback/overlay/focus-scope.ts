// Gestão de foco (6.3.5 §5) — utilitários internos da fundação de overlays.
// Seletor de focáveis complementado por verificação de tabIndex/disabled
// (não é a única fonte) e fallback para o container.

'use client';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
  '[contenteditable="true"]',
].join(',');

function isFocusable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.tabIndex < 0) return false;
  if ('disabled' in el && (el as HTMLElement & { disabled?: boolean }).disabled === true)
    return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  return true;
}

/** Elementos focáveis reais dentro do container (ordem do documento). */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isFocusable);
}

/** Foca o alvo inicial: ref explícita → primeiro focável → container. */
export function focusInitial(container: HTMLElement, explicit?: HTMLElement | null): void {
  if (explicit !== undefined && explicit !== null) {
    explicit.focus();
    return;
  }
  const first = getFocusableElements(container)[0];
  if (first !== undefined) {
    first.focus();
    return;
  }
  if (container.tabIndex < 0) container.tabIndex = -1;
  container.focus();
}

/** Contém Tab/Shift+Tab dentro do container (chamar no keydown). */
export function containTabKey(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0] as HTMLElement;
  const last = focusable[focusable.length - 1] as HTMLElement;
  const active = container.ownerDocument.activeElement;
  if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Captura o elemento focado agora e devolve um restaurador tolerante. */
export function captureFocusRestore(doc: Document): () => void {
  const previous = doc.activeElement;
  return () => {
    if (
      previous instanceof HTMLElement &&
      previous.isConnected &&
      typeof previous.focus === 'function'
    ) {
      previous.focus();
    } else {
      // elemento removido antes da restauração: fallback previsível
      (doc.body as HTMLElement | null)?.focus?.();
    }
  };
}
