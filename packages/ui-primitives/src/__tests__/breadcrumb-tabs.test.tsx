// Breadcrumb e Tabs (6.3.6 §7/§8).

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { Breadcrumb, Tab, TabList, TabPanel, Tabs } from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Breadcrumb', () => {
  const items = [
    { label: 'Início', link: { href: '/' } },
    { label: 'Estoque', link: { href: '/estoque' } },
    { label: 'Cortes bovinos' },
  ];

  it('nav > ol; intermediários são links; atual com aria-current=page', () => {
    const { getByRole, getAllByRole } = render(withTheme(<Breadcrumb items={items} />));
    const nav = getByRole('navigation', { name: 'Trilha de navegação' });
    expect(nav.querySelector('ol')).not.toBeNull();
    expect(getAllByRole('link')).toHaveLength(2);
    const current = nav.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe('Cortes bovinos');
    expect(current?.tagName).toBe('SPAN');
  });

  it('separador é decorativo (CSS ::before — fora da árvore acessível)', () => {
    const { getByRole } = render(withTheme(<Breadcrumb items={items} />));
    // nenhum elemento de separador no DOM (conteúdo vem de CSS)
    expect(getByRole('navigation').textContent).toBe('InícioEstoqueCortes bovinos');
  });

  it('item único é o atual; último com link ainda é atual (não navegável)', () => {
    const { getByRole, queryAllByRole, rerender } = render(
      withTheme(<Breadcrumb items={[{ label: 'Só um' }]} />),
    );
    expect(getByRole('navigation').querySelector('[aria-current="page"]')?.textContent).toBe(
      'Só um',
    );
    rerender(
      withTheme(
        <Breadcrumb
          items={[
            { label: 'A', link: { href: '/a' } },
            { label: 'B', link: { href: '/b' } },
          ]}
        />,
      ),
    );
    expect(queryAllByRole('link')).toHaveLength(1);
  });

  it('adapter SPA nos links intermediários', () => {
    const navigate = vi.fn();
    const { getAllByRole } = render(
      withTheme(
        <Breadcrumb
          items={[{ label: 'Início', link: { href: '/', navigate } }, { label: 'Atual' }]}
        />,
      ),
    );
    fireEvent.click(getAllByRole('link')[0] as HTMLElement, { button: 0 });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('SSR determinístico', () => {
    const ui = withTheme(<Breadcrumb items={items} />);
    expect(renderToString(ui)).toBe(renderToString(ui));
  });
});

describe('Tabs', () => {
  function makeTabs(
    props: { activation?: 'automatic' | 'manual'; value?: string } = {},
  ): ReactElement {
    return withTheme(
      <Tabs
        {...(props.value !== undefined ? { value: props.value } : { defaultValue: 'a' })}
        {...(props.activation !== undefined ? { activation: props.activation } : {})}
      >
        <TabList aria-label="Seções">
          <Tab value="a">Aba A</Tab>
          <Tab value="b">Aba B</Tab>
          <Tab value="c" disabled>
            Aba C
          </Tab>
        </TabList>
        <TabPanel value="a">Painel A</TabPanel>
        <TabPanel value="b">Painel B</TabPanel>
        <TabPanel value="c">Painel C</TabPanel>
      </Tabs>,
    );
  }

  it('ARIA completa: tablist, aria-selected, aria-controls/labelledby, roving tabindex', () => {
    const { getByRole } = render(makeTabs());
    const tabA = getByRole('tab', { name: 'Aba A' });
    const tabB = getByRole('tab', { name: 'Aba B' });
    expect(getByRole('tablist', { name: 'Seções' })).toBeTruthy();
    expect(tabA.getAttribute('aria-selected')).toBe('true');
    expect(tabA.tabIndex).toBe(0);
    expect(tabB.tabIndex).toBe(-1);
    const panel = getByRole('tabpanel');
    expect(panel.id).toBe(tabA.getAttribute('aria-controls'));
    expect(panel.getAttribute('aria-labelledby')).toBe(tabA.id);
    expect(panel.textContent).toBe('Painel A');
  });

  it('setas navegam pulando disabled; Home/End; ativação automática', () => {
    const { getByRole } = render(makeTabs());
    const tablist = getByRole('tablist');
    const tabA = getByRole('tab', { name: 'Aba A' });
    const tabB = getByRole('tab', { name: 'Aba B' });
    tabA.focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabB);
    expect(tabB.getAttribute('aria-selected')).toBe('true'); // automática
    // ArrowRight de B pula C (disabled) e volta a A
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabA);
    fireEvent.keyDown(tablist, { key: 'End' });
    expect(document.activeElement).toBe(tabB);
    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(document.activeElement).toBe(tabA);
  });

  it('ativação manual: seta move foco sem selecionar; Enter seleciona', () => {
    const { getByRole } = render(makeTabs({ activation: 'manual' }));
    const tablist = getByRole('tablist');
    const tabA = getByRole('tab', { name: 'Aba A' });
    const tabB = getByRole('tab', { name: 'Aba B' });
    tabA.focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabB);
    expect(tabB.getAttribute('aria-selected')).toBe('false');
    fireEvent.keyDown(tabB, { key: 'Enter' });
    expect(tabB.getAttribute('aria-selected')).toBe('true');
  });

  it('controlled segue somente o prop', () => {
    const { getByRole } = render(makeTabs({ value: 'b' }));
    expect(getByRole('tab', { name: 'Aba B' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(getByRole('tab', { name: 'Aba A' }));
    expect(getByRole('tab', { name: 'Aba A' }).getAttribute('aria-selected')).toBe('false');
  });

  it('SSR determinístico com IDs estáveis; painéis inativos ficam hidden', () => {
    const html = renderToString(makeTabs());
    expect(html).toBe(renderToString(makeTabs()));
    expect(html).toContain('hidden');
  });
});
