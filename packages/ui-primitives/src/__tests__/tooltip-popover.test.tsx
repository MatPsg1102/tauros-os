// Tooltip e Popover (6.3.5 §14–§16) — posicionamento compartilhado (adapter).
// Geometria real não é observável em jsdom; os testes cobrem semântica,
// abertura/fechamento, foco e cleanup (o adapter roda sem erro).

import { act, fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { Popover, Tooltip } from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('abre imediatamente no foco e associa via aria-describedby', () => {
    const { getByRole } = render(
      withTheme(
        <Tooltip content="Peso líquido do corte">
          <button>Peso</button>
        </Tooltip>,
      ),
    );
    const trigger = getByRole('button', { name: 'Peso' });
    fireEvent.focus(trigger);
    const tip = document.body.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tip.textContent).toBe('Peso líquido do corte');
    expect(trigger.getAttribute('aria-describedby')).toContain(tip.id);
  });

  it('hover abre com atraso tokenizado; leave fecha e limpa o timer', () => {
    const { getByRole } = render(
      withTheme(
        <Tooltip content="Dica">
          <button>T</button>
        </Tooltip>,
      ),
    );
    const trigger = getByRole('button');
    fireEvent.mouseEnter(trigger);
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull();
    fireEvent.mouseLeave(trigger);
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('Escape fecha (nunca inescapável, incl. toque via foco)', () => {
    const { getByRole } = render(
      withTheme(
        <Tooltip content="Dica">
          <button>T</button>
        </Tooltip>,
      ),
    );
    fireEvent.focus(getByRole('button'));
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('blur fecha; conteúdo é texto (não interativo) e não recebe eventos', () => {
    const { getByRole } = render(
      withTheme(
        <Tooltip content="Somente texto">
          <button>T</button>
        </Tooltip>,
      ),
    );
    const trigger = getByRole('button');
    fireEvent.focus(trigger);
    const tip = document.body.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tip.querySelector('button, a, input')).toBeNull();
    fireEvent.blur(trigger);
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });
});

describe('Popover', () => {
  it('trigger mantém aria-expanded/aria-controls; abre por clique', () => {
    const { getByRole } = render(
      withTheme(
        <Popover triggerLabel="Filtros">
          <button>Aplicar</button>
        </Popover>,
      ),
    );
    const trigger = getByRole('button', { name: 'Filtros' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const content = document.getElementById(trigger.getAttribute('aria-controls') as string);
    expect(content?.getAttribute('role')).toBe('dialog');
  });

  it('foco ENTRA no conteúdo ao abrir e é restaurado ao fechar por Escape', () => {
    const { getByRole } = render(
      withTheme(
        <Popover triggerLabel="Filtros">
          <button>Aplicar</button>
        </Popover>,
      ),
    );
    const trigger = getByRole('button', { name: 'Filtros' });
    fireEvent.click(trigger);
    expect(document.activeElement?.textContent).toBe('Aplicar');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.querySelector('.t-popover')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('clique externo fecha; clique interno NÃO fecha (conteúdo interativo)', () => {
    const onAction = vi.fn();
    const { getByRole } = render(
      withTheme(
        <Popover triggerLabel="Filtros">
          <button onClick={onAction}>Aplicar</button>
        </Popover>,
      ),
    );
    fireEvent.click(getByRole('button', { name: 'Filtros' }));
    fireEvent.click(document.activeElement as HTMLElement);
    expect(onAction).toHaveBeenCalled();
    expect(document.body.querySelector('.t-popover')).not.toBeNull();

    fireEvent.pointerDown(document.body);
    expect(document.body.querySelector('.t-popover')).toBeNull();
  });

  it('controlled: segue open externo; não bloqueia scroll (não modal)', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      withTheme(
        <Popover triggerLabel="F" open onOpenChange={onOpenChange}>
          <button>a</button>
        </Popover>,
      ),
    );
    expect(document.body.querySelector('.t-popover')).not.toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    rerender(
      withTheme(
        <Popover triggerLabel="F" open={false} onOpenChange={onOpenChange}>
          <button>a</button>
        </Popover>,
      ),
    );
    expect(document.body.querySelector('.t-popover')).toBeNull();
  });
});
