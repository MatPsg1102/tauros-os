// Forms/Selection — Select/MultiSelect NATIVOS (decisão congelada 6.3.4 —
// sem versões compostas), Checkbox, Radio/RadioGroup, Switch.

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import {
  Checkbox,
  Field,
  MultiSelect,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Forms/Selection',
  parameters: {
    docs: {
      description: {
        component:
          'Select e MultiSelect são NATIVOS por decisão formal (variante composta é extensão futura explícita — a existência de Popover não os converte). Checkbox/Radio/Switch usam inputs nativos estilizados; linha rotulada inteira é o alvo glove-first.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const especies = [
  { value: 'bovinos', label: 'Bovinos' },
  { value: 'suinos', label: 'Suínos' },
  { value: 'aves', label: 'Aves' },
  { value: 'ovinos', label: 'Ovinos' },
];

export const Selecoes: Story = {
  name: 'Select e MultiSelect nativos',
  render: () => (
    <Stack gap={200} style={{ maxWidth: '65ch' }}>
      <Field label="Categoria" description="Elemento select nativo">
        <Select defaultValue="bovinos">
          {especies.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <MultiSelect
        aria-label="Espécies do relatório"
        options={especies}
        defaultValue={['bovinos', 'aves']}
      />
    </Stack>
  ),
};

export const CaixasEChaves: Story = {
  name: 'Checkbox, indeterminate, Switch',
  render: () => (
    <Stack gap={100}>
      <Checkbox label="Conferido pelo responsável" defaultChecked />
      <Checkbox label="Selecionar todos os itens" indeterminate />
      <Checkbox label="Item bloqueado" disabled />
      <Checkbox label="Confirmação obrigatória" invalid />
      <Switch label="Impressão automática de etiquetas" defaultChecked />
      <Switch label="Modo indisponível" disabled />
    </Stack>
  ),
};

export const GrupoDeRadios: Story = {
  name: 'RadioGroup: orientação, erro do grupo',
  render: () => (
    <Stack gap={300}>
      <RadioGroup label="Turno" defaultValue="manha" orientation="horizontal">
        <Radio value="manha" label="Manhã" />
        <Radio value="tarde" label="Tarde" />
        <Radio value="noite" label="Noite" />
      </RadioGroup>
      <RadioGroup
        label="Destino da perda"
        description="Selecione o destino registrado no processo"
        error="Escolha um destino antes de continuar"
      >
        <Radio value="descarte" label="Descarte sanitário" />
        <Radio value="aproveitamento" label="Aproveitamento interno" />
        <Radio value="indisponivel" label="Opção indisponível" disabled />
      </RadioGroup>
    </Stack>
  ),
};
