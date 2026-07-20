// DatePicker, TimePicker, PinInput (6.3.4 §14/§15).

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  DatePicker,
  InvalidPinLengthError,
  isValidCivilDate,
  isValidLocalTime,
  PinInput,
  TimePicker,
} from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('formatos canônicos', () => {
  it('data civil YYYY-MM-DD validada sem Date/timezone', () => {
    expect(isValidCivilDate('2026-07-20')).toBe(true);
    expect(isValidCivilDate('2026-02-29')).toBe(false);
    expect(isValidCivilDate('2024-02-29')).toBe(true);
    expect(isValidCivilDate('20/07/2026')).toBe(false);
    expect(isValidCivilDate('')).toBe(false);
  });

  it('horário local HH:mm', () => {
    expect(isValidLocalTime('06:30')).toBe(true);
    expect(isValidLocalTime('23:59')).toBe(true);
    expect(isValidLocalTime('24:00')).toBe(false);
    expect(isValidLocalTime('6:30')).toBe(false);
  });
});

describe('DatePicker', () => {
  it('input nativo type=date com valor canônico string e limites', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      withTheme(
        <DatePicker
          aria-label="Validade"
          min="2026-01-01"
          max="2026-12-31"
          onValueChange={onValueChange}
        />,
      ),
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.min).toBe('2026-01-01');
    fireEvent.change(input, { target: { value: '2026-07-20' } });
    expect(onValueChange).toHaveBeenLastCalledWith('2026-07-20', expect.anything());
    // valor é string canônica — nenhum objeto Date atravessa o contrato
    expect(typeof onValueChange.mock.calls[0]?.[0]).toBe('string');
  });

  it('vazio permanece string vazia (sem data implícita)', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      withTheme(
        <DatePicker aria-label="V" defaultValue="2026-07-20" onValueChange={onValueChange} />,
      ),
    );
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(onValueChange).toHaveBeenLastCalledWith('', expect.anything());
  });
});

describe('TimePicker', () => {
  it('input nativo type=time com contrato HH:mm', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      withTheme(<TimePicker aria-label="Início do turno" onValueChange={onValueChange} />),
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('time');
    fireEvent.change(input, { target: { value: '06:30' } });
    expect(onValueChange).toHaveBeenLastCalledWith('06:30', expect.anything());
  });
});

describe('PinInput', () => {
  it('renderiza N células mascaradas (password) com rótulos por dígito', () => {
    const { getByRole, getAllByLabelText } = render(
      withTheme(<PinInput length={4} label="PIN do operador" />),
    );
    expect(getByRole('group', { name: 'PIN do operador' })).toBeTruthy();
    const cells = getAllByLabelText(/Dígito \d de 4/) as HTMLInputElement[];
    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell.type).toBe('password');
      expect(cell.getAttribute('inputmode')).toBe('numeric');
    }
    expect(cells[0]?.getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('digitação avança o foco e onComplete dispara ao preencher', () => {
    const onComplete = vi.fn();
    const { getAllByLabelText } = render(
      withTheme(<PinInput length={4} label="PIN" onComplete={onComplete} />),
    );
    const cells = getAllByLabelText(/Dígito/) as HTMLInputElement[];
    for (const [i, key] of ['1', '2', '3', '4'].entries()) {
      fireEvent.keyDown(cells[i] as HTMLInputElement, { key });
    }
    expect(onComplete).toHaveBeenCalledWith('1234');
    expect(document.activeElement).toBe(cells[3]);
  });

  it('backspace limpa e recua; caracteres não numéricos são ignorados', () => {
    const onValueChange = vi.fn();
    const { getAllByLabelText } = render(
      withTheme(<PinInput length={3} label="PIN" onValueChange={onValueChange} />),
    );
    const cells = getAllByLabelText(/Dígito/) as HTMLInputElement[];
    fireEvent.keyDown(cells[0] as HTMLInputElement, { key: 'a' });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(cells[0] as HTMLInputElement, { key: '7' });
    expect(onValueChange).toHaveBeenLastCalledWith('7');
    // backspace em célula vazia limpa a anterior e recua o foco
    fireEvent.keyDown(cells[1] as HTMLInputElement, { key: 'Backspace' });
    expect(onValueChange).toHaveBeenLastCalledWith('');
    expect(document.activeElement).toBe(cells[0]);
  });

  it('colagem distribui os dígitos a partir da célula focada', () => {
    const onComplete = vi.fn();
    const { getAllByLabelText } = render(
      withTheme(<PinInput length={4} label="PIN" onComplete={onComplete} />),
    );
    const first = (getAllByLabelText(/Dígito/) as HTMLInputElement[])[0] as HTMLInputElement;
    fireEvent.paste(first, { clipboardData: { getData: () => '9876' } });
    expect(onComplete).toHaveBeenCalledWith('9876');
  });

  it('SEGURANÇA: o valor não aparece em data-* nem fora das células', () => {
    const { getByRole } = render(withTheme(<PinInput length={4} label="PIN" />));
    const group = getByRole('group');
    const cells = group.querySelectorAll('input');
    for (const cell of cells) fireEvent.keyDown(cell, { key: '5' });
    expect(group.outerHTML).not.toContain('5555');
    expect(group.getAttribute('data-value')).toBeNull();
    for (const attr of Array.from(group.attributes)) {
      expect(attr.value).not.toContain('5555');
    }
  });

  it('length inválido lança erro orientado', () => {
    expect(() => render(withTheme(<PinInput length={0} label="PIN" />))).toThrow(
      InvalidPinLengthError,
    );
  });
});
