// Foundation/Theme — runtime modes reais via ThemeProvider oficial.
// Use a TOOLBAR (Cor/Contraste/Entrada/Movimento) para alternar os modos:
// o decorator aplica preferências reais — nenhum estado paralelo.

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  Heading,
  Input,
  Field,
  Stack,
  Switch,
  Text,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Foundation/Theme',
  parameters: {
    docs: {
      description: {
        component:
          'Os modos (dark, industrial, glove, alto contraste, movimento reduzido) são rebinding de CSS variables pelo ThemeProvider — os componentes não têm condicionais de tema. Alterne pela toolbar.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const AmostraDeModos: Story = {
  name: 'Amostra (alterne na toolbar)',
  render: () => (
    <Card>
      <Stack gap={200}>
        <Heading level={2} visualLevel={3}>
          Painel de amostra
        </Heading>
        <Text tone="secondary">
          Este mesmo conteúdo responde a dark/industrial/glove/alto contraste/reduced motion.
        </Text>
        <Badge status="warn">Estoque baixo</Badge>
        <Alert status="info" title="Sincronização">
          3 itens aguardando envio.
        </Alert>
        <Field label="Peso (kg)" description="Balança 02">
          <Input inputMode="decimal" defaultValue="12,450" />
        </Field>
        <Switch label="Modo luva" />
        <Button>Confirmar pesagem</Button>
      </Stack>
    </Card>
  ),
};
