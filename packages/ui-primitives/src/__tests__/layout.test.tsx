// Primitivos estruturais: Box, Stack, Flex, Grid, Spacer + utilitário cx.

import { render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { Box, cx, Flex, Grid, Spacer, Stack } from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('cx', () => {
  it('junta classes e descarta falsy', () => {
    expect(cx('a', undefined, false, null, 'b', '')).toBe('a b');
  });
});

describe('Box', () => {
  it('padding usa token de inset via CSS var', () => {
    const { getByTestId } = render(
      withTheme(
        <Box padding="lg" data-testid="b">
          x
        </Box>,
      ),
    );
    expect(getByTestId('b').style.padding).toBe('var(--tauros-space-inset-lg)');
  });

  it('sem padding não injeta estilo', () => {
    const { getByTestId } = render(withTheme(<Box data-testid="b">x</Box>));
    expect(getByTestId('b').style.padding).toBe('');
  });
});

describe('Stack', () => {
  it('gap tokenizado e direção coluna', () => {
    const { getByTestId } = render(
      withTheme(
        <Stack gap={300} align="center" data-testid="s">
          <span>a</span>
        </Stack>,
      ),
    );
    const el = getByTestId('s');
    expect(el.style.flexDirection).toBe('column');
    expect(el.style.gap).toBe('var(--tauros-space-gap-300)');
    expect(el.style.alignItems).toBe('center');
  });
});

describe('Flex', () => {
  it('mapeia align/justify/wrap para valores CSS', () => {
    const { getByTestId } = render(
      withTheme(
        <Flex justify="between" align="baseline" wrap data-testid="f">
          <span>a</span>
        </Flex>,
      ),
    );
    const el = getByTestId('f');
    expect(el.style.justifyContent).toBe('space-between');
    expect(el.style.alignItems).toBe('baseline');
    expect(el.style.flexWrap).toBe('wrap');
  });
});

describe('Grid', () => {
  it('colunas uniformes com gap tokenizado', () => {
    const { getByTestId } = render(
      withTheme(
        <Grid columns={4} gap={100} data-testid="g">
          <span>a</span>
        </Grid>,
      ),
    );
    const el = getByTestId('g');
    expect(el.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(el.style.gap).toBe('var(--tauros-space-gap-100)');
  });
});

describe('Spacer', () => {
  it('vertical usa height; horizontal usa width; sempre decorativo', () => {
    const { getByTestId, rerender } = render(withTheme(<Spacer size={400} data-testid="sp" />));
    let el = getByTestId('sp');
    expect(el.style.height).toBe('var(--tauros-space-gap-400)');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    rerender(withTheme(<Spacer size={400} axis="horizontal" data-testid="sp" />));
    el = getByTestId('sp');
    expect(el.style.width).toBe('var(--tauros-space-gap-400)');
  });
});
