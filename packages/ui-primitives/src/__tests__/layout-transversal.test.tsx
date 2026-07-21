// Transversais 6.3.7: SSR/hidratação real, modos runtime, axe nas
// composições obrigatórias (§37), API pública, folha disciplinada.

import { act, render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StrictMode, type ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PREFERENCES, ThemeProvider } from '@tauros/theme';

import * as publicApi from '../index.js';
import {
  AppShell,
  Breadcrumb,
  Button,
  Container,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  NavigationBar,
  NavigationItem,
  Page,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ResponsiveGrid,
  Section,
  Sidebar,
  SplitView,
  StickyRegion,
  taurosUiStyles,
  TopBar,
} from '../index.js';

function fullShell(): ReactElement {
  return (
    <AppShell
      skipLink={{ label: 'Ir para o conteúdo', targetId: 'main-content' }}
      topBar={<TopBar title="Tauros OS" actions={<Button size="sm">Nova tarefa</Button>} />}
      sidebar={
        <Sidebar>
          <NavigationItem label="Produção" link={{ href: '/producao' }} current />
          <NavigationItem label="Estoque" link={{ href: '/estoque' }} />
        </Sidebar>
      }
    >
      <Page id="main-content">
        <PageHeader
          title="Produção do dia"
          breadcrumb={
            <Breadcrumb items={[{ label: 'Início', link: { href: '/' } }, { label: 'Produção' }]} />
          }
          actions={<Button>Iniciar</Button>}
        />
        <Container size="wide">
          <Section title="Painéis">
            <Panel>
              <PanelHeader title="Tarefas" />
              <PanelBody>corpo</PanelBody>
            </Panel>
          </Section>
        </Container>
      </Page>
    </AppShell>
  );
}

describe('SSR e hidratação (componentes estruturais)', () => {
  it('renderToString determinístico para a composição completa', () => {
    const ui = <ThemeProvider>{fullShell()}</ThemeProvider>;
    const html = renderToString(ui);
    expect(html).toBe(renderToString(ui));
    expect(html).toContain('t-shell');
    expect(html).toContain('t-pageheader');
  });

  it('hydrateRoot sem mismatch (AppShell, Page, PageHeader, Grid, Split, Sticky)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ui = (
      <StrictMode>
        <ThemeProvider>
          <div>
            {fullShell()}
            <ResponsiveGrid>
              <div>a</div>
              <div>b</div>
            </ResponsiveGrid>
            <SplitView primary={<p>l</p>} secondary={<p>d</p>} />
            <StickyRegion position="bottom">
              <Button>Salvar</Button>
            </StickyRegion>
          </div>
        </ThemeProvider>
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
  ])('renderiza layouts sob modo %s', (_name, patch) => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const { container } = render(
      <ThemeProvider defaultPreferences={{ ...DEFAULT_PREFERENCES, ...patch }} target={target}>
        {fullShell()}
      </ThemeProvider>,
    );
    expect(container.querySelector('.t-shell')).not.toBeNull();
    target.remove();
  });
});

describe('API pública e folha', () => {
  it('internos de layout NÃO são exportados', () => {
    const names = Object.keys(publicApi);
    for (const forbidden of ['MainLandmarkContext', 'useMainLandmarkGuard']) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('import não injeta CSS; folha sem z-index/cor literais nas seções de layout', () => {
    expect(document.getElementById('tauros-ui-styles')).toBeNull();
    const layouts = taurosUiStyles.split('===== Layouts (6.3.7)')[1] as string;
    expect(layouts).toContain('var(--tauros-z-sticky)');
    expect(layouts).not.toMatch(/z-index:\s*\d/);
    expect(layouts).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('axe — composições obrigatórias (§37)', () => {
  it('1: AppShell + Sidebar + TopBar + Page + PageHeader + Section + Panel', async () => {
    const { container } = render(<ThemeProvider>{fullShell()}</ThemeProvider>);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('2: AppShell móvel com TopBar + NavigationBar', async () => {
    const { container } = render(
      <ThemeProvider>
        <AppShell
          topBar={<TopBar title="Tauros OS" />}
          navigationBar={
            <NavigationBar>
              <NavigationItem label="Início" link={{ href: '/' }} current />
              <NavigationItem label="Tarefas" link={{ href: '/t' }} />
            </NavigationBar>
          }
        >
          <Page>conteúdo móvel</Page>
        </AppShell>
      </ThemeProvider>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it('3: Page + PageHeader + ResponsiveGrid com estados de região', async () => {
    const { container } = render(
      <ThemeProvider>
        <Page>
          <PageHeader title="Painéis" />
          <ResponsiveGrid>
            <Panel>
              <PanelBody>
                <LoadingState label="Carregando painel" />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelBody>
                <EmptyState title="Sem dados" />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelBody>
                <ErrorState title="Falha" retryAction={<Button>Tentar novamente</Button>} />
              </PanelBody>
            </Panel>
          </ResponsiveGrid>
        </Page>
      </ThemeProvider>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it('4: SplitView mestre/detalhe', async () => {
    const { container } = render(
      <ThemeProvider>
        <Page>
          <SplitView
            primary={
              <Section title="Cortes">
                <ul>
                  <li>Picanha</li>
                  <li>Alcatra</li>
                </ul>
              </Section>
            }
            secondary={<Section title="Detalhe">Selecione um corte</Section>}
          />
        </Page>
      </ThemeProvider>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it('5: formulário longo com StickyRegion de ações', async () => {
    const { container } = render(
      <ThemeProvider>
        <Page>
          <PageHeader title="Cadastro de corte" />
          <Container size="narrow">
            <form aria-label="Cadastro">
              <Field label="Nome do corte">
                <Input />
              </Field>
              <Field label="Descrição">
                <Input />
              </Field>
            </form>
          </Container>
          <StickyRegion position="bottom">
            <Button>Salvar</Button>
            <Button variant="secondary">Cancelar</Button>
          </StickyRegion>
        </Page>
      </ThemeProvider>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
