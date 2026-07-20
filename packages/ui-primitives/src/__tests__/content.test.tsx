// Badge, Chip, Avatar, Spinner, Skeleton, Divider, Heading, Text, Label, Icon.

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  Avatar,
  Badge,
  Chip,
  Divider,
  Heading,
  Icon,
  Label,
  Skeleton,
  Spinner,
  Text,
  type IconDefinition,
} from '../index.js';

const fixtureIcon: IconDefinition = { name: 'dot', viewBox: '0 0 8 8', path: 'M4 0a4 4 0 100 8' };

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Badge — status multidimensional (P5)', () => {
  it.each([
    ['success', 'circle'],
    ['info', 'circle'],
    ['warn', 'triangle'],
    ['error', 'square'],
    ['critical', 'triangle'],
    ['neutral', 'square'],
  ] as const)('status %s expõe forma %s além da cor', (status, shape) => {
    const { container } = render(withTheme(<Badge status={status}>st</Badge>));
    const marker = container.querySelector('.t-badge-marker');
    expect(container.querySelector('.t-badge')?.getAttribute('data-status')).toBe(status);
    expect(marker?.getAttribute('data-shape')).toBe(shape);
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Chip — interativo, distinto de Badge', () => {
  it('expõe seleção via aria-pressed', () => {
    const { getByRole, rerender } = render(withTheme(<Chip selected>F</Chip>));
    expect(getByRole('button').getAttribute('aria-pressed')).toBe('true');
    rerender(withTheme(<Chip selected={false}>F</Chip>));
    expect(getByRole('button').getAttribute('aria-pressed')).toBe('false');
  });

  it('remoção acessível: botão separado com rótulo e callback próprio', () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    const { getByRole } = render(
      withTheme(
        <Chip onClick={onClick} onRemove={onRemove} removeLabel="Remover filtro">
          Congelados
        </Chip>,
      ),
    );
    fireEvent.click(getByRole('button', { name: 'Remover filtro' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Avatar', () => {
  it('iniciais determinísticas a partir do nome', () => {
    const { container } = render(withTheme(<Avatar name="Maria da Silva" />));
    expect(container.querySelector('.t-avatar')?.textContent).toBe('MS');
  });

  it('nome acessível por padrão; decorativo esconde', () => {
    const { getByRole, rerender, container } = render(withTheme(<Avatar name="Ana Reis" />));
    expect(getByRole('img', { name: 'Ana Reis' })).toBeTruthy();
    rerender(withTheme(<Avatar name="Ana Reis" decorative />));
    expect(container.querySelector('.t-avatar')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('erro de imagem cai para iniciais', () => {
    const { container } = render(withTheme(<Avatar name="Ana Reis" src="http://x/void.png" />));
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.t-avatar')?.textContent).toBe('AR');
  });
});

describe('Spinner', () => {
  it('acessível por padrão: role=status com rótulo oculto', () => {
    const { getByRole } = render(withTheme(<Spinner />));
    expect(getByRole('status').textContent).toBe('Carregando');
  });

  it('decorative: sem role, aria-hidden', () => {
    const { container, queryByRole } = render(withTheme(<Spinner decorative />));
    expect(queryByRole('status')).toBeNull();
    expect(container.querySelector('.t-spinner')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Skeleton', () => {
  it('é invisível para leitores de tela e expõe a variante', () => {
    const { container } = render(withTheme(<Skeleton variant="circle" height={400} />));
    const el = container.querySelector('.t-skeleton');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(el?.getAttribute('data-variant')).toBe('circle');
  });
});

describe('Divider', () => {
  it('decorativo por padrão; semântico sob demanda', () => {
    const { container, rerender, getByRole } = render(withTheme(<Divider />));
    expect(container.querySelector('.t-divider')?.getAttribute('aria-hidden')).toBe('true');
    rerender(withTheme(<Divider decorative={false} orientation="vertical" />));
    expect(getByRole('separator').getAttribute('aria-orientation')).toBe('vertical');
  });
});

describe('Tipografia', () => {
  it('Heading separa nível semântico do visual', () => {
    const { container } = render(
      withTheme(
        <Heading level={2} visualLevel={4}>
          T
        </Heading>,
      ),
    );
    const h = container.querySelector('h2');
    expect(h).not.toBeNull();
    expect(h?.getAttribute('data-visual')).toBe('4');
  });

  it('Text expõe papel e tom como variantes semânticas', () => {
    const { getByText } = render(
      withTheme(
        <Text role="data" tone="secondary">
          42
        </Text>,
      ),
    );
    const el = getByText('42');
    expect(el.getAttribute('data-role')).toBe('data');
    expect(el.getAttribute('data-tone')).toBe('secondary');
  });

  it('Label associa via htmlFor com papel label', () => {
    const { getByText } = render(withTheme(<Label htmlFor="campo-1">Peso</Label>));
    const el = getByText('Peso') as HTMLLabelElement;
    expect(el.htmlFor).toBe('campo-1');
    expect(el.getAttribute('data-role')).toBe('label');
  });
});

describe('Icon — contrato tipado', () => {
  it('decorativo por padrão; com label vira role=img', () => {
    const { container, rerender, getByRole } = render(withTheme(<Icon icon={fixtureIcon} />));
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    rerender(withTheme(<Icon icon={fixtureIcon} label="Ponto" />));
    expect(getByRole('img', { name: 'Ponto' })).toBeTruthy();
  });

  it('renderiza exclusivamente o path da definição (sem SVG arbitrário)', () => {
    const { container } = render(withTheme(<Icon icon={fixtureIcon} />));
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 8 8');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe(fixtureIcon.path);
    expect(svg?.getAttribute('data-icon')).toBe('dot');
  });
});
