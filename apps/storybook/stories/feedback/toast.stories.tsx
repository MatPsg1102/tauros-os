// Feedback/Toast — harness demonstrativo da fila (API pública useToast).

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Button, Flex, Stack, Text, ToastProvider, useToast } from '@tauros/ui-primitives';

const meta = {
  title: 'Feedback/Toast',
  parameters: {
    docs: {
      description: {
        component:
          'Fila própria: timers iniciam só quando o toast fica visível; hover/foco pausam; dedupe apenas por id explícito; prioridade urgent usa role=alert e dura mais. Toasts não substituem erros críticos de formulário.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ToastHarness(): React.ReactElement {
  const { toast, update, clear } = useToast();
  let counter = 0;
  return (
    <Stack gap={200}>
      <Text tone="secondary">A região vive no canto inferior direito (z-toast).</Text>
      <Flex gap={100} wrap>
        <Button
          variant="secondary"
          onClick={() =>
            toast({ title: 'Pesagem registrada', description: '12,450 kg · lote 0042' })
          }
        >
          Informativo
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast({
              title: 'Falha ao imprimir etiqueta',
              description: 'Verifique a impressora da bancada 02',
              priority: 'urgent',
            })
          }
        >
          Urgente (role=alert)
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast({
              title: 'Fila pausada',
              duration: null,
              actionLabel: 'Retomar',
              onAction: () => undefined,
            })
          }
        >
          Persistente com ação
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            toast({ id: 'sync', title: 'Sincronizando…' });
            setTimeout(
              () => update('sync', { title: 'Sincronizado', description: '8 itens enviados' }),
              1200,
            );
          }}
        >
          Dedupe por id (atualiza)
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            for (counter = 1; counter <= 5; counter += 1) {
              toast({ title: `Item ${String(counter)} processado` });
            }
          }}
        >
          Fila (5 itens, máx. 3 visíveis)
        </Button>
        <Button variant="ghost" onClick={clear}>
          Limpar todos
        </Button>
      </Flex>
    </Stack>
  );
}

export const Harness: Story = {
  name: 'Harness da fila',
  render: () => (
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>
  ),
};
