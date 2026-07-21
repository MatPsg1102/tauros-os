// Alert, Banner, Progress, EmptyState, ErrorState, LoadingState (6.3.5).

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  Alert,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  InvalidProgressRangeError,
  LoadingState,
  Progress,
} from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Alert', () => {
  it('status multidimensional: cor (data-status) + forma (marker)', () => {
    const { container } = render(
      withTheme(
        <Alert status="warning" title="Estoque baixo">
          Reponha o item.
        </Alert>,
      ),
    );
    const alert = container.querySelector('.t-alert');
    expect(alert?.getAttribute('data-status')).toBe('warn');
    expect(alert?.querySelector('.t-alert-marker')?.getAttribute('data-shape')).toBe('triangle');
  });

  it('sem live region por padrão; live explícito mapeia para role correto', () => {
    const { container, rerender } = render(withTheme(<Alert status="error">x</Alert>));
    expect(container.querySelector('.t-alert')?.getAttribute('role')).toBeNull();
    rerender(
      withTheme(
        <Alert status="error" live="assertive">
          x
        </Alert>,
      ),
    );
    expect(container.querySelector('.t-alert')?.getAttribute('role')).toBe('alert');
    rerender(
      withTheme(
        <Alert status="info" live="polite">
          x
        </Alert>,
      ),
    );
    expect(container.querySelector('.t-alert')?.getAttribute('role')).toBe('status');
  });

  it('ação e dismiss opcionais com rótulo acessível', () => {
    const onDismiss = vi.fn();
    const { getByRole } = render(
      withTheme(
        <Alert
          status="info"
          action={<Button size="sm">Ver detalhes</Button>}
          onDismiss={onDismiss}
          dismissLabel="Fechar aviso"
        >
          msg
        </Alert>,
      ),
    );
    expect(getByRole('button', { name: 'Ver detalhes' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Fechar aviso' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('Banner', () => {
  it('alta visibilidade no fluxo (não fixo) com status e alvo glove-first', () => {
    const { container, getByRole } = render(
      withTheme(
        <Banner status="critical" onDismiss={() => undefined}>
          Modo offline ativo
        </Banner>,
      ),
    );
    const banner = container.querySelector('.t-banner') as HTMLElement;
    expect(banner.getAttribute('data-status')).toBe('critical');
    expect(banner.querySelector('.t-banner-marker')?.getAttribute('data-shape')).toBe('triangle');
    // não fixa na viewport por conta própria (posição vem do layout)
    expect(banner.style.position).toBe('');
    expect(getByRole('button', { name: 'Fechar comunicado' }).classList.contains('t-iconbtn')).toBe(
      true,
    );
  });
});

describe('Progress', () => {
  it('determinado: ARIA completa e clamp previsível fora da faixa', () => {
    const { getByRole, rerender } = render(
      withTheme(<Progress label="Sincronização" value={3} min={0} max={8} valueText="3 de 8" />),
    );
    const bar = getByRole('progressbar', { name: 'Sincronização' });
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('8');
    expect(bar.getAttribute('aria-valuetext')).toBe('3 de 8');
    rerender(withTheme(<Progress label="S" value={99} min={0} max={8} />));
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('8');
    rerender(withTheme(<Progress label="S" value={-5} min={0} max={8} />));
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('indeterminado: sem aria-valuenow, com data-indeterminate', () => {
    const { getByRole } = render(withTheme(<Progress label="Carga" />));
    const bar = getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
    expect(bar.getAttribute('data-indeterminate')).toBe('true');
  });

  it('min >= max lança erro orientado', () => {
    expect(() => render(withTheme(<Progress label="X" min={10} max={10} />))).toThrow(
      InvalidProgressRangeError,
    );
  });
});

describe('Estados de região', () => {
  it('EmptyState: hierarquia (heading) + ações compostas', () => {
    const { getByRole } = render(
      withTheme(
        <EmptyState
          title="Nenhum corte cadastrado"
          description="Cadastre o primeiro corte"
          action={<Button>Cadastrar</Button>}
        />,
      ),
    );
    expect(getByRole('heading', { name: 'Nenhum corte cadastrado' })).toBeTruthy();
    expect(getByRole('button', { name: 'Cadastrar' })).toBeTruthy();
  });

  it('ErrorState: role=alert, referência segura, sem conteúdo bruto de exceção', () => {
    const { getByRole, container } = render(
      withTheme(
        <ErrorState
          title="Falha ao carregar"
          description="Tente novamente"
          errorReference="REF-2026-001"
          retryAction={<Button>Tentar novamente</Button>}
        />,
      ),
    );
    const region = getByRole('alert');
    expect(region.textContent).toContain('REF-2026-001');
    expect(container.querySelector('.t-state-marker')?.getAttribute('data-shape')).toBe('square');
  });

  it('LoadingState spinner: anúncio único; skeleton: preserva layout sem anúncio duplo', () => {
    const { getByRole, rerender, container } = render(
      withTheme(<LoadingState label="Carregando cortes" />),
    );
    expect(getByRole('status').textContent).toContain('Carregando cortes');
    rerender(withTheme(<LoadingState variant="skeleton" lines={4} label="Carregando lista" />));
    expect(getByRole('status').textContent).toContain('Carregando lista');
    expect(container.querySelectorAll('.t-skeleton')).toHaveLength(4);
    // apenas UMA região de anúncio
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });
});
