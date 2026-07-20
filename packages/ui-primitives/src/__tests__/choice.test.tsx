// Checkbox, Radio/RadioGroup, Switch, Select, MultiSelect (6.3.4 §9–§13).

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { Checkbox, MultiSelect, Radio, RadioGroup, Select, Switch } from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Checkbox', () => {
  it('é input nativo; clique no rótulo alterna; linha é alvo glove-first', () => {
    const { getByRole, getByText } = render(withTheme(<Checkbox label="Aceito" />));
    const box = getByRole('checkbox') as HTMLInputElement;
    expect(box.tagName).toBe('INPUT');
    fireEvent.click(getByText('Aceito'));
    expect(box.checked).toBe(true);
    expect(box.closest('.t-choice-row')).not.toBeNull();
  });

  it('indeterminate aplicado via ref de forma segura', () => {
    const { getByRole, rerender } = render(withTheme(<Checkbox label="Todos" indeterminate />));
    const box = getByRole('checkbox') as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    rerender(withTheme(<Checkbox label="Todos" indeterminate={false} />));
    expect(box.indeterminate).toBe(false);
  });

  it('disabled e invalid expostos nativamente e por aria', () => {
    const { getByRole } = render(withTheme(<Checkbox label="X" disabled invalid />));
    const box = getByRole('checkbox') as HTMLInputElement;
    expect(box.disabled).toBe(true);
    expect(box.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('RadioGroup + Radio', () => {
  function group(props: { value?: string; error?: string } = {}): ReactElement {
    return withTheme(
      <RadioGroup
        label="Turno"
        orientation="horizontal"
        {...(props.value !== undefined
          ? { value: props.value, onValueChange: () => undefined }
          : {})}
        {...(props.error !== undefined ? { error: props.error } : {})}
      >
        <Radio value="manha" label="Manhã" />
        <Radio value="tarde" label="Tarde" />
      </RadioGroup>,
    );
  }

  it('agrupa por name compartilhado dentro de fieldset com legend', () => {
    const { getAllByRole, getByRole } = render(group());
    const radios = getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0]?.name).toBe(radios[1]?.name);
    expect(radios[0]?.name).not.toBe('');
    expect(getByRole('radiogroup', { name: 'Turno' })).toBeTruthy();
  });

  it('seleção não controlada por clique', () => {
    const { getAllByRole } = render(group());
    const radios = getAllByRole('radio') as HTMLInputElement[];
    fireEvent.click(radios[1] as HTMLInputElement);
    expect(radios[1]?.checked).toBe(true);
    expect(radios[0]?.checked).toBe(false);
  });

  it('modo controlado segue o value do grupo', () => {
    const { getAllByRole } = render(group({ value: 'tarde' }));
    const radios = getAllByRole('radio') as HTMLInputElement[];
    expect(radios[1]?.checked).toBe(true);
  });

  it('erro do grupo: alert + aria-describedby no fieldset + orientação', () => {
    const { getByRole } = render(group({ error: 'Escolha um turno' }));
    const fieldset = getByRole('radiogroup');
    expect(getByRole('alert').textContent).toContain('Escolha um turno');
    expect(fieldset.getAttribute('aria-describedby')).toContain(getByRole('alert').id);
    expect(fieldset.querySelector('.t-radiogroup-items')?.getAttribute('data-orientation')).toBe(
      'horizontal',
    );
  });
});

describe('Switch', () => {
  it('checkbox nativo com role=switch (participa de form/reset)', () => {
    const { getByRole } = render(withTheme(<Switch label="Modo luva" />));
    const sw = getByRole('switch') as HTMLInputElement;
    expect(sw.tagName).toBe('INPUT');
    expect(sw.type).toBe('checkbox');
    fireEvent.click(sw);
    expect(sw.checked).toBe(true);
  });

  it('disabled bloqueia interação', () => {
    const { getByRole } = render(withTheme(<Switch label="X" disabled />));
    expect((getByRole('switch') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('Select (nativo por decisão registrada)', () => {
  it('seleciona via elemento select nativo', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      withTheme(
        <Select aria-label="Categoria" onChange={onChange} defaultValue="b">
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>,
      ),
    );
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('b');
    fireEvent.change(select, { target: { value: 'a' } });
    expect(select.value).toBe('a');
    expect(onChange).toHaveBeenCalled();
  });

  it('disabled e invalid na moldura e no controle', () => {
    const { getByRole } = render(
      withTheme(
        <Select aria-label="C" disabled invalid>
          <option value="a">A</option>
        </Select>,
      ),
    );
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.closest('.t-frame')?.getAttribute('data-invalid')).toBe('true');
  });
});

describe('MultiSelect', () => {
  const options = [
    { value: 'boi', label: 'Bovinos' },
    { value: 'porco', label: 'Suínos' },
    { value: 'frango', label: 'Aves' },
  ];

  function selectValues(select: HTMLSelectElement, values: readonly string[]): void {
    for (const option of Array.from(select.options)) {
      option.selected = values.includes(option.value);
    }
    fireEvent.change(select);
  }

  it('select múltiplo nativo (aria-multiselectable intrínseco) emite valores', () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      withTheme(
        <MultiSelect aria-label="Espécies" options={options} onValueChange={onValueChange} />,
      ),
    );
    const select = getByRole('listbox') as HTMLSelectElement;
    expect(select.multiple).toBe(true);
    selectValues(select, ['boi', 'frango']);
    expect(onValueChange).toHaveBeenLastCalledWith(['boi', 'frango']);
  });

  it('resumo com chips reutiliza remoção acessível do Chip', () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      withTheme(
        <MultiSelect
          aria-label="Espécies"
          options={options}
          value={['boi', 'porco']}
          onValueChange={onValueChange}
        />,
      ),
    );
    fireEvent.click(getByRole('button', { name: 'Remover Suínos' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['boi']);
  });

  it('estado vazio mostra texto oficial e nenhum chip', () => {
    const { getByText, container } = render(
      withTheme(<MultiSelect aria-label="E" options={options} />),
    );
    expect(getByText('Nenhum item selecionado')).toBeTruthy();
    expect(container.querySelectorAll('.t-chip')).toHaveLength(0);
  });
});
