// Input, TextArea, SearchInput (6.3.4 §5/§8).

import { fireEvent, render } from '@testing-library/react';
import { createRef, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { Input, SearchInput, TextArea } from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Input', () => {
  it('digitação nativa não controlada com defaultValue e ref', () => {
    const ref = createRef<HTMLInputElement>();
    const { getByRole } = render(withTheme(<Input aria-label="Nome" defaultValue="a" ref={ref} />));
    const input = getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('abc');
    expect(ref.current).toBe(input);
  });

  it('modo controlado reflete somente o value externo', () => {
    const onChange = vi.fn();
    const { getByRole, rerender } = render(
      withTheme(<Input aria-label="N" value="x" onChange={onChange} />),
    );
    const input = getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'xy' } });
    expect(onChange).toHaveBeenCalled();
    expect(input.value).toBe('x');
    rerender(withTheme(<Input aria-label="N" value="xy" onChange={onChange} />));
    expect(input.value).toBe('xy');
  });

  it('placeholder, maxLength, autocomplete e readOnly nativos preservados', () => {
    const { getByRole } = render(
      withTheme(
        <Input aria-label="N" placeholder="Digite" maxLength={5} autoComplete="name" readOnly />,
      ),
    );
    const input = getByRole('textbox') as HTMLInputElement;
    expect(input.placeholder).toBe('Digite');
    expect(input.maxLength).toBe(5);
    expect(input.getAttribute('autocomplete')).toBe('name');
    expect(input.readOnly).toBe(true);
    expect(input.closest('.t-frame')?.getAttribute('data-readonly')).toBe('true');
  });

  it('adornos são decorativos e fora da árvore de acessibilidade', () => {
    const { container } = render(
      withTheme(<Input aria-label="Peso" startAdornment="kg" endAdornment="±" />),
    );
    const adorns = container.querySelectorAll('.t-adorn');
    expect(adorns).toHaveLength(2);
    for (const adorn of adorns) expect(adorn.getAttribute('aria-hidden')).toBe('true');
  });

  it('reset de formulário restaura o defaultValue', () => {
    const { getByRole, container } = render(
      withTheme(
        <form>
          <Input aria-label="N" defaultValue="inicial" />
        </form>,
      ),
    );
    const input = getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mudou' } });
    (container.querySelector('form') as HTMLFormElement).reset();
    expect(input.value).toBe('inicial');
  });
});

describe('TextArea', () => {
  it('multilinha nativa com rows e resize controlado por contrato', () => {
    const { getByRole, rerender } = render(withTheme(<TextArea aria-label="Obs" rows={4} />));
    const area = getByRole('textbox') as HTMLTextAreaElement;
    expect(area.rows).toBe(4);
    expect(area.getAttribute('data-resize')).toBe('vertical');
    rerender(withTheme(<TextArea aria-label="Obs" resize="none" />));
    expect(getByRole('textbox').getAttribute('data-resize')).toBe('none');
  });

  it('invalid liga aria-invalid e moldura de erro', () => {
    const { getByRole } = render(withTheme(<TextArea aria-label="Obs" invalid />));
    const area = getByRole('textbox');
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(area.closest('.t-frame')?.getAttribute('data-invalid')).toBe('true');
  });
});

describe('SearchInput', () => {
  it('é campo type=search com glifo decorativo e sem lógica de busca', () => {
    const { getByRole, container } = render(withTheme(<SearchInput aria-label="Buscar produto" />));
    expect(getByRole('searchbox')).toBeTruthy();
    expect(
      container.querySelector('.t-search-glyph')?.closest('.t-adorn')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('botão limpar acessível chama onClear e devolve o foco ao campo', () => {
    const onClear = vi.fn();
    const { getByRole } = render(
      withTheme(<SearchInput aria-label="Buscar" onClear={onClear} clearLabel="Limpar busca" />),
    );
    fireEvent.click(getByRole('button', { name: 'Limpar busca' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(getByRole('searchbox'));
  });

  it('loading anuncia via role=status e oculta o botão limpar', () => {
    const { getByRole, queryByRole } = render(
      withTheme(
        <SearchInput
          aria-label="Buscar"
          loading
          loadingLabel="Buscando"
          onClear={() => undefined}
        />,
      ),
    );
    expect(getByRole('status').textContent).toBe('Buscando');
    expect(queryByRole('button', { name: 'Limpar busca' })).toBeNull();
  });
});
