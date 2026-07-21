// Panel, ResponsiveGrid, SplitView, StickyRegion, AppShell (6.3.7 §8/§13–§18).

import { render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  AppShell,
  Button,
  ErrorState,
  LoadingState,
  NavigationBar,
  NavigationItem,
  Page,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  ResponsiveGrid,
  Sidebar,
  SplitView,
  StickyRegion,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  taurosUiStyles,
  TopBar,
} from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Panel', () => {
  it('composição header/body/footer sobre Surface; body é a região rolável', () => {
    const { container, getByRole } = render(
      withTheme(
        <Panel fill>
          <PanelHeader title="Tarefas do turno" actions={<Button size="sm">Nova</Button>} />
          <PanelBody>conteúdo longo</PanelBody>
          <PanelFooter>
            <Button size="sm" variant="secondary">
              Fechar
            </Button>
          </PanelFooter>
        </Panel>,
      ),
    );
    const panel = container.querySelector('.t-panel') as HTMLElement;
    expect(panel.classList.contains('t-surface')).toBe(true); // compõe Surface
    expect(panel.getAttribute('data-fill')).toBe('true');
    expect(getByRole('heading', { level: 3, name: 'Tarefas do turno' })).toBeTruthy();
    expect(container.querySelector('.t-panel-body')).not.toBeNull();
    expect(taurosUiStyles).toContain('.t-panel-body { flex: 1; min-height: 0; overflow-y: auto;');
  });

  it('acomoda estados de região e Tabs sem acoplamento', () => {
    const { getByRole, rerender } = render(
      withTheme(
        <Panel>
          <PanelBody>
            <LoadingState label="Carregando tarefas" />
          </PanelBody>
        </Panel>,
      ),
    );
    expect(getByRole('status').textContent).toContain('Carregando tarefas');
    rerender(
      withTheme(
        <Panel>
          <PanelBody>
            <ErrorState title="Falha ao carregar" />
          </PanelBody>
        </Panel>,
      ),
    );
    expect(getByRole('alert').textContent).toContain('Falha ao carregar');
    rerender(
      withTheme(
        <Panel>
          <PanelHeader>
            <Tabs defaultValue="a">
              <TabList aria-label="Visões">
                <Tab value="a">Hoje</Tab>
                <Tab value="b">Semana</Tab>
              </TabList>
              <TabPanel value="a">hoje</TabPanel>
              <TabPanel value="b">semana</TabPanel>
            </Tabs>
          </PanelHeader>
        </Panel>,
      ),
    );
    expect(getByRole('tablist', { name: 'Visões' })).toBeTruthy();
  });
});

describe('ResponsiveGrid', () => {
  it('medida de item semântica + gap tokenizado; filhos com min-width 0 na folha', () => {
    const { getByTestId } = render(
      withTheme(
        <ResponsiveGrid itemSize="sm" gap={100} data-testid="g">
          <div>1</div>
        </ResponsiveGrid>,
      ),
    );
    const grid = getByTestId('g');
    expect(grid.getAttribute('data-item-size')).toBe('sm');
    expect(grid.style.gap).toBe('var(--tauros-space-gap-100)');
    expect(taurosUiStyles).toContain('repeat(auto-fit, minmax(min(100%, 20ch), 1fr))');
    expect(taurosUiStyles).toContain('.t-rgrid > * { min-width: 0; }');
  });

  it.each([0, 1, 2, 12])('renderiza com %s itens sem erro', (count) => {
    const { getByTestId } = render(
      withTheme(
        <ResponsiveGrid data-testid="g">
          {Array.from({ length: count }, (_, i) => (
            <div key={i}>Item com nome bem longo de corte bovino {i}</div>
          ))}
        </ResponsiveGrid>,
      ),
    );
    expect(getByTestId('g').children).toHaveLength(count);
  });
});

