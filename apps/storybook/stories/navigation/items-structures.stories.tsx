// Navigation — NavigationItem/Group, Sidebar, TopBar, NavigationBar, Fab,
// SegmentedControl. Sidebar (estrutural desktop) ≠ Drawer (overlay móvel);
// TopBar (barra da aplicação) ≠ NavigationBar (inferior móvel) ≠ PageHeader.

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import {
  Badge,
  Button,
  Drawer,
  Fab,
  NavigationBar,
  NavigationGroup,
  NavigationItem,
  SegmentedControl,
  Sidebar,
  Stack,
  Text,
  TopBar,
} from '@tauros/ui-primitives';
import { useState } from 'react';

const meta = {
  title: 'Navigation/Structures',
  parameters: {
    docs: {
      description: {
        component:
          'NavigationItem tem estados distintos: current (localização), active, disabled, unavailable (temporário) e pending. Links usam o adapter neutro (href sempre preservado). Permissões chegam prontas do consumidor.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const EstadosDoItem: Story = {
  name: 'NavigationItem: estados',
  render: () => (
    <Sidebar label="Estados demonstrativos">
      <NavigationItem label="Localização atual" link={{ href: '#atual' }} current />
      <NavigationItem label="Ativo por interação" link={{ href: '#ativo' }} active />
      <NavigationItem
        label="Com badge"
        link={{ href: '#badge' }}
        badge={<Badge status="info">3</Badge>}
      />
      <NavigationItem label="Pendente (sincronizando)" pending onSelect={() => undefined} />
      <NavigationItem label="Indisponível offline" unavailable onSelect={() => undefined} />
      <NavigationItem label="Desabilitado" disabled onSelect={() => undefined} />
      <NavigationItem
        label="Nome de destino bastante longo para validar truncamento"
        description="Com descrição auxiliar"
        link={{ href: '#longo' }}
      />
    </Sidebar>
  ),
};

export const SidebarComGrupos: Story = {
  name: 'Sidebar: grupos, colapso (profundidade ≤ 2)',
  render: () => (
    <div style={{ height: '60vh', display: 'flex' }}>
      <Sidebar toggleLabel="Alternar navegação">
        <NavigationGroup title="Operação">
          <NavigationItem label="Abertura de turno" link={{ href: '#turno' }} current />
          <NavigationItem
            label="Tarefas"
            link={{ href: '#tarefas' }}
            badge={<Badge status="warn">5</Badge>}
          />
        </NavigationGroup>
        <NavigationGroup title="Gestão" collapsible defaultExpanded={false}>
          <NavigationItem label="Equipes" link={{ href: '#equipes' }} />
          <NavigationItem label="Relatórios" link={{ href: '#relatorios' }} />
        </NavigationGroup>
      </Sidebar>
      <Text tone="secondary" style={{ padding: 'var(--tauros-space-inset-lg)' }}>
        Use o botão de alternar: colapsada, os rótulos permanecem acessíveis (visually-hidden).
      </Text>
    </div>
  ),
};

function SidebarNoDrawer(): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir navegação móvel</Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Navegação"
        side="left"
        closeLabel="Fechar navegação"
      >
        <Sidebar label="Menu principal">
          <NavigationItem label="Início" link={{ href: '#inicio' }} current />
          <NavigationItem label="Produção" link={{ href: '#producao' }} />
          <NavigationItem label="Estoque" link={{ href: '#estoque' }} />
        </Sidebar>
      </Drawer>
    </>
  );
}

export const SidebarMobileEmDrawer: Story = {
  name: 'Sidebar dentro de Drawer (mobile)',
  render: () => <SidebarNoDrawer />,
};

export const Barras: Story = {
  name: 'TopBar e NavigationBar',
  render: () => (
    <Stack gap={300}>
      <TopBar
        title="Produção — unidade Centro com nome bastante longo"
        leading={<Text role="label">☰</Text>}
        actions={<Button size="sm">Nova tarefa</Button>}
        trailing={<Badge status="success">Online</Badge>}
      />
      <NavigationBar>
        <NavigationItem label="Início" link={{ href: '#inicio' }} current />
        <NavigationItem
          label="Tarefas"
          link={{ href: '#tarefas' }}
          badge={<Badge status="info">2</Badge>}
        />
        <NavigationItem label="Estoque" link={{ href: '#estoque' }} />
        <NavigationItem label="Mais" onSelect={() => undefined} />
      </NavigationBar>
      <Text role="caption" tone="tertiary">
        No AppShell, a NavigationBar entra SEM `fixed` — o shell posiciona e aplica a safe area.
      </Text>
    </Stack>
  ),
};

export const FabESegmentos: Story = {
  name: 'Fab e SegmentedControl',
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ height: '50vh', padding: 'var(--tauros-space-inset-lg)' }}>
      <Stack gap={200}>
        <SegmentedControl
          aria-label="Período do relatório"
          defaultValue="dia"
          options={[
            { value: 'dia', label: 'Dia' },
            { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mês', disabled: true },
          ]}
        />
        <SegmentedControl
          aria-label="Modo com rótulos longos"
          defaultValue="a"
          options={[
            { value: 'a', label: 'Somente pendentes' },
            { value: 'b', label: 'Concluídas hoje' },
          ]}
        />
      </Stack>
      <Fab label="Nova pesagem" icon={<span aria-hidden>+</span>} />
      <Fab
        label="Nova pesagem"
        icon={<span aria-hidden>+</span>}
        extended
        style={{ insetInlineEnd: 'var(--tauros-space-gap-1000)' }}
      />
    </div>
  ),
};
