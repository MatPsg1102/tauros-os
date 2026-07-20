// Auditoria axe dos Form Components (6.3.4) — composições reais.

import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  Checkbox,
  CurrencyInput,
  DatePicker,
  Field,
  Input,
  MultiSelect,
  NumberInput,
  PinInput,
  Radio,
  RadioGroup,
  SearchInput,
  Select,
  Switch,
  TextArea,
  TimePicker,
} from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('axe — formulários sem violações', () => {
  it('campos de texto e numéricos com Field (label/descrição/erro)', async () => {
    const { container } = render(
      withTheme(
        <form aria-label="Cadastro">
          <Field label="Nome" description="Nome exibido na operação">
            <Input />
          </Field>
          <Field label="Observações">
            <TextArea />
          </Field>
          <Field label="Quantidade" error="Valor obrigatório" required>
            <NumberInput />
          </Field>
          <Field label="Preço">
            <CurrencyInput />
          </Field>
          <SearchInput aria-label="Buscar produto" onClear={() => undefined} />
        </form>,
      ),
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it('seleção, alternância, data/hora e PIN', async () => {
    const { container } = render(
      withTheme(
        <form aria-label="Configuração">
          <Field label="Categoria">
            <Select>
              <option value="a">A</option>
            </Select>
          </Field>
          <MultiSelect
            aria-label="Espécies"
            options={[
              { value: 'boi', label: 'Bovinos' },
              { value: 'porco', label: 'Suínos' },
            ]}
            value={['boi']}
          />
          <Checkbox label="Aceito os termos" />
          <RadioGroup label="Turno" description="Turno de trabalho" error="Escolha um turno">
            <Radio value="m" label="Manhã" />
            <Radio value="t" label="Tarde" />
          </RadioGroup>
          <Switch label="Modo luva" />
          <Field label="Validade">
            <DatePicker />
          </Field>
          <Field label="Início">
            <TimePicker />
          </Field>
          <PinInput length={4} label="PIN do operador" />
        </form>,
      ),
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
