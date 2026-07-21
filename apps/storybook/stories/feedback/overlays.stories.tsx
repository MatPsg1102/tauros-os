// Feedback — Dialog/Modal/ConfirmDialog (fundação de overlays 6.3.5).

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { Button, ConfirmDialog, Dialog, Field, Input, Stack, Text } from '@tauros/ui-primitives';

const meta = {
  title: 'Feedback/Dialog & Confirm',
  parameters: {
    docs: {
      description: {
        component:
          'Dialog exige nome acessível (erro orientado sem title/aria-label). Modal = variante modal de Dialog. ConfirmDialog: destrutivo foca a ação SEGURA; falha assíncrona mantém aberto com mensagem segura (nunca a exceção bruta) e permite retry.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function DialogDemo(): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir diálogo</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Revisar pesagem"
        description="Confira os dados antes de confirmar o registro"
        closeLabel="Fechar diálogo"
      >
        <Stack gap={200}>
          <Field label="Peso líquido (kg)">
            <Input inputMode="decimal" defaultValue="12,450" />
          </Field>
          <Text tone="secondary">
            Conteúdo longo para validar rolagem interna: o diálogo limita a altura e rola o próprio
            corpo, mantendo o fundo bloqueado.
          </Text>
          <Button onClick={() => setOpen(false)}>Confirmar</Button>
        </Stack>
      </Dialog>
    </>
  );
}

export const DialogBasico: Story = {
  name: 'Dialog (título, descrição, foco)',
  render: () => <DialogDemo />,
};

function NestedDemo(): React.ReactElement {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <Button onClick={() => setOuter(true)}>Abrir externo</Button>
      <Dialog
        open={outer}
        onOpenChange={setOuter}
        title="Diálogo externo"
        closeLabel="Fechar externo"
      >
        <Stack gap={200}>
          <Text>Escape fecha somente o overlay do topo (pilha determinística).</Text>
          <Button onClick={() => setInner(true)}>Abrir interno</Button>
        </Stack>
        <Dialog
          open={inner}
          onOpenChange={setInner}
          title="Diálogo interno"
          closeLabel="Fechar interno"
        >
          <Text>Interno acima do externo pela ordem de montagem (mesmo token de camada).</Text>
        </Dialog>
      </Dialog>
    </>
  );
}

export const Aninhados: Story = { name: 'Diálogos aninhados', render: () => <NestedDemo /> };

function ConfirmDemo({ failFirst }: { readonly failFirst: boolean }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [attempts, setAttempts] = useState(0);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Excluir corte
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir corte do catálogo"
        description="Esta ação remove o corte de todas as listas desta unidade."
        destructive
        confirmLabel="Excluir"
        cancelLabel="Manter corte"
        errorMessage="Não foi possível excluir agora. Tente novamente."
        onConfirm={async () => {
          setAttempts((n) => n + 1);
          await new Promise((resolve) => setTimeout(resolve, 700));
          if (failFirst && attempts === 0) throw new Error('detalhe interno que NUNCA aparece');
        }}
      />
    </>
  );
}

export const ConfirmacaoDestrutiva: Story = {
  name: 'ConfirmDialog destrutivo (foco na ação segura)',
  render: () => <ConfirmDemo failFirst={false} />,
};

export const FalhaSeguraComRetry: Story = {
  name: 'ConfirmDialog: falha segura + retry',
  render: () => <ConfirmDemo failFirst />,
};
