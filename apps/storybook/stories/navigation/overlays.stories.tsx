// Navigation — Drawer, BottomSheet, Menu, ContextMenu (fundação 6.3.5
// reutilizada; validação visual de posicionamento perto das bordas).

import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from '@storybook/test';
import React, { useState } from 'react';

import {
  BottomSheet,
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Drawer,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  Stack,
  StickyRegion,
  Text,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Navigation/Overlays',
  parameters: {
    docs: {
      description: {
        component:
          'Drawer = Dialog lateral; BottomSheet = Dialog inferior (mesma fundação: portal, pilha, foco, scroll lock — sem gesto de arrastar, não congelado). Menu tem contrato semântico próprio (roving, typeahead, checkbox/radio); ContextMenu compartilha a fundação com trigger por ponto.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function DrawerDemo({ side }: { readonly side: 'left' | 'right' }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Drawer {side === 'left' ? 'esquerdo' : 'direito'}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side={side}
        title="Detalhe do corte"
        closeLabel="Fechar painel"
      >
        <Stack gap={200}>
          {Array.from({ length: 20 }, (_, i) => (
            <Text key={i}>Linha {i + 1} — conteúdo rolável do drawer.</Text>
          ))}
        </Stack>
      </Drawer>
    </>
  );
}

export const Drawers: Story = {
  name: 'Drawer: lados e conteúdo longo',
  render: () => (
    <Stack gap={100}>
      <DrawerDemo side="left" />
      <DrawerDemo side="right" />
    </Stack>
  ),
};

function SheetDemo(): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir BottomSheet
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Ações rápidas"
        closeLabel="Fechar ações"
      >
        <Stack gap={100}>
          <Button fullWidth>Registrar pesagem</Button>
          <Button fullWidth variant="secondary">
            Registrar perda
          </Button>
          <StickyRegion position="bottom">
            <Button fullWidth variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </StickyRegion>
        </Stack>
      </BottomSheet>
    </>
  );
}

export const Sheet: Story = {
  name: 'BottomSheet (mobile, safe area, altura máx.)',
  render: () => <SheetDemo />,
};

export const MenuCompleto: Story = {
  name: 'Menu: itens, checkbox, radio, typeahead',
  render: () => (
    <Menu>
      <MenuTrigger>Ações do item</MenuTrigger>
      <MenuContent aria-label="Ações do item">
        <MenuLabel>Operação</MenuLabel>
        <MenuItem onSelect={() => undefined}>Editar</MenuItem>
        <MenuItem onSelect={() => undefined}>Pesar novamente</MenuItem>
        <MenuSeparator />
        <MenuCheckboxItem checked onCheckedChange={() => undefined}>
          Somente ativos
        </MenuCheckboxItem>
        <MenuRadioGroup value="dia" onValueChange={() => undefined}>
          <MenuRadioItem value="dia">Por dia</MenuRadioItem>
          <MenuRadioItem value="semana">Por semana</MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem disabled onSelect={() => undefined}>
          Excluir (sem permissão)
        </MenuItem>
      </MenuContent>
    </Menu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Ações do item' }));
    await waitFor(async () => {
      const menu = canvasElement.ownerDocument.body.querySelector('[role="menu"]');
      await expect(menu).not.toBeNull();
    });
    await userEvent.keyboard('{Escape}');
  },
};

export const MenuContextual: Story = {
  name: 'ContextMenu: clique secundário e bordas',
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div
      style={{
        height: '60vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'var(--tauros-space-inset-md)',
      }}
    >
      <ContextMenu>
        <ContextMenuTrigger>
          <Text>Clique com o botão direito AQUI (perto do topo) — Shift+F10 também abre.</Text>
        </ContextMenuTrigger>
        <ContextMenuContent aria-label="Ações do registro">
          <ContextMenuItem onSelect={() => undefined}>Duplicar</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => undefined}>Arquivar</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <ContextMenu>
        <ContextMenuTrigger>
          <Text>Clique com o botão direito AQUI (perto da base) — o menu faz flip.</Text>
        </ContextMenuTrigger>
        <ContextMenuContent aria-label="Ações próximas à borda">
          <ContextMenuItem onSelect={() => undefined}>Duplicar</ContextMenuItem>
          <ContextMenuItem onSelect={() => undefined}>Arquivar</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  ),
};
