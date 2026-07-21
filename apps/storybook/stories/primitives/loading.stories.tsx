// Primitives/Loading — Spinner e Skeleton (reduced motion via tokens).

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Card, Flex, Skeleton, Spinner, Stack, Text } from '@tauros/ui-primitives';

const meta = {
  title: 'Primitives/Loading',
  parameters: {
    docs: {
      description: {
        component:
          'Spinner anuncia via role=status (use `decorative` quando outro elemento anuncia). Skeleton é aria-hidden. Com movimento reduzido (toolbar), as animações param pelos próprios tokens.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Spinners: Story = {
  render: () => (
    <Flex gap={200}>
      <Spinner size="sm" label="Carregando resumo" />
      <Spinner size="md" />
      <Spinner size="lg" label="Sincronizando fila" />
    </Flex>
  ),
};

export const Skeletons: Story = {
  name: 'Skeleton em região de loading',
  render: () => (
    <Card>
      <Stack gap={100}>
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width={800} />
        <Flex gap={100}>
          <Skeleton variant="circle" height={400} />
          <Skeleton variant="rect" height={600} width="100%" />
        </Flex>
        <Text role="caption" tone="tertiary">
          O anúncio pertence ao contêiner (ver LoadingState em Feedback).
        </Text>
      </Stack>
    </Card>
  ),
};
