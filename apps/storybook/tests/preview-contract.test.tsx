// Contratos do preview (6.3.8 §6/§7): injeção idempotente da folha oficial,
// decorator com ThemeProvider real (modos por preferência), sem storage.

import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  IncompatibleStylesElementError,
  injectUiStyles,
  taurosUiStyles,
} from '@tauros/ui-primitives';

import preview from '../.storybook/preview';

describe('folha oficial no preview', () => {
  it('injeção explícita, única e idempotente entre trocas de história', () => {
    expect(document.getElementById('tauros-ui-styles')).toBeNull(); // import sem side effect
    injectUiStyles(document);
    injectUiStyles(document);
    injectUiStyles(document);
    expect(document.querySelectorAll('#tauros-ui-styles')).toHaveLength(1);
    expect(document.getElementById('tauros-ui-styles')?.textContent).toBe(taurosUiStyles);
    document.getElementById('tauros-ui-styles')?.remove();
  });

  it('elemento alheio no ID reservado continua sendo rejeitado', () => {
    const alien = document.createElement('style');
    alien.id = 'tauros-ui-styles';
    document.head.appendChild(alien);
    expect(() => injectUiStyles(document)).toThrow(IncompatibleStylesElementError);
    alien.remove();
  });
});

describe('decorator de tema', () => {
  function renderWithGlobals(globals: Record<string, string>): HTMLElement {
    const list = Array.isArray(preview.decorators) ? preview.decorators : [preview.decorators];
    const decorator = list[0];
    if (decorator === undefined) throw new Error('decorator ausente');
    const element = decorator(
      () => <button>alvo</button>,
      // contexto mínimo usado pelo decorator (globals)
      { globals } as never,
    );
    const { container } = render(<>{element}</>);
    return container;
  }

  it('modos da toolbar viram preferências reais do ThemeProvider', () => {
    renderWithGlobals({
      scheme: 'dark',
      contrast: 'industrial',
      input: 'glove',
      motion: 'reduced',
    });
    const root = document.documentElement;
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-environment')).toBe('industrial');
    expect(root.getAttribute('data-input-mode')).toBe('glove');
    expect(root.getAttribute('data-motion')).toBe('reduced');
  });

  it('não acessa storage (modo controlado com noopPreferenceStorage)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    renderWithGlobals({
      scheme: 'light',
      contrast: 'default',
      input: 'default',
      motion: 'default',
    });
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    getItem.mockRestore();
  });

  it('preferências inválidas na toolbar caem em defaults seguros', () => {
    renderWithGlobals({ scheme: 'invalido', contrast: 'x', input: 'y', motion: 'z' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
