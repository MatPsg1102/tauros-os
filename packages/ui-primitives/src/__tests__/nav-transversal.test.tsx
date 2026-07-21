// Transversais 6.3.6: SSR/hidratação, modos runtime, axe, API pública.

import { act, render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StrictMode, type ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PREFERENCES, ThemeProvider } from '@tauros/theme';

import * as publicApi from '../index.js';
import {
  Badge,
  Breadcrumb,
  Button,
  Fab,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  NavigationBar,
  NavigationGroup,
  NavigationItem,
  Pagination,
  SegmentedControl,
  Sidebar,
  Stepper,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TopBar,
} from '../index.js';

function navTree(): ReactElement {
  return (
    <div>
      <TopBar title="Produção" actions={<Button size="sm">Nova tarefa</Button>} />
      <Breadcrumb items={[{ label: 'Início', link: { href: '/' } }, { label: 'Produção' }]} />
      <Sidebar>
        <NavigationGroup title="Operação">
          <NavigationItem
            label="Pesagem"
            link={{ href: '/pesagem' }}
            current
            badge={<Badge status="info">2</Badge>}
          />
          <NavigationItem label="Etiquetas" link={{ href: '/etiquetas' }} />
        </NavigationGroup>
      </Sidebar>
      <Tabs defaultValue="a">
        <TabList aria-label="Seções">
          <Tab value="a">Resumo</Tab>
          <Tab value="b">Detalhes</Tab>
        </TabList>
        <TabPanel value="a">conteúdo</TabPanel>
        <TabPanel value="b">outro</TabPanel>
      </Tabs>
      <Stepper
        steps={[
          { label: 'Pesagem', status: 'completed' },
          { label: 'Etiqueta', status: 'current' },
        ]}
      />
      <Pagination currentPage={2} totalPages={5} />
      <SegmentedControl
        aria-label="Período"
        options={[
          { value: 'dia', label: 'Dia' },
          { value: 'semana', label: 'Semana' },
        ]}
        defaultValue="dia"
      />
      <NavigationBar>
        <NavigationItem label="Início" link={{ href: '/' }} current />
      </NavigationBar>
      <Fab label="Nova pesagem" icon={<span>+</span>} />
      <Menu>
        <MenuTrigger>Ações</MenuTrigger>
        <MenuContent aria-label="Ações">
          <MenuItem onSelect={() => undefined}>Editar</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

describe('SSR e hidratação', () => {
  it('renderToString determinístico; overlays não emitem no servidor', () => {
    const ui = <ThemeProvider>{navTree()}</ThemeProvider>;
    const html = renderToString(ui);
    expect(html).toBe(renderToString(ui));
    expect(html).toContain('t-sidebar');
    expect(html).not.toContain('role="menu"');
  });

  it('hidrata sem mismatch', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ui = (
      <StrictMode>
        <ThemeProvider>{navTree()}</ThemeProvider>
      </StrictMode>
    );
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.innerHTML = renderToString(ui);
    await act(async () => {
      hydrateRoot(host, ui);
    });
    expect(errors.mock.calls.filter((c) => String(c[0]).includes('hydrat'))).toEqual([]);
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
  ])('renderiza navegação sob modo %s', (_name, patch) => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const { container } = render(
      <ThemeProvider defaultPreferences={{ ...DEFAULT_PREFERENCES, ...patch }} target={target}>
        {navTree()}
      </ThemeProvider>,
    );
    expect(container.querySelector('.t-sidebar')).not.toBeNull();
    target.remove();
  });
});

describe('API pública', () => {
  it('internos de navegação NÃO são exportados', () => {
    const names = Object.keys(publicApi);
    for (const forbidden of [
      'handleAdapterClick',
      'isNativeNavigationClick',
      'SidebarContext',
      'MenuContext',
      'useMenuContext',
      'positionOverlayAtPoint',
      'tabId',
      'panelId',
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });
});

describe('axe — navegação sem violações', () => {
  it('composição estrutural (TopBar, Breadcrumb, Sidebar, Tabs, Stepper, Pagination…)', async () => {
    const { container } = render(<ThemeProvider>{navTree()}</ThemeProvider>);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('menu aberto', async () => {
    render(
      <ThemeProvider>
        <Menu defaultOpen>
          <MenuTrigger>Ações</MenuTrigger>
          <MenuContent aria-label="Ações do item">
            <MenuItem onSelect={() => undefined}>Editar</MenuItem>
            <MenuItem onSelect={() => undefined}>Duplicar</MenuItem>
          </MenuContent>
        </Menu>
      </ThemeProvider>,
    );
    // escopo no próprio menu: a regra 'region' (landmarks) é responsabilidade
    // da PÁGINA do aplicativo, não do conteúdo portalizado do componente
    const menu = document.body.querySelector('[role="menu"]') as HTMLElement;
    expect((await axe(menu)).violations).toEqual([]);
  });
});