describe('SplitView', () => {
  it('regiões primária/secundária em ordem DOM de leitura; ratio e orientação', () => {
    const { getByTestId } = render(
      withTheme(
        <SplitView
          data-testid="s"
          ratio="1:2"
          orientation="horizontal"
          primary={<div>lista</div>}
          secondary={<div>detalhe</div>}
        />,
      ),
    );
    const split = getByTestId('s');
    expect(split.getAttribute('data-ratio')).toBe('1:2');
    expect(split.children[0]?.textContent).toBe('lista'); // primária primeiro (leitura)
    expect(split.children[1]?.textContent).toBe('detalhe');
  });

  it('colapso responsivo vem da folha (media query com token, sem JS)', () => {
    expect(taurosUiStyles).toContain(
      "@media (max-width: 768px) {\n  .t-split[data-orientation='horizontal'] { grid-template-columns: 1fr; }",
    );
  });

  it('vertical usa linhas; SSR determinístico', () => {
    const ui = withTheme(
      <SplitView orientation="vertical" ratio="1:1" primary={<p>a</p>} secondary={<p>b</p>} />,
    );
    const html = renderToString(ui);
    expect(html).toBe(renderToString(ui));
    expect(html).toContain('data-orientation="vertical"');
  });
});

describe('StickyRegion', () => {
  it('top e bottom com z-index tokenizado e safe area apenas no bottom', () => {
    const { getByTestId, rerender } = render(
      withTheme(
        <StickyRegion position="top" data-testid="sr">
          filtros
        </StickyRegion>,
      ),
    );
    expect(getByTestId('sr').getAttribute('data-position')).toBe('top');
    rerender(
      withTheme(
        <StickyRegion position="bottom" data-testid="sr">
          <Button>Salvar</Button>
        </StickyRegion>,
      ),
    );
    expect(getByTestId('sr').getAttribute('data-position')).toBe('bottom');
    expect(taurosUiStyles).toContain(
      '.t-stickyregion {\n  position: sticky; z-index: var(--tauros-z-sticky);',
    );
    // safe area só na variante bottom (uma única aplicação)
    const bottomRule = taurosUiStyles.split(".t-stickyregion[data-position='bottom']")[1] ?? '';
    expect(bottomRule).toContain('env(safe-area-inset-bottom)');
  });
});

describe('AppShell', () => {
  it('slots estruturais; UMA região de scroll; sem storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { getByRole, container } = render(
      withTheme(
        <AppShell
          skipLink={{ label: 'Ir para o conteúdo', targetId: 'conteudo' }}
          topBar={<TopBar title="Tauros OS" />}
          sidebar={
            <Sidebar>
              <NavigationItem label="Estoque" link={{ href: '/estoque' }} current />
            </Sidebar>
          }
          navigationBar={
            <NavigationBar>
              <NavigationItem label="Início" link={{ href: '/' }} current />
            </NavigationBar>
          }
        >
          <Page id="conteudo">conteúdo</Page>
        </AppShell>,
      ),
    );
    expect(getByRole('banner')).toBeTruthy();
    expect(getByRole('navigation', { name: 'Navegação principal' })).toBeTruthy();
    expect(getByRole('main').id).toBe('conteudo');
    const skip = getByRole('link', { name: 'Ir para o conteúdo' }) as HTMLAnchorElement;
    expect(skip.getAttribute('href')).toBe('#conteudo');
    expect(container.querySelectorAll('main')).toHaveLength(1);
    // única região de scroll: shell overflow hidden + content overflow-y auto
    expect(taurosUiStyles).toContain('height: 100vh; height: 100dvh;\n  overflow: hidden;');
    expect(taurosUiStyles).toContain(
      '.t-shell-content { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; }',
    );
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('safe areas aplicadas UMA vez pelo shell (NavigationBar sem fixed no slot)', () => {
    const { getByRole } = render(
      withTheme(
        <AppShell
          navigationBar={
            <NavigationBar>
              <NavigationItem label="Início" link={{ href: '/' }} />
            </NavigationBar>
          }
        >
          <Page>x</Page>
        </AppShell>,
      ),
    );
    // barra no slot NÃO usa data-fixed (o shell posiciona e aplica a safe area)
    expect(getByRole('navigation').getAttribute('data-fixed')).toBeNull();
    const shellNavRule = taurosUiStyles.split('.t-shell-navbar {')[1]?.split('}')[0] ?? '';
    expect(shellNavRule).toContain('env(safe-area-inset-bottom)');
  });

  it('composições sem sidebar/topbar funcionam (nenhuma estrutura assumida)', () => {
    const { getByRole } = render(
      withTheme(
        <AppShell>
          <Page>solo</Page>
        </AppShell>,
      ),
    );
    expect(getByRole('main').textContent).toBe('solo');
  });
});
