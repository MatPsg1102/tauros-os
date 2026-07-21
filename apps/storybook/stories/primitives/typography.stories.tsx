// Primitives/Typography — Text, Heading, Label (papéis do tema, hierarquia
// semântica ≠ visual).

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Field, Heading, Input, Label, Stack, Text } from '@tauros/ui-primitives';

const meta = {
  title: 'Primitives/Typography',
  parameters: {
    docs: {
      description: {
        component:
          'Text expõe papéis (body/label/data/caption) e tons; Heading separa nível semântico (h1–h5) do visual (emphasis 1–5); Label associa controles.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Papeis: Story = {
  name: 'Papéis de texto',
  render: () => (
    <Stack gap={100}>
      <Text role="body">Body — instruções e conteúdo corrente.</Text>
      <Text role="label">Label — rótulos de campos e ações.</Text>
      <Text role="data">Data — 1.284,50 kg · lote 2026-07-18</Text>
      <Text role="caption" tone="secondary">
        Caption — apoio e metadados.
      </Text>
      <Text tone="tertiary">Tom terciário para informação de menor prioridade.</Text>
    </Stack>
  ),
};

export const HierarquiaSemanticaVsVisual: Story = {
  name: 'Hierarquia semântica ≠ visual',
  render: () => (
    <Stack gap={100}>
      <Heading level={1}>h1 com visual 1 (título da tela)</Heading>
      <Heading level={2} visualLevel={4}>
        h2 com visual 4 (seção discreta — semântica preservada)
      </Heading>
      <Heading level={3} visualLevel={2}>
        h3 com visual 2 (destaque sem quebrar o outline)
      </Heading>
    </Stack>
  ),
};

export const TextosLongos: Story = {
  name: 'Textos longos e números',
  render: () => (
    <Stack gap={200} style={{ maxWidth: '40ch' }}>
      <Heading level={2} visualLevel={3}>
        Conferência de recebimento de carcaças bovinas do fornecedor com nome bastante extenso
      </Heading>
      <Text>
        Parágrafo longo para validar quebra e medida de leitura em viewports estreitas, com
        acentuação em português e números como 12.845,905 kg distribuídos no texto.
      </Text>
      <Text role="data">000.128.450-99 · NF 000.482.199</Text>
    </Stack>
  ),
};

export const LabelComCampo: Story = {
  name: 'Label associada e Field',
  render: () => (
    <Stack gap={200}>
      <div>
        <Label htmlFor="peso-avulso">Peso líquido (kg)</Label>
        <Input id="peso-avulso" inputMode="decimal" aria-describedby={undefined} />
      </div>
      <Field label="Peso líquido (kg)" description="Composição oficial via Field">
        <Input inputMode="decimal" />
      </Field>
    </Stack>
  ),
};
