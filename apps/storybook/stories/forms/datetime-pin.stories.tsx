// Forms — DatePicker/TimePicker (strings canônicas, sem Date/timezone) e
// PinInput (somente entrada; valores FICTÍCIOS; nada é registrado em
// actions/logs — sem handlers de valor nas stories).

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { DatePicker, Field, PinInput, Stack, Text, TimePicker } from '@tauros/ui-primitives';

const meta = {
  title: 'Forms/Date, Time & PIN',
  parameters: {
    docs: {
      description: {
        component:
          'DatePicker/TimePicker usam inputs nativos com contratos canônicos YYYY-MM-DD e HH:mm (nenhum Date atravessa a API — sem timezone acidental). PinInput é apenas entrada mascarada: sem validação, persistência ou hash; o valor jamais aparece em data-*.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function DateTimeDemo(): React.ReactElement {
  const [date, setDate] = useState('2026-07-20');
  const [time, setTime] = useState('06:30');
  return (
    <Stack gap={200} style={{ maxWidth: '40ch' }}>
      <Field label="Validade" description="Contrato: string civil YYYY-MM-DD">
        <DatePicker value={date} min="2026-01-01" max="2026-12-31" onValueChange={setDate} />
      </Field>
      <Field label="Início do turno" description="Contrato: string local HH:mm">
        <TimePicker value={time} onValueChange={setTime} />
      </Field>
      <Text role="data" tone="secondary">
        date=&quot;{date}&quot; · time=&quot;{time}&quot;
      </Text>
    </Stack>
  );
}

export const DataEHora: Story = {
  name: 'DatePicker e TimePicker (canônicos)',
  render: () => <DateTimeDemo />,
};

export const Pin: Story = {
  name: 'PinInput (entrada fictícia, mascarada)',
  render: () => (
    <Stack gap={200}>
      <PinInput length={4} label="PIN de demonstração (fictício)" />
      <PinInput length={6} label="PIN de 6 dígitos" invalid />
      <PinInput length={4} label="PIN desabilitado" disabled />
      <Text role="caption" tone="tertiary">
        Componente somente-entrada: sem autenticação, lockout ou registro do valor.
      </Text>
    </Stack>
  ),
};
