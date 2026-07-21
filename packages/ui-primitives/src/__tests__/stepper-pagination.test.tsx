// Stepper e Pagination (6.3.6 §9/§10).

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { Pagination, Stepper, type StepDefinition } from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Stepper', () => {
  const steps: readonly StepDefinition[] = [
    { label: 'Pesagem', status: 'completed' },
    { label: 'Etiquetagem', status: 'current', description: 'Em andamento' },
    { label: 'Conferência', status: 'error' },
    { label: 'Estoque', status: 'upcoming' },
    { label: 'Auditoria', status: 'disabled' },
  ];

  it('aria-current=step na etapa atual; estados por glifo além da cor', () => {
    const { container } = render(withTheme(<Stepper steps={steps} />));
    const current = container.querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain('Etiquetagem');
    expect(
      container
        .querySelector('[data-status="completed"] .t-step-marker')
        ?.getAttribute('data-glyph'),
    ).toBe('check');
    expect(
      container.querySelector('[data-status="error"] .t-step-marker')?.getAttribute('data-glyph'),
    ).toBe('error');
    expect(container.querySelector('[data-status="upcoming"] .t-step-marker')?.textContent).toBe(
      '4',
    );
  });

  it('não navegável por padrão (sem botões); navegável apenas em etapas elegíveis', () => {
    const onStepSelect = vi.fn();
    const { container, rerender, getAllByRole } = render(withTheme(<Stepper steps={steps} />));
    expect(container.querySelectorAll('button')).toHaveLength(0);
    rerender(withTheme(<Stepper steps={steps} navigable onStepSelect={onStepSelect} />));
    // elegíveis: completed, current, error (não upcoming/disabled)
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(onStepSelect).toHaveBeenCalledWith(0);
  });

  it('orientação vertical exposta por data-attribute', () => {
    const { container } = render(withTheme(<Stepper steps={steps} orientation="vertical" />));
    expect(container.querySelector('.t-stepper')?.getAttribute('data-orientation')).toBe(
      'vertical',
    );
  });
});

describe('Pagination', () => {
  it('zero páginas não renderiza; uma página desabilita navegação', () => {
    const { container, rerender, getByRole } = render(
      withTheme(<Pagination currentPage={1} totalPages={0} />),
    );
    expect(container.querySelector('nav')).toBeNull();
    rerender(withTheme(<Pagination currentPage={1} totalPages={1} />));
    expect(getByRole('navigation', { name: 'Paginação' })).toBeTruthy();
    expect((getByRole('button', { name: 'Próxima página' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((getByRole('button', { name: 'Página anterior' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('janela com reticências para totais altos; atual com aria-current', () => {
    const { getByRole, container } = render(
      withTheme(<Pagination currentPage={50} totalPages={100} />),
    );
    expect(getByRole('button', { name: 'Página 50' }).getAttribute('aria-current')).toBe('page');
    expect(getByRole('button', { name: 'Página 1' })).toBeTruthy();
    expect(getByRole('button', { name: 'Página 100' })).toBeTruthy();
    expect(container.querySelectorAll('.t-page-ellipsis')).toHaveLength(2);
  });

  it('página fora do intervalo sofre clamp previsível', () => {
    const { getByRole } = render(withTheme(<Pagination currentPage={999} totalPages={5} />));
    expect(getByRole('button', { name: 'Página 5' }).getAttribute('aria-current')).toBe('page');
  });

  it('callbacks: navegação dispara onPageChange com a página alvo', () => {
    const onPageChange = vi.fn();
    const { getByRole } = render(
      withTheme(<Pagination currentPage={3} totalPages={9} onPageChange={onPageChange} />),
    );
    fireEvent.click(getByRole('button', { name: 'Próxima página' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    fireEvent.click(getByRole('button', { name: 'Primeira página' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    fireEvent.click(getByRole('button', { name: 'Última página' }));
    expect(onPageChange).toHaveBeenLastCalledWith(9);
  });

  it('modo link: páginas viram <a> com href (adapter neutro); atual continua botão', () => {
    const navigate = vi.fn();
    const { getByRole } = render(
      withTheme(
        <Pagination
          currentPage={2}
          totalPages={4}
          getPageLink={(page) => ({ href: `/lista?p=${String(page)}`, navigate })}
        />,
      ),
    );
    const link3 = getByRole('link', { name: 'Página 3' }) as HTMLAnchorElement;
    expect(link3.getAttribute('href')).toBe('/lista?p=3');
    fireEvent.click(link3, { button: 0 });
    expect(navigate).toHaveBeenCalled();
    expect(getByRole('button', { name: 'Página 2' }).getAttribute('aria-current')).toBe('page');
  });

  it('labels substituíveis (i18n por props)', () => {
    const { getByRole } = render(
      withTheme(
        <Pagination
          currentPage={1}
          totalPages={3}
          labels={{ navigation: 'Pages', next: 'Next page', page: (p) => `Page ${String(p)}` }}
        />,
      ),
    );
    expect(getByRole('navigation', { name: 'Pages' })).toBeTruthy();
    expect(getByRole('button', { name: 'Next page' })).toBeTruthy();
    expect(getByRole('button', { name: 'Page 1' })).toBeTruthy();
  });
});
