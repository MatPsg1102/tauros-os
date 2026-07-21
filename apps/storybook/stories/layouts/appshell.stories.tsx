// Layouts/AppShell — estrutura da aplicação (validação de scroll único,
// 100dvh, sidebar/topbar/navbar, safe areas, overlays sobre o shell).
// Use os viewports da toolbar para mobile/tablet/desktop.

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import {
  AppShell,
  Badge,
  Button,
  Card,
  Dialog,
  NavigationBar,
  NavigationGroup,
  NavigationItem,
  Page,
  PageHeader,
  ResponsiveGrid,
  Section,
  Sidebar,
  Text,
  ToastProvider,
  TopBar,
  useToast,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Layouts/AppShell',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'AppShell por slots — UMA região de scroll (o shell trava em 100dvh e só o conteúdo rola). Page ≠ AppShell: o shell estrutura a aplicação; a Page é o landmark main da tela. Sidebar some no mobile (breakpoint token) e a NavigationBar do slot assume, com safe area aplicada uma única vez.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function shellSidebar(): React.ReactElement {
  return (
    <Sidebar toggleLabel="Alternar navegação">
      <NavigationGroup title="Operação">
        <NavigationItem label="Painel" link={{ href: '#painel' }} current />
        <NavigationItem
          label="Tarefas"
          link={{ href: '#tarefas' }}
          badge={<Badge status="warn">5</Badge>}
        />
        <NavigationItem label="Produção" link={{ href: '#producao' }} />
      </NavigationGroup>
      <NavigationGroup title="Gestão" collapsible>
        <NavigationItem label="Estoque" link={{ href: '#estoque' }} />
        <NavigationItem label="Relatórios" link={{ href: '#relatorios' }} />
      </NavigationGroup>
    </Sidebar>
  );
}

function shellNavbar(): React.ReactElement {
  return (
    <NavigationBar>
      <NavigationItem label="Painel" link={{ href: '#painel' }} current />
      <NavigationItem
        label="Tarefas"
        link={{ href: '#tarefas' }}
        badge={<Badge status="info">5</Badge>}
      />
      <NavigationItem label="Estoque" link={{ href: '#estoque' }} />
    </NavigationBar>
  );
}

export const Desktop: Story = {
  render: () => (
    <AppShell
      skipLink={{ label: 'Ir para o conteúdo', targetId: 'conteudo' }}
      topBar={
        <TopBar
          title="Tauros OS — Unidade Centro"
          actions={<Button size="sm">Nova tarefa</Button>}
        />
      }
      sidebar={shellSidebar()}
      navigationBar={shellNavbar()}
    >
      <Page id="conteudo">
        <PageHeader title="Painel do turno" description="Resumo operacional do dia" />
        <Section title="Indicadores">
          <ResponsiveGrid itemSize="sm">
            {['Pesagens', 'Perdas', 'Tarefas', 'Etiquetas'].map((name) => (
              <Card key={name}>
                <Text role="label">{name}</Text>
                <Text role="data">128</Text>
              </Card>
            ))}
          </ResponsiveGrid>
        </Section>
      </Page>
    </AppShell>
  ),
};

export const ConteudoLongo: Story = {
  name: 'Conteúdo longo (scroll único)',
  render: () => (
    <AppShell
      topBar={<TopBar title="Tauros OS" />}
      sidebar={shellSidebar()}
      navigationBar={shellNavbar()}
    >
      <Page>
        <PageHeader title="Lista longa" />
        {Array.from({ length: 40 }, (_, i) => (
          <Card key={i}>
            <Text>
              Item {i + 1} — apenas a região de conteúdo rola; topo e navegação ficam fixos.
            </Text>
          </Card>
        ))}
      </Page>
    </AppShell>
  ),
};

function OverlaysNoShell(): React.ReactElement {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  return (
    <AppShell topBar={<TopBar title="Tauros OS" />} sidebar={shellSidebar()}>
      <Page>
        <PageHeader
          title="Overlays sobre o shell"
          actions={
            <>
              <Button variant="secondary" onClick={() => toast({ title: 'Pesagem registrada' })}>
                Toast
              </Button>
              <Button onClick={() => setOpen(true)}>Dialog</Button>
            </>
          }
        />
        {Array.from({ length: 20 }, (_, i) => (
          <Card key={i}>Linha {i + 1}</Card>
        ))}
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Sobre layouts com scroll"
          closeLabel="Fechar"
        >
          <Text>O fundo trava (scroll lock) e o diálogo rola internamente se preciso.</Text>
        </Dialog>
      </Page>
    </AppShell>
  );
}

export const ToastEDialog: Story = {
  name: 'Toast e Dialog sobre o shell',
  render: () => (
    <ToastProvider>
      <OverlaysNoShell />
    </ToastProvider>
  ),
};
