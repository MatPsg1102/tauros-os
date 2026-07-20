// NumberInput e CurrencyInput (6.3.4 §6/§7) — parsing por locale,
// unidade mínima, foco/blur, colagem, entradas intermediárias.

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { CurrencyInput, NumberInput } from '../index.js';
import { formatMinorUnits, parseToMinorUnits } from '../forms/currency-input/currency-format.js';
import { parseNumberText } from '../forms/number-input/number-parse.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

const BRL = { locale: 'pt-BR', currency: 'BRL' };

describe('parseNumberText (fronteira de parsing)', () => {
  it('vazio ⇒ null sem invalidez (nunca zero implícito)', () => {
    expect(parseNumberText('', { locale: 'pt-BR', allowNegative: false })).toEqual({
      value: null,
      invalid: false,
    });
  });

  it('decimal pt-BR com vírgula e milhar com ponto', () => {
    expect(parseNumberText('1.234,5', { locale: 'pt-BR', allowNegative: false }).value).toBe(
      1234.5,
    );
  });

  it('texto inválido ⇒ invalid sem valor', () => {
    expect(parseNumberText('12a', { locale: 'pt-BR', allowNegative: false })).toEqual({
      value: null,
      invalid: true,
    });
  });

  it('negativo rejeitado quando não permitido; aceito quando permitido', () => {
    expect(parseNumberText('-5', { locale: 'pt-BR', allowNegative: false }).invalid).toBe(true);
    expect(parseNumberText('-5', { locale: 'pt-BR', allowNegative: true }).value).toBe(-5);
  });

  it('fora de min/max ⇒ invalid preservando o valor lido (não clampa)', () => {
    const result = parseNumberText('50', { locale: 'pt-BR', allowNegative: false, max: 10 });
    expect(result).toEqual({ value: 50, invalid: true });
  });
});

describe('NumberInput', () => {
  it('digitação emite onValueChange com texto e valor separados', () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      withTheme(<NumberInput aria-label="Qtde" onValueChange={onValueChange} />),
    );
    const input = getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2,5' } });
    expect(onValueChange).toHaveBeenLastCalledWith({ text: '2,5', value: 2.5, invalid: false });
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('entrada inválida marca aria-invalid e preserva o texto digitado', () => {
    const { getByRole } = render(withTheme(<NumberInput aria-label="Qtde" />));
    const input = getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1,2,3' } });
    expect(input.value).toBe('1,2,3');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('mudança externa do valor controlado ressincroniza o texto', () => {
    const { getByRole, rerender } = render(withTheme(<NumberInput aria-label="Qtde" value={1} />));
    rerender(withTheme(<NumberInput aria-label="Qtde" value={7.5} />));
    expect((getByRole('textbox') as HTMLInputElement).value).toBe('7,5');
  });

  it('colagem com milhar é aceita', () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      withTheme(<NumberInput aria-label="Qtde" onValueChange={onValueChange} />),
    );
    fireEvent.change(getByRole('textbox'), { target: { value: '12.345,67' } });
    expect(onValueChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 12345.67, invalid: false }),
    );
  });
});

describe('parseToMinorUnits / formatMinorUnits (fronteira Intl)', () => {
  it('parse de texto formatado com símbolo, milhar e vírgula', () => {
    expect(parseToMinorUnits('R$ 1.234,56', BRL)).toEqual({
      valueInMinorUnits: 123456,
      invalid: false,
    });
  });

  it('vazio ⇒ null; lixo ⇒ invalid', () => {
    expect(parseToMinorUnits('', BRL).valueInMinorUnits).toBeNull();
    expect(parseToMinorUnits('abc', BRL).invalid).toBe(true);
  });

  it('arredondamento half-up do excedente de precisão', () => {
    expect(parseToMinorUnits('1,005', BRL).valueInMinorUnits).toBe(101);
    expect(parseToMinorUnits('1,004', BRL).valueInMinorUnits).toBe(100);
  });

  it('formatação oficial da moeda a partir da unidade mínima', () => {
    const text = formatMinorUnits(123456, BRL);
    expect(text).toContain('1.234,56');
    expect(text).toContain('R$');
  });

  it('entrada intermediária "1234," é válida (parcial de digitação)', () => {
    expect(parseToMinorUnits('1234,', BRL)).toEqual({ valueInMinorUnits: 123400, invalid: false });
  });
});

describe('CurrencyInput', () => {
  it('emite unidade mínima inteira em onValueChange', () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      withTheme(<CurrencyInput aria-label="Preço" onValueChange={onValueChange} />),
    );
    fireEvent.change(getByRole('textbox'), { target: { value: '12,34' } });
    expect(onValueChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ valueInMinorUnits: 1234, invalid: false }),
    );
  });

  it('blur formata com símbolo; foco volta ao texto de edição', () => {
    const { getByRole } = render(
      withTheme(<CurrencyInput aria-label="Preço" defaultValueInMinorUnits={123456} />),
    );
    const input = getByRole('textbox') as HTMLInputElement;
    expect(input.value).toContain('R$');
    fireEvent.focus(input);
    expect(input.value).toBe('1234,56');
    fireEvent.blur(input);
    expect(input.value).toContain('R$');
  });

  it('vazio permanece vazio (null), sem zero implícito', () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      withTheme(<CurrencyInput aria-label="Preço" onValueChange={onValueChange} />),
    );
    const input = getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('');
    expect(onValueChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ valueInMinorUnits: null, invalid: false }),
    );
  });

  it('respeita moeda/locale por props (fronteira reutilizável)', () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      withTheme(
        <CurrencyInput
          aria-label="Price"
          locale="en-US"
          currency="USD"
          onValueChange={onValueChange}
        />,
      ),
    );
    fireEvent.change(getByRole('textbox'), { target: { value: '1,234.56' } });
    expect(onValueChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ valueInMinorUnits: 123456 }),
    );
  });
});
