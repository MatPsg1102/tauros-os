// Primitives/Actions — Button e IconButton (6.3.3 §6/§7).

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Button, Flex, IconButton, Icon, Stack, type IconDefinition } from '@tauros/ui-primitives';

const closeIcon: IconDefinition = {
  name: 'close',
  viewBox: '0 0 16 16',
  path: 'M3 3l10 10M13 3L3 13',
};
const plusIcon: IconDefinition = { name: 'plus', viewBox: '0 0 16 16', path: 'M8 2v12M2 8h12' };

const meta = {
  title: 'Primitives/Actions/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          'Ação primária glove-first (min-height = size.controlMin, 64px por padrão). Use IconButton apenas com `aria-label`; loading preserva a largura e bloqueia o clique.',
      },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: 'Confirmar pesagem' } };

export const Variantes: Story = {
  render: () => (
    <Flex gap={100} wrap>
      <Button variant="primary">Primário</Button>
      <Button variant="secondary">Secundário</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Destrutivo</Button>
    </Flex>
  ),
};

export const TamanhosEEstados: Story = {
  name: 'Tamanhos e estados',
  render: () => (
    <Stack gap={200}>
      <Flex gap={100} wrap>
        <Button size="sm">Pequeno</Button>
        <Button size="md">Médio</Button>
        <Button size="lg">Grande</Button>
      </Flex>
      <Flex gap={100} wrap>
        <Button disabled>Desabilitado</Button>
        <Button loading>Salvando</Button>
        <Button startIcon={<Icon icon={plusIcon} />}>Com ícone</Button>
        <Button fullWidth>Largura total</Button>
      </Flex>
    </Stack>
  ),
};

export const IconButtonAcessivel: Story = {
  name: 'IconButton (nome acessível obrigatório)',
  render: () => (
    <Flex gap={100}>
      <IconButton aria-label="Fechar painel">
        <Icon icon={closeIcon} />
      </IconButton>
      <IconButton aria-label="Nova pesagem" variant="primary">
        <Icon icon={plusIcon} />
      </IconButton>
    </Flex>
  ),
};

export const RotuloLongo: Story = {
  name: 'Rótulo longo',
  args: { children: 'Confirmar pesagem do dianteiro bovino e registrar a perda apurada' },
};
