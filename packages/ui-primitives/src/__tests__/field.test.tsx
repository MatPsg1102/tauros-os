// Field (6.3.4 §1/§16/§17) — composição, IDs estáveis, associação ARIA.

import { render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { Field, Input } from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Field', () => {
  it('associa label, descrição e erro ao controle via IDs gerados', () => {
    const { getByRole, getByText } = render(
      withTheme(
        <Field label="Nome" description="Nome exibido" error="Campo obrigatório" required>
          <Input />
        </Field>,
      ),
    );
    const input = getByRole('textbox');
    const label = getByText('Nome');
    expect(label.getAttribute('for')).toBe(input.id);
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain(getByText('Nome exibido').id);
    expect(describedBy).toContain(getByText('Campo obrigatório').closest('p')?.id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect((input as HTMLInputElement).required).toBe(true);
  });

  it('erro usa role=alert com marcador de forma (não só cor)', () => {
    const { getByRole, container } = render(
      withTheme(
        <Field label="Peso" error="Inválido">
          <Input />
        </Field>,
      ),
    );
    expect(getByRole('alert').textContent).toContain('Inválido');
    expect(container.querySelector('.t-field-error-marker')).not.toBeNull();
  });

  it('sem erro não há alert nem aria-invalid', () => {
    const { queryByRole, getByRole } = render(
      withTheme(
        <Field label="Nome">
          <Input />
        </Field>,
      ),
    );
    expect(queryByRole('alert')).toBeNull();
    expect(getByRole('textbox').getAttribute('aria-invalid')).toBeNull();
  });

  it('props do consumidor têm precedência sobre o contexto (id e describedby preservados)', () => {
    const { getByRole } = render(
      withTheme(
        <Field label="Nome" description="desc">
          <Input id="meu-id" aria-describedby="externo" />
        </Field>,
      ),
    );
    const input = getByRole('textbox');
    expect(input.id).toBe('meu-id');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('externo');
    expect(describedBy.split(' ').length).toBeGreaterThan(1);
  });

  it('disabled do Field propaga ao controle', () => {
    const { getByRole } = render(
      withTheme(
        <Field label="Nome" disabled>
          <Input />
        </Field>,
      ),
    );
    expect((getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('SSR: IDs estáveis entre renderizações (markup determinístico)', () => {
    const ui = withTheme(
      <Field label="Nome" description="d" error="e">
        <Input />
      </Field>,
    );
    expect(renderToString(ui)).toBe(renderToString(ui));
  });
});
