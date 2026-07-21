// Fundação de overlays (6.3.5 §1/§3/§5/§6) — portal, foco, scroll lock, pilha.

import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  containTabKey,
  focusInitial,
  getFocusableElements,
} from '../feedback/overlay/focus-scope.js';
import {
  isTopOverlay,
  overlayCount,
  pushOverlay,
  removeOverlay,
} from '../feedback/overlay/overlay-stack.js';
import { Portal } from '../feedback/overlay/portal.js';
import { acquireScrollLock, scrollLockCount } from '../feedback/overlay/scroll-lock.js';

describe('Portal', () => {
  it('SSR: não emite nada no servidor (sem acesso ao DOM)', () => {
    expect(renderToString(<Portal>conteudo</Portal>)).toBe('');
  });

  it('cliente: monta em document.body por padrão e limpa no unmount', () => {
    const { unmount } = render(
      <Portal>
        <div data-testid="portalizado">x</div>
      </Portal>,
    );
    expect(document.body.querySelector('[data-testid="portalizado"]')).not.toBeNull();
    unmount();
    expect(document.body.querySelector('[data-testid="portalizado"]')).toBeNull();
  });

  it('aceita container customizado (múltiplos roots)', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    render(
      <Portal container={target}>
        <span data-testid="alvo">y</span>
      </Portal>,
    );
    expect(target.querySelector('[data-testid="alvo"]')).not.toBeNull();
    target.remove();
  });
});

describe('FocusScope (utilitários)', () => {
  function makeContainer(html: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  it('detecta focáveis reais (ignora disabled/tabindex negativo/aria-hidden)', () => {
    const el = makeContainer(
      '<button id="a">a</button><button disabled>b</button>' +
        '<input id="c" /><div tabindex="-1">d</div><a>sem href</a>' +
        '<button aria-hidden="true">e</button>',
    );
    const ids = getFocusableElements(el).map((n) => n.id);
    expect(ids).toEqual(['a', 'c']);
    el.remove();
  });

  it('foco inicial: explícito → primeiro focável → fallback container', () => {
    const el = makeContainer('<button id="a">a</button>');
    focusInitial(el);
    expect(document.activeElement?.id).toBe('a');

    const vazio = makeContainer('texto sem focável');
    focusInitial(vazio);
    expect(document.activeElement).toBe(vazio);
    el.remove();
    vazio.remove();
  });

  it('contém Tab e Shift+Tab entre primeiro e último focável', () => {
    const el = makeContainer('<button id="a">a</button><button id="b">b</button>');
    const [a, b] = getFocusableElements(el);
    (b as HTMLElement).focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    containTabKey(el, tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);

    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    containTabKey(el, shiftTab);
    expect(document.activeElement).toBe(b);
    el.remove();
  });
});

describe('ScrollLock', () => {
  it('contador: locks aninhados restauram somente no último release', () => {
    document.body.style.overflow = 'scroll';
    const release1 = acquireScrollLock(document);
    const release2 = acquireScrollLock(document);
    expect(scrollLockCount()).toBe(2);
    expect(document.body.style.overflow).toBe('hidden');
    release1();
    expect(document.body.style.overflow).toBe('hidden');
    release2();
    expect(scrollLockCount()).toBe(0);
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('release é idempotente (sobrevive a unmount inesperado/duplo cleanup)', () => {
    const release = acquireScrollLock(document);
    release();
    release();
    expect(scrollLockCount()).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });
});

describe('OverlayStack', () => {
  it('ordem determinística: topo responde, remoção limpa órfãos', () => {
    pushOverlay('a');
    pushOverlay('b');
    expect(isTopOverlay('b')).toBe(true);
    expect(isTopOverlay('a')).toBe(false);
    removeOverlay('b');
    expect(isTopOverlay('a')).toBe(true);
    removeOverlay('a');
    expect(overlayCount()).toBe(0);
  });
});
