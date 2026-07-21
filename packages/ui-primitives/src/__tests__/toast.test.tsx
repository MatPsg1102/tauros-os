// Toast/ToastProvider (6.3.5 §9) — fila, timers (fake), pausa, a11y.

import { act, fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  TOAST_PARAMETERS,
  ToastProvider,
  ToastProviderMissingError,
  useToast,
  type ToastApi,
} from '../index.js';

let api: ToastApi;

function Capture(): null {
  api = useToast();
  return null;
}

function mount(maxVisible?: number): ReturnType<typeof render> {
  return render(
    <ThemeProvider>
      <ToastProvider {...(maxVisible !== undefined ? { maxVisible } : {})}>
        <Capture />
      </ToastProvider>
    </ThemeProvider>,
  );
}

function visibleToasts(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll('.t-toast'));
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cria toast com ID estável, role=status e região acessível estável', () => {
    mount();
    let id = '';
    act(() => {
      id = api.toast({ title: 'Sincronizado' });
    });
    expect(id).not.toBe('');
    const region = document.body.querySelector('.t-toast-region');
    expect(region?.getAttribute('aria-label')).toBe('Notificações');
    const toast = visibleToasts()[0] as HTMLElement;
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.textContent).toContain('Sincronizado');
    // região nunca rouba o foco
    expect(region?.contains(document.activeElement)).toBe(false);
  });

  it('urgente usa role=alert e duração de leitura maior', () => {
    mount();
    act(() => {
      api.toast({ title: 'Falha crítica', priority: 'urgent' });
    });
    expect((visibleToasts()[0] as HTMLElement).getAttribute('role')).toBe('alert');
    act(() => {
      vi.advanceTimersByTime(TOAST_PARAMETERS.readingDurationMs + 1);
    });
    expect(visibleToasts()).toHaveLength(1); // ainda visível (duração urgente)
    act(() => {
      vi.advanceTimersByTime(TOAST_PARAMETERS.urgentReadingDurationMs);
    });
    expect(visibleToasts()).toHaveLength(0);
  });

  it('expira após a duração de leitura; persistente (null) exige fechamento manual', () => {
    mount();
    act(() => {
      api.toast({ title: 'Some' });
      api.toast({ title: 'Fica', duration: null });
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_PARAMETERS.readingDurationMs + 1);
    });
    expect(visibleToasts()).toHaveLength(1);
    expect(visibleToasts()[0]?.textContent).toContain('Fica');
  });

  it('limite visível: excedente aguarda em fila SEM expirar oculto (ordem FIFO)', () => {
    mount(2);
    act(() => {
      api.toast({ title: 'T1' });
      api.toast({ title: 'T2' });
      api.toast({ title: 'T3' });
    });
    expect(visibleToasts().map((t) => t.textContent)).toEqual([
      expect.stringContaining('T1'),
      expect.stringContaining('T2'),
    ]);
    // T1 expira → T3 entra e SÓ ENTÃO seu timer inicia
    act(() => {
      vi.advanceTimersByTime(TOAST_PARAMETERS.readingDurationMs + 1);
    });
    expect(visibleToasts().map((t) => t.textContent)).toEqual([expect.stringContaining('T3')]);
    act(() => {
      vi.advanceTimersByTime(TOAST_PARAMETERS.readingDurationMs - 1000);
    });
    expect(visibleToasts()).toHaveLength(1);
  });

  it('hover pausa o timer e leave retoma do ponto restante', () => {
    mount();
    act(() => {
      api.toast({ title: 'Pausável' });
    });
    const toast = visibleToasts()[0] as HTMLElement;
    act(() => {
      vi.advanceTimersByTime(TOAST_PARAMETERS.readingDurationMs - 1000);
    });
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(visibleToasts()).toHaveLength(1); // pausado — não expira
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(visibleToasts()).toHaveLength(0);
  });

  it('deduplicação apenas explícita: mesmo id atualiza; update() altera conteúdo', () => {
    mount();
    act(() => {
      api.toast({ id: 'sync', title: 'Enviando' });
      api.toast({ id: 'sync', title: 'Enviado' });
    });
    expect(visibleToasts()).toHaveLength(1);
    expect(visibleToasts()[0]?.textContent).toContain('Enviado');
    act(() => {
      api.update('sync', { description: '3 itens' });
    });
    expect(visibleToasts()[0]?.textContent).toContain('3 itens');
  });

  it('ação executa callback e fecha; dismiss/clear funcionam', () => {
    const onAction = vi.fn();
    mount();
    act(() => {
      api.toast({ title: 'Desfazer?', actionLabel: 'Desfazer', onAction });
      api.toast({ title: 'Outro' });
    });
    const actionBtn = document.body.querySelector('.t-toast-action') as HTMLButtonElement;
    fireEvent.click(actionBtn);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(visibleToasts()).toHaveLength(1);
    act(() => {
      api.clear();
    });
    expect(visibleToasts()).toHaveLength(0);
  });

  it('unmount do provider limpa todos os timers (nenhum vazamento)', () => {
    const { unmount } = mount();
    act(() => {
      api.toast({ title: 'A' });
      api.toast({ title: 'B' });
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('SSR: provider renderiza children no servidor sem viewport', () => {
    const html = renderToString(
      <ThemeProvider>
        <ToastProvider>
          <span>conteudo</span>
        </ToastProvider>
      </ThemeProvider>,
    );
    expect(html).toContain('conteudo');
    expect(html).not.toContain('t-toast-region');
  });

  it('múltiplos providers são independentes', () => {
    let apiA: ToastApi | undefined;
    let apiB: ToastApi | undefined;
    function CapA(): null {
      apiA = useToast();
      return null;
    }
    function CapB(): null {
      apiB = useToast();
      return null;
    }
    render(
      <ThemeProvider>
        <ToastProvider regionLabel="Região A">
          <CapA />
        </ToastProvider>
        <ToastProvider regionLabel="Região B">
          <CapB />
        </ToastProvider>
      </ThemeProvider>,
    );
    act(() => {
      apiA?.toast({ title: 'Somente A' });
    });
    const regions = document.body.querySelectorAll('.t-toast-region');
    expect(regions).toHaveLength(2);
    expect(apiB).toBeDefined();
    expect(regions[0]?.textContent).toContain('Somente A');
    expect(regions[1]?.textContent).not.toContain('Somente A');
  });
});

describe('useToast fora do provider', () => {
  it('lança erro orientado', () => {
    function Solto(): null {
      useToast();
      return null;
    }
    expect(() => render(<Solto />)).toThrow(ToastProviderMissingError);
  });
});
