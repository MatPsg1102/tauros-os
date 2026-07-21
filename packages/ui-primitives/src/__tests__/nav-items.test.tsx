// NavigationItem e NavigationGroup (6.3.6 §3/§4) + contrato neutro de links.

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  MissingAccessibleNameError,
  NavigationDepthExceededError,
  NavigationGroup,
  NavigationItem,
} from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

function inList(ui: ReactElement): ReactElement {
  return withTheme(<ul>{ui}</ul>);
}

describe('NavigationItem', () => {
  it('label vazio lança erro orientado (nome acessível obrigatório)', () => {
    expect(() => render(inList(<NavigationItem label="   " />))).toThrow(
      MissingAccessibleNameError,
    );
  });

  it('com link renderiza <a> preservando href; sem link renderiza botão', () => {
    const { getByRole, rerender } = render(
      inList(<NavigationItem label="Estoque" link={{ href: '/estoque' }} />),
    );
    const anchor = getByRole('link', { name: 'Estoque' }) as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe('/estoque');
    rerender(inList(<NavigationItem label="Ação" onSelect={() => undefined} />));
    expect(getByRole('button', { name: 'Ação' })).toBeTruthy();
  });

  it('adapter SPA: clique primário intercepta; modifier/target=_blank seguem nativo', () => {
    const navigate = vi.fn();
    const { getByRole } = render(
      inList(<NavigationItem label="Produção" link={{ href: '/producao', navigate }} />),
    );
    const anchor = getByRole('link');
    fireEvent.click(anchor, { button: 0 });
    expect(navigate).toHaveBeenCalledTimes(1);
    fireEvent.click(anchor, { button: 0, ctrlKey: true });
    expect(navigate).toHaveBeenCalledTimes(1); // ctrl+click = nativo
  });

  it('current: aria-current=page + data-current (indicador por posição)', () => {
    const { getByRole } = render(
      inList(<NavigationItem label="Painel" link={{ href: '/' }} current />),
    );
    const anchor = getByRole('link');
    expect(anchor.getAttribute('aria-current')).toBe('page');
    expect(anchor.getAttribute('data-current')).toBe('true');
  });

  it('disabled vs unavailable vs pending são estados distintos', () => {
    const onSelect = vi.fn();
    const { getByRole, rerender } = render(
      inList(<NavigationItem label="X" onSelect={onSelect} disabled />),
    );
    const btn = getByRole('button');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    rerender(inList(<NavigationItem label="X" onSelect={onSelect} unavailable />));
    expect(getByRole('button').getAttribute('data-unavailable')).toBe('true');
    expect(getByRole('button').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
    rerender(inList(<NavigationItem label="X" onSelect={onSelect} pending />));
    expect(getByRole('button').getAttribute('data-pending')).toBe('true');
    expect(getByRole('button').querySelector('.t-spinner')).not.toBeNull();
  });

  it('badge e ícone renderizados; ícone decorativo', () => {
    const { getByRole, getByText } = render(
      inList(
        <NavigationItem
          label="Tarefas"
          icon={<span data-testid="ico">i</span>}
          badge={<span>3</span>}
          onSelect={() => undefined}
        />,
      ),
    );
    expect(getByRole('button').querySelector('.t-navitem-icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(getByText('3')).toBeTruthy();
  });
});

describe('NavigationGroup', () => {
  it('conteúdo persistente por padrão (sem colapso)', () => {
    const { getByRole, queryByRole } = render(
      withTheme(
        <ul>
          <NavigationGroup title="Operação">
            <NavigationItem label="Pesagem" onSelect={() => undefined} />
          </NavigationGroup>
        </ul>,
      ),
    );
    expect(getByRole('button', { name: 'Pesagem' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Operação' })).toBeNull(); // header não interativo
  });

  it('colapsável: fechado por default oculta sublista; clique expande', () => {
    const { getByRole, queryByRole } = render(
      withTheme(
        <ul>
          <NavigationGroup title="Operação" collapsible defaultExpanded={false}>
            <NavigationItem label="Pesagem" onSelect={() => undefined} />
          </NavigationGroup>
        </ul>,
      ),
    );
    expect(queryByRole('button', { name: 'Pesagem' })).toBeNull();
    const header = getByRole('button', { name: 'Operação' });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(getByRole('button', { name: 'Pesagem' })).toBeTruthy();
  });

  it('modo controlado segue somente o prop expanded', () => {
    const onExpandedChange = vi.fn();
    const { getByRole, queryByRole } = render(
      withTheme(
        <ul>
          <NavigationGroup
            title="G"
            collapsible
            expanded={false}
            onExpandedChange={onExpandedChange}
          >
            <NavigationItem label="Item" onSelect={() => undefined} />
          </NavigationGroup>
        </ul>,
      ),
    );
    fireEvent.click(getByRole('button', { name: 'G' }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(queryByRole('button', { name: 'Item' })).toBeNull(); // controlado
  });

  it('profundidade acima de 2 lança erro orientado (Progressive Disclosure)', () => {
    expect(() =>
      render(
        withTheme(
          <ul>
            <NavigationGroup title="N1">
              <NavigationGroup title="N2">
                <NavigationGroup title="N3">
                  <NavigationItem label="fundo" onSelect={() => undefined} />
                </NavigationGroup>
              </NavigationGroup>
            </NavigationGroup>
          </ul>,
        ),
      ),
    ).toThrow(NavigationDepthExceededError);
  });

  it('SSR: markup determinístico', () => {
    const ui = withTheme(
      <ul>
        <NavigationGroup title="Operação">
          <NavigationItem label="Pesagem" link={{ href: '/p' }} current />
        </NavigationGroup>
      </ul>,
    );
    expect(renderToString(ui)).toBe(renderToString(ui));
  });
});
