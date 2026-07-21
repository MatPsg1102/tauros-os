// Transversais 6.3.5: SSR/hidratação, modos runtime, disciplina de tokens,
// axe e ausência de exports internos da fundação.

import { act, render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StrictMode, type ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PREFERENCES, ThemeProvider } from '@tauros/theme';

import * as publicApi from '../index.js';
import {
  Alert,
  Banner,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Popover,
  Progress,
  taurosUiStyles,
  ToastProvider,
  Tooltip,
} from '../index.js';

function feedbackTree(): ReactElement {
  return (
    <ToastProvider>
      <Alert status="info" title="Aviso">
        corpo
      </Alert>
      <Banner status="warning">Comunicado</Banner>
      <Progress label="Progresso" value={1} max={4} />
      <Tooltip content="dica">
        <button>alvo</button>
      </Tooltip>
      <Popover triggerLabel="Abrir filtros">
        <button>ok</button>
      </Popover>
      <Dialog open={false} title="Fechado" onOpenChange={() => undefined}>
        x
      </Dialog>
      <EmptyState title="Vazio" />
      <ErrorState title="Erro" />
      <LoadingState />
    </ToastProvider>
  );
}

describe('SSR e hidratação', () => {
  it('renderToString é determinístico e não toca o DOM', () => {
    const ui = <ThemeProvider>{feedbackTree()}</ThemeProvider>;
    const a = renderToString(ui);
    expect(a).toBe(renderToString(ui));
    expect(a).toContain('t-alert');
    // overlays fechados/portais não emitem markup no servidor
    expect(a).not.toContain('t-toast-region');
    expect(a).not.toContain('role="dialog"');
  });

  it('hidrata sem erros de mismatch', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ui = (
      <StrictMode>
        <ThemeProvider>{feedbackTree()}</ThemeProvider>
      </StrictMode>
    );
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.innerHTML = renderToString(ui);
    await act(async () => {
      hydrateRoot(host, ui);
    });
    const mismatch = errors.mock.calls.filter((c) => String(c[0]).includes('hydrat'));
    expect(mismatch).toEqual([]);
    errors.mockRestore();
    host.remove();
  });
});

describe('modos runtime', () => {
  it.each([
    ['dark', { colorScheme: 'dark' as const }],
    ['highContrast', { modes: { ...DEFAULT_PREFERENCES.modes, highContrast: true } }],
    ['industrial', { modes: { ...DEFAULT_PREFERENCES.modes, industrial: true } }],
    ['glove', { modes: { ...DEFAULT_PREFERENCES.modes, glove: true } }],
    ['reducedMotion', { modes: { ...DEFAULT_PREFERENCES.modes, reducedMotion: true } }],
  ])('renderiza feedback sob modo %s', (_name, patch) => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const { container } = render(
      <ThemeProvider defaultPreferences={{ ...DEFAULT_PREFERENCES, ...patch }} target={target}>
        {feedbackTree()}
      </ThemeProvider>,
    );
    expect(container.querySelector('.t-alert')).not.toBeNull();
    target.remove();
  });
});

describe('disciplina de tokens e API pública', () => {
  it('CSS de feedback usa apenas variáveis (z-index por token, sem literais)', () => {
    expect(taurosUiStyles).toContain('.t-dialog-layer');
    expect(taurosUiStyles).toContain('z-index: var(--tauros-z-dialog)');
    expect(taurosUiStyles).toContain('z-index: var(--tauros-z-toast)');
    expect(taurosUiStyles).not.toMatch(/z-index:\s*\d/);
    expect(taurosUiStyles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('fundação interna NÃO é exportada (Portal, stack, focus, scroll, adapter)', () => {
    const names = Object.keys(publicApi);
    for (const forbidden of [
      'Portal',
      'pushOverlay',
      'isTopOverlay',
      'acquireScrollLock',
      'scrollLockCount',
      'getFocusableElements',
      'containTabKey',
      'positionOverlay',
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });
});

describe('axe — feedback sem violações', () => {
  it('mensagens e estados', async () => {
    const { container } = render(
      <ThemeProvider>
        <Alert status="error" title="Falha" live="polite" onDismiss={() => undefined}>
          Descrição da falha
        </Alert>
        <Banner status="info" action={<Button size="sm">Resolver</Button>}>
          Configuração pendente
        </Banner>
        <Progress label="Sincronização" value={2} max={5} valueText="2 de 5" showValueText />
        <EmptyState title="Sem dados" description="Nada por aqui" action={<Button>Criar</Button>} />
        <ErrorState title="Erro ao carregar" retryAction={<Button>Tentar novamente</Button>} />
        <LoadingState />
      </ThemeProvider>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it('dialog aberto com título/descrição', async () => {
    render(
      <ThemeProvider>
        <Dialog defaultOpen title="Confirmar" description="Revise os dados" closeLabel="Fechar">
          <Button>Ok</Button>
        </Dialog>
      </ThemeProvider>,
    );
    expect((await axe(document.body)).violations).toEqual([]);
  });
});
