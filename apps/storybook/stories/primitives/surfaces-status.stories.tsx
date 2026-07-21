// Primitives — Surface/Card (superfícies), Badge/Chip/Avatar (status e
// seleção), Divider/Spacer/Box/Stack/Flex/Grid (estruturais).

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import {
  Avatar,
  Badge,
  Box,
  Card,
  Chip,
  Divider,
  Flex,
  Grid,
  Heading,
  Stack,
  Surface,
  Text,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Primitives/Surfaces & Status',
  parameters: {
    docs: {
      description: {
        component:
          'Surface = elevação pura; Card = Surface com inset (conteúdo agrupado); Panel (Layouts) = contrato operacional com corpo rolável. Badge = status passivo multidimensional; Chip = seleção interativa.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Superficies: Story = {
  name: 'Surface e Card (elevações)',
  render: () => (
    <Grid columns={2} gap={200}>
      {(['flat', 'card', 'sheet', 'dialog'] as const).map((elevation) => (
        <Surface
          key={elevation}
          elevation={elevation}
          style={{ padding: 'var(--tauros-space-inset-md)' }}
        >
          <Text role="label">elevation: {elevation}</Text>
        </Surface>
      ))}
      <Card>
        <Stack gap={100}>
          <Heading level={3} visualLevel={4}>
            Card com conteúdo longo
          </Heading>
          <Text tone="secondary">
            Cards agrupam conteúdo com inset padrão. Este texto é intencionalmente maior para
            validar o comportamento com parágrafos extensos em alto contraste.
          </Text>
        </Stack>
      </Card>
    </Grid>
  ),
};

export const StatusPassivoVsSelecao: Story = {
  name: 'Badge (status) vs Chip (seleção)',
  render: () => (
    <Stack gap={200}>
      <Flex gap={100} wrap>
        {(['success', 'info', 'warn', 'error', 'critical', 'neutral'] as const).map((status) => (
          <Badge key={status} status={status}>
            {status}
          </Badge>
        ))}
      </Flex>
      <Flex gap={100} wrap>
        <Chip selected>Bovinos</Chip>
        <Chip>Suínos</Chip>
        <Chip onRemove={() => undefined} removeLabel="Remover filtro Aves">
          Aves
        </Chip>
        <Chip disabled>Indisponível</Chip>
        <Chip selected>Categoria com nome bastante longo para truncamento</Chip>
      </Flex>
    </Stack>
  ),
};

export const Avatares: Story = {
  render: () => (
    <Flex gap={100}>
      <Avatar name="Maria da Silva" size="sm" />
      <Avatar name="João Pereira" size="md" />
      <Avatar name="Ana Souza" size="lg" shape="square" />
    </Flex>
  ),
};

export const Estruturais: Story = {
  name: 'Box, Stack, Flex, Grid, Divider',
  render: () => (
    <Stack gap={200}>
      <Box padding="md" style={{ background: 'var(--tauros-color-surface-sunken)' }}>
        Box com inset md
      </Box>
      <Divider />
      <Flex justify="between">
        <Text>Distribuído</Text>
        <Text role="data">1.284 kg</Text>
      </Flex>
      <Grid columns={3} gap={100}>
        <Card>1</Card>
        <Card>2</Card>
        <Card>3</Card>
      </Grid>
    </Stack>
  ),
};
