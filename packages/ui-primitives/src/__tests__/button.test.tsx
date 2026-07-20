// Button/IconButton (6.3.3 §6/§7) — variantes, loading, disabled, a11y.

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  Button,
  Icon,
  IconButton,
  MissingAccessibleNameError,
  type IconDefinition,
} from '../index.js';

const fixtureIcon: IconDefinition = { name: 'x', viewBox: '0 0 16 16', path: 'M0 0h16v16H0z' };

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Button', () => {
  it('usa type=button por padrão (não submete formulários por acidente)', () => {
    const { getByRole } = render(withTheme(<Button>Ok</Button>));
    expect(getByRole('button').getAttribute('type')).toBe('button');
  });

  it('respeita type explícito', () => {
    const { getByRole } = render(withTheme(<Button type="submit">Enviar</Button>));
    expect(getByRole('button').getAttribute('type')).toBe('submit');
  });

  it('expõe variante e tamanho como data-attributes (estilo via CSS vars)', () => {
    const { getByRole } = render(
      withTheme(
        <Button variant="danger" size="lg" fullWidth>
          Excluir
        </Button>,
      ),
    );
    const btn = getByRole('button');
    expect(btn.getAttribute('data-variant')).toBe('danger');
    expect(btn.getAttribute('data-size')).toBe('lg');
    expect(btn.getAttribute('data-full-width')).toBe('true');
  });

  it('dispara onClick quando habilitado', () => {
    const onClick = vi.fn();
    const { getByRole } = render(withTheme(<Button onClick={onClick}>Ok</Button>));
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('loading: bloqueia onClick, anuncia aria-busy e mantém o conteúdo no DOM', () => {
    const onClick = vi.fn();
    const { getByRole, getByText } = render(
      withTheme(
        <Button loading onClick={onClick}>
          Salvar
        </Button>,
      ),
    );
    const btn = getByRole('button');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.getAttribute('data-loading')).toBe('true');
    // conteúdo permanece (largura preservada); spinner decorativo presente
    expect(getByText('Salvar')).toBeTruthy();
    expect(btn.querySelector('.t-spinner')).not.toBeNull();
  });

  it('disabled: semântica nativa + aria-disabled', () => {
    const { getByRole } = render(withTheme(<Button disabled>Ok</Button>));
    const btn = getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('startIcon é decorativo (aria-hidden)', () => {
    const { getByRole } = render(
      withTheme(<Button startIcon={<Icon icon={fixtureIcon} />}>Com ícone</Button>),
    );
    const hidden = getByRole('button').querySelector('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
  });
});

describe('IconButton', () => {
  it('exige nome acessível — erro orientado sem aria-label', () => {
    expect(() =>
      render(
        withTheme(
          <IconButton>
            <Icon icon={fixtureIcon} />
          </IconButton>,
        ),
      ),
    ).toThrow(MissingAccessibleNameError);
  });

  it('renderiza com aria-label e classe de área quadrada glove-first', () => {
    const { getByRole } = render(
      withTheme(
        <IconButton aria-label="Fechar painel">
          <Icon icon={fixtureIcon} />
        </IconButton>,
      ),
    );
    const btn = getByRole('button', { name: 'Fechar painel' });
    expect(btn.classList.contains('t-iconbtn')).toBe(true);
    expect(btn.getAttribute('type')).toBe('button');
  });
});
