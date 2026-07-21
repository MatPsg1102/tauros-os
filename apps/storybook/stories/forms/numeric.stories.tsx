// Forms/Numeric — NumberInput (parsing por locale) e CurrencyInput
// (unidade mínima). Valores demonstram os contratos congelados da 6.3.4.

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { CurrencyInput, Field, NumberInput, Stack, Text } from '@tauros/ui-primitives';

const meta = {
  title: 'Forms/Numeric Inputs',
  parameters: {
    docs: {
      description: {
        component:
          'NumberInput separa texto digitado de valor (vazio = null, nunca zero; min/max marcam invalid sem clamp). CurrencyInput opera em unidade mínima inteira (centavos) com Intl por trás de fronteira testável.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function NumberDemo(): React.ReactElement {
  const [state, setState] = useState<{ value: number | null; invalid: boolean }>({
    value: null,
    invalid: false,
  });
  return (
    <Stack gap={100} style={{ maxWidth: '40ch' }}>
      <Field
        label="Quantidade (kg)"
        description="Locale pt-BR — vírgula decimal; máx. 500"
        {...(state.invalid ? { error: 'Valor fora do intervalo permitido (0–500)' } : {})}
      >
        <NumberInput
          min={0}
          max={500}
          onValueChange={(change) => setState({ value: change.value, invalid: change.invalid })}
        />
      </Field>
      <Text role="data" tone="secondary">
        valor: {state.value === null ? 'null (vazio)' : String(state.value)}
      </Text>
    </Stack>
  );
}

export const Numero: Story = {
  name: 'NumberInput: vazio/válido/inválido/min-max',
  render: () => <NumberDemo />,
};

function CurrencyDemo(): React.ReactElement {
  const [minor, setMinor] = useState<number | null>(123456);
  return (
    <Stack gap={100} style={{ maxWidth: '40ch' }}>
      <Field label="Preço por kg" description="BRL · foco edita, blur formata">
        <CurrencyInput
          defaultValueInMinorUnits={123456}
          onValueChange={(change) => setMinor(change.valueInMinorUnits)}
        />
      </Field>
      <Text role="data" tone="secondary">
        valueInMinorUnits: {minor === null ? 'null' : String(minor)} (centavos inteiros)
      </Text>
      <Field label="Valor alto (teste de precisão)">
        <CurrencyInput defaultValueInMinorUnits={999999999} />
      </Field>
      <Field label="USD / en-US (reutilizável por props)">
        <CurrencyInput locale="en-US" currency="USD" defaultValueInMinorUnits={123456} />
      </Field>
    </Stack>
  );
}

export const Moeda: Story = {
  name: 'CurrencyInput: centavos, pt-BR, moedas',
  render: () => <CurrencyDemo />,
};
