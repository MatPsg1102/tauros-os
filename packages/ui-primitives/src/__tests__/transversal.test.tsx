// Testes transversais (6.3.3): renderização sob ThemeProvider, SSR,
// polimorfismo, refs, merge de className, props nativas e disciplina
// de tokens na folha de estilos.

import { render } from '@testing-library/react';
import { createRef, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Flex,
  Grid,
  Heading,
  Icon,
  IconButton,
  injectUiStyles,
  Label,
  Skeleton,
  Spacer,
  Spinner,
  Stack,
  Surface,
  taurosUiStyles,
  Text,
  type IconDefinition,
} from '../index.js';

const fixtureIcon: IconDefinition = {
  name: 'test-check',
  viewBox: '0 0 16 16',
  path: 'M2 8l4 4 8-8',
};

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

function allPrimitives(): ReactElement {
  return (
    <Stack gap={200}>
      <Heading level={1}>Título</Heading>
      <Text>Corpo</Text>
      <Label htmlFor="x">Rótulo</Label>
      <Box padding="md">caixa</Box>
      <Flex gap={100}>
        <Badge status="success">OK</Badge>
        <Chip selected>Filtro</Chip>
      </Flex>
      <Grid columns={3} gap={100}>
        <Card>c1</Card>
        <Surface elevation="sheet">s1</Surface>
      </Grid>
      <Spacer size={200} />
      <Divider />
      <Icon icon={fixtureIcon} />
      <Button>Confirmar</Button>
      <IconButton aria-label="Fechar">
        <Icon icon={fixtureIcon} />
      </IconButton>
      <Avatar name="Maria Silva" />
      <Spinner />
      <Skeleton variant="rect" height={400} width="100%" />
    </Stack>
  );
}

describe('transversal — renderização', () => {
  it('renderiza os 19 primitivos sob ThemeProvider sem erro', () => {
    const { container } = render(withTheme(allPrimitives()));
    expect(container.querySelectorAll('.t-btn').length).toBeGreaterThan(0);
  });

  it('SSR: renderToString produz markup sem tocar APIs de browser', () => {
    const html = renderToString(withTheme(allPrimitives()));
    expect(html).toContain('t-heading');
    expect(html).toContain('t-badge');
  });
});

describe('transversal — contratos de API', () => {
  it('faz merge de className preservando as classes do componente', () => {
    const { getByRole } = render(withTheme(<Button className="minha-classe">Ok</Button>));
    const btn = getByRole('button');
    expect(btn.classList.contains('t-btn')).toBe(true);
    expect(btn.classList.contains('minha-classe')).toBe(true);
  });

  it('encaminha ref para o elemento DOM real (forwardRef)', () => {
    const ref = createRef<HTMLButtonElement>();
    render(withTheme(<Button ref={ref}>Ok</Button>));
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('preserva props nativas (id, data-*, aria-*)', () => {
    const { getByTestId } = render(
      withTheme(
        <Text data-testid="t" id="texto-1" aria-live="polite">
          x
        </Text>,
      ),
    );
    const el = getByTestId('t');
    expect(el.id).toBe('texto-1');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('polimorfismo: as muda o elemento renderizado', () => {
    const { getByTestId } = render(
      withTheme(
        <>
          <Box as="section" data-testid="b">
            s
          </Box>
          <Text as="p" data-testid="p">
            p
          </Text>
          <Surface as="article" data-testid="a">
            a
          </Surface>
        </>,
      ),
    );
    expect(getByTestId('b').tagName).toBe('SECTION');
    expect(getByTestId('p').tagName).toBe('P');
    expect(getByTestId('a').tagName).toBe('ARTICLE');
  });
});

describe('transversal — disciplina de tokens', () => {
  it('folha de estilos referencia somente variáveis --tauros (sem cores literais)', () => {
    expect(taurosUiStyles).toContain('var(--tauros-');
    expect(taurosUiStyles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(taurosUiStyles).not.toMatch(/\brgba?\(/);
  });

  it('injectUiStyles é idempotente', () => {
    injectUiStyles(document);
    injectUiStyles(document);
    expect(document.querySelectorAll('#tauros-ui-styles')).toHaveLength(1);
  });
});
