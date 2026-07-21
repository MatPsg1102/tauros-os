// Forms/Text Inputs — Field, Input, TextArea, SearchInput (6.3.4).

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { Field, Input, SearchInput, Stack, TextArea } from '@tauros/ui-primitives';

const meta = {
  title: 'Forms/Text Inputs',
  parameters: {
    docs: {
      description: {
        component:
          'Controles nativos com moldura tokenizada. Field compõe label/descrição/erro e liga aria-describedby/aria-invalid automaticamente; controles isolados usam aria-label.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const CampoCompleto: Story = {
  name: 'Field: label, descrição, erro, obrigatório',
  render: () => (
    <Stack gap={200} style={{ maxWidth: '65ch' }}>
      <Field label="Nome do corte" description="Nome exibido nas etiquetas" required>
        <Input placeholder="Ex.: Picanha bovina" />
      </Field>
      <Field label="Código interno" error="Código já cadastrado nesta unidade">
        <Input defaultValue="PIC-001" />
      </Field>
      <Field label="Observações" description="Visível apenas para a equipe">
        <TextArea rows={3} placeholder="Instruções de manuseio…" />
      </Field>
    </Stack>
  ),
};

export const EstadosDoControle: Story = {
  name: 'Estados: disabled, readOnly, invalid, adornos',
  render: () => (
    <Stack gap={200} style={{ maxWidth: '65ch' }}>
      <Input aria-label="Desabilitado" disabled defaultValue="Sem edição" />
      <Input aria-label="Somente leitura" readOnly defaultValue="NF 000.482.199" />
      <Input aria-label="Inválido" invalid defaultValue="valor rejeitado" />
      <Input aria-label="Peso" startAdornment="kg" endAdornment="±0,005" inputMode="decimal" />
    </Stack>
  ),
};

function BuscaDemo(): React.ReactElement {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  return (
    <SearchInput
      aria-label="Buscar corte"
      placeholder="Buscar no catálogo…"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        setLoading(event.target.value.length > 0);
        setTimeout(() => setLoading(false), 600);
      }}
      loading={loading}
      onClear={() => setValue('')}
      clearLabel="Limpar busca"
    />
  );
}

export const Busca: Story = {
  name: 'SearchInput (limpar + loading)',
  render: () => <BuscaDemo />,
};
