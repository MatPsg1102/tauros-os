// Page, Container, PageHeader, Section (6.3.7 §9–§12).

import { render } from '@testing-library/react';
import { createRef, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  Badge,
  Breadcrumb,
  Button,
  Container,
  MultipleMainLandmarksError,
  Page,
  PageHeader,
  Section,
} from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Page', () => {
  it('landmark main por default; section e div por composição', () => {
    const { getByRole, rerender, container } = render(withTheme(<Page>conteúdo</Page>));
    expect(getByRole('main').classList.contains('t-page')).toBe(true);
    rerender(withTheme(<Page as="section">c</Page>));
    expect(container.querySelector('section.t-page')).not.toBeNull();
    expect(container.querySelector('main')).toBeNull();
    rerender(withTheme(<Page as="div">c</Page>));
    expect(container.querySelector('div.t-page')).not.toBeNull();
  });

  it('dois main aninhados lançam erro orientado; main + section é válido', () => {
    expect(() =>
      render(
        withTheme(
          <Page>
            <Page>interno</Page>
          </Page>,
        ),
      ),
    ).toThrow(MultipleMainLandmarksError);

    const { getAllByRole, getByRole } = render(
      withTheme(
        <Page aria-label="Tela">
          <Page as="section" aria-label="Região">
            interno
          </Page>
        </Page>,
      ),
    );
    expect(getAllByRole('main')).toHaveLength(1);
    expect(getByRole('region', { name: 'Região' })).toBeTruthy();
  });

  it('densidade estrutural exposta por data-attribute; ref e props nativas', () => {
    const ref = createRef<HTMLElement>();
    const { getByRole } = render(
      withTheme(
        <Page density="compact" data-testid="p" ref={ref}>
          x
        </Page>,
      ),
    );
    const page = getByRole('main');
    expect(page.getAttribute('data-density')).toBe('compact');
    expect(page.getAttribute('data-testid')).toBe('p');
    expect(ref.current).toBe(page);
  });
});

describe('Container', () => {
  it('tamanhos semânticos por data-attribute (largura via tokens na folha)', () => {
    const { getByTestId, rerender } = render(
      withTheme(
        <Container size="narrow" data-testid="c">
          texto
        </Container>,
      ),
    );
    expect(getByTestId('c').getAttribute('data-size')).toBe('narrow');
    for (const size of ['standard', 'wide', 'full'] as const) {
      rerender(
        withTheme(
          <Container size={size} data-testid="c">
            texto
          </Container>,
        ),
      );
      expect(getByTestId('c').getAttribute('data-size')).toBe(size);
    }
  });

  it('aninhamento não quebra (narrow dentro de wide)', () => {
    const { getByTestId } = render(
      withTheme(
        <Container size="wide">
          <Container size="narrow" data-testid="inner">
            leitura
          </Container>
        </Container>,
      ),
    );
    expect(getByTestId('inner')).toBeTruthy();
  });
});

describe('PageHeader', () => {
  it('slots completos: breadcrumb, eyebrow, título com nível, status, ações', () => {
    const { getByRole, getByText } = render(
      withTheme(
        <PageHeader
          title="Abertura de turno"
          headingLevel={1}
          eyebrow="Produção"
          description="Confira os dados antes de iniciar"
          breadcrumb={
            <Breadcrumb items={[{ label: 'Início', link: { href: '/' } }, { label: 'Turnos' }]} />
          }
          status={<Badge status="success">Ativo</Badge>}
          actions={<Button size="sm">Iniciar turno</Button>}
        />,
      ),
    );
    expect(getByRole('heading', { level: 1, name: 'Abertura de turno' })).toBeTruthy();
    expect(getByText('Produção')).toBeTruthy();
    expect(getByRole('navigation', { name: 'Trilha de navegação' })).toBeTruthy();
    expect(getByText('Ativo')).toBeTruthy();
    expect(getByRole('button', { name: 'Iniciar turno' })).toBeTruthy();
  });

  it('nível de heading configurável (sem heading rígido inadequado)', () => {
    const { getByRole } = render(withTheme(<PageHeader title="Sub" headingLevel={2} />));
    expect(getByRole('heading', { level: 2, name: 'Sub' })).toBeTruthy();
  });

  it('título longo não quebra a estrutura (overflow-wrap na folha)', () => {
    const longTitle = 'Conferência de recebimento de carcaças bovinas do fornecedor'.repeat(3);
    const { getByRole } = render(withTheme(<PageHeader title={longTitle} />));
    expect(getByRole('heading').textContent).toBe(longTitle);
  });
});

describe('Section', () => {
  it('com título: section nomeada via aria-labelledby apontando ao heading', () => {
    const { getByRole } = render(
      withTheme(
        <Section
          title="Resumo do turno"
          description="Números do dia"
          actions={<Button size="sm">Ver tudo</Button>}
        >
          corpo
        </Section>,
      ),
    );
    const region = getByRole('region', { name: 'Resumo do turno' });
    const heading = getByRole('heading', { name: 'Resumo do turno' });
    expect(region.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('sem título: sem heading vazio e sem landmark nomeado', () => {
    const { container, queryByRole } = render(withTheme(<Section>solto</Section>));
    expect(queryByRole('heading')).toBeNull();
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBeNull();
  });

  it('múltiplas seções coexistem com headings próprios', () => {
    const { getAllByRole } = render(
      withTheme(
        <Page>
          <Section title="A">1</Section>
          <Section title="B">2</Section>
        </Page>,
      ),
    );
    expect(getAllByRole('region')).toHaveLength(2);
  });

  it('SSR determinístico', () => {
    const ui = withTheme(
      <Page>
        <PageHeader title="T" />
        <Section title="S">x</Section>
      </Page>,
    );
    expect(renderToString(ui)).toBe(renderToString(ui));
  });
});
