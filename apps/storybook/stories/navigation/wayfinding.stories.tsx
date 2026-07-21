// Navigation — Breadcrumb, Tabs, Stepper, Pagination.
// Breadcrumb (onde estou) ≠ Stepper (progresso em etapas) ≠ Progress
// (contínuo) · Tabs (conteúdo) ≠ SegmentedControl (filtro/modo).

import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React from 'react';

import {
  Breadcrumb,
  Pagination,
  Stack,
  Stepper,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Navigation/Wayfinding',
  parameters: {
    docs: {
      description: {
        component:
          'Tabs implementa o padrão ARIA completo (roving focus, ativação automática/manual — Setas/Home/End). Stepper usa aria-current="step" com glifos além da cor. Pagination expõe links neutros OU callbacks.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Trilhas: Story = {
  name: 'Breadcrumb: curto, longo, item único',
  render: () => (
    <Stack gap={200}>
      <Breadcrumb label="Trilha (item único)" items={[{ label: 'Início' }]} />
      <Breadcrumb
        label="Trilha padrão"
        items={[
          { label: 'Início', link: { href: '#' } },
          { label: 'Estoque', link: { href: '#' } },
          { label: 'Cortes bovinos' },
        ]}
      />
      <div style={{ maxWidth: '40ch' }}>
        <Breadcrumb
          label="Trilha longa"
          items={[
            { label: 'Início', link: { href: '#' } },
            { label: 'Gestão de unidades da rede', link: { href: '#' } },
            { label: 'Unidade Centro — Casa de Carnes Modelo', link: { href: '#' } },
            { label: 'Relatório de perdas do período com nome extenso' },
          ]}
        />
      </div>
    </Stack>
  ),
};

export const Abas: Story = {
  name: 'Tabs: automática, manual, vertical, teclado',
  render: () => (
    <Stack gap={300}>
      <Tabs defaultValue="resumo">
        <TabList aria-label="Visões do turno">
          <Tab value="resumo">Resumo</Tab>
          <Tab value="tarefas">Tarefas</Tab>
          <Tab value="perdas" disabled>
            Perdas
          </Tab>
        </TabList>
        <TabPanel value="resumo">Ativação automática: setas movem e selecionam.</TabPanel>
        <TabPanel value="tarefas">Conteúdo de tarefas.</TabPanel>
        <TabPanel value="perdas">—</TabPanel>
      </Tabs>
      <Tabs defaultValue="a" activation="manual" orientation="vertical">
        <TabList aria-label="Seções (manual)">
          <Tab value="a">Manual A</Tab>
          <Tab value="b">Manual B</Tab>
        </TabList>
        <TabPanel value="a">Setas movem o foco; Enter/Espaço selecionam.</TabPanel>
        <TabPanel value="b">Painel B.</TabPanel>
      </Tabs>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabResumo = canvas.getByRole('tab', { name: 'Resumo' });
    tabResumo.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Tarefas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  },
};

export const Etapas: Story = {
  name: 'Stepper: estados e navegável',
  render: () => (
    <Stack gap={300}>
      <Stepper
        aria-label="Processo de produção"
        steps={[
          { label: 'Pesagem', status: 'completed' },
          { label: 'Etiquetagem', status: 'current', description: 'Em andamento' },
          { label: 'Conferência', status: 'error' },
          { label: 'Estoque', status: 'upcoming' },
          { label: 'Auditoria', status: 'disabled' },
        ]}
      />
      <Stepper
        aria-label="Navegável"
        navigable
        onStepSelect={() => undefined}
        steps={[
          { label: 'Dados gerais', status: 'completed' },
          { label: 'Preços', status: 'current' },
          { label: 'Revisão', status: 'upcoming' },
        ]}
      />
      <Stepper
        aria-label="Vertical"
        orientation="vertical"
        steps={[
          { label: 'Recebimento', status: 'completed' },
          { label: 'Desossa com descrição de etapa longa para validar quebra', status: 'current' },
        ]}
      />
    </Stack>
  ),
};

export const Paginas: Story = {
  name: 'Pagination: casos de borda',
  render: () => (
    <Stack gap={200}>
      <Text role="caption" tone="tertiary">
        Uma página (navegação desabilitada):
      </Text>
      <Pagination
        currentPage={1}
        totalPages={1}
        labels={{ navigation: 'Paginação (uma página)' }}
      />
      <Text role="caption" tone="tertiary">
        Início / meio / fim de 42 páginas (reticências determinísticas):
      </Text>
      <Pagination
        currentPage={1}
        totalPages={42}
        labels={{ navigation: 'Paginação (início)' }}
        onPageChange={() => undefined}
      />
      <Pagination
        currentPage={21}
        totalPages={42}
        labels={{ navigation: 'Paginação (meio)' }}
        onPageChange={() => undefined}
      />
      <Pagination
        currentPage={42}
        totalPages={42}
        labels={{ navigation: 'Paginação (fim)' }}
        onPageChange={() => undefined}
      />
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const atual = canvas.getAllByRole('button', { name: 'Página 21' })[0];
    await expect(atual).toHaveAttribute('aria-current', 'page');
  },
};
