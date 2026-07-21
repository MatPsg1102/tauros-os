// Patterns — composições demonstrativas (dados fictícios, zero domínio):
// provam que as telas operacionais futuras são montáveis só com o DS.

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import {
  AppShell,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  Container,
  EmptyState,
  ErrorState,
  Field,
  Flex,
  Heading,
  Input,
  LoadingState,
  NavigationBar,
  NavigationItem,
  NumberInput,
  Page,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Progress,
  ResponsiveGrid,
  Section,
  SegmentedControl,
  Sidebar,
  SplitView,
  Stack,
  StickyRegion,
  Text,
  ToastProvider,
  TopBar,
  useToast,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Patterns/Composições',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Padrões compostos exclusivamente com a API pública — sem componentes novos, sem regra de negócio, dados fictícios em pt-BR.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const TAREFAS = [
  { nome: 'Desossa de dianteiro', status: 'warn' as const, progresso: 3, total: 8 },
  { nome: 'Etiquetagem de bandejas', status: 'success' as const, progresso: 8, total: 8 },
  { nome: 'Conferência de câmara fria', status: 'info' as const, progresso: 1, total: 4 },
];

export const ApplicationShell: Story = {
  name: 'Application Shell',
  render: () => (
    <AppShell
      skipLink={{ label: 'Ir para o conteúdo', targetId: 'app-main' }}
      topBar={<TopBar title="Tauros OS" actions={<Button size="sm">Nova tarefa</Button>} />}
      sidebar={
        <Sidebar>
          <NavigationItem label="Painel" link={{ href: '#painel' }} current />
          <NavigationItem
            label="Tarefas"
            link={{ href: '#tarefas' }}
            badge={<Badge status="warn">3</Badge>}
          />
          <NavigationItem label="Estoque" link={{ href: '#estoque' }} />
        </Sidebar>
      }
      navigationBar={
        <NavigationBar>
          <NavigationItem label="Painel" link={{ href: '#painel' }} current />
          <NavigationItem label="Tarefas" link={{ href: '#tarefas' }} />
        </NavigationBar>
      }
    >
      <Page id="app-main">
        <PageHeader
          title="Painel do turno"
          description="Manhã · 06:00–14:00"
          status={<Badge status="success">Aberto</Badge>}
        />
        <Section title="Resumo">
          <ResponsiveGrid itemSize="sm">
            {['Pesagens', 'Perdas', 'Etiquetas'].map((k) => (
              <Card key={k}>
                <Text role="label">{k}</Text>
                <Text role="data">42</Text>
              </Card>
            ))}
          </ResponsiveGrid>
        </Section>
      </Page>
    </AppShell>
  ),
};

function FormularioOperacional(): React.ReactElement {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  return (
    <Page as="section" aria-label="Registro de perda">
      <PageHeader title="Registro de perda" description="Preencha os dados apurados na bancada" />
      <Container size="narrow">
        <Section title="Dados da perda">
          <Stack gap={200}>
            <Field label="Produto" required>
              <Input defaultValue="Picanha bovina" />
            </Field>
            <Field label="Quantidade (kg)" description="Locale pt-BR" required>
              <NumberInput min={0} max={500} />
            </Field>
            <Field label="Motivo" error="Informe o motivo da perda">
              <Input />
            </Field>
          </Stack>
        </Section>
      </Container>
      <StickyRegion position="bottom">
        <Flex justify="end" gap={100} style={{ padding: 'var(--tauros-space-inset-sm)' }}>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Registrar perda
          </Button>
        </Flex>
      </StickyRegion>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Registrar perda?"
        description="O registro entra na auditoria do turno e não pode ser apagado."
        destructive
        confirmLabel="Registrar"
        cancelLabel="Revisar dados"
        onConfirm={() => {
          toast({ title: 'Perda registrada', description: 'Auditoria atualizada' });
        }}
      />
    </Page>
  );
}

export const OperationalForm: Story = {
  name: 'Operational Form',
  render: () => (
    <ToastProvider>
      <FormularioOperacional />
    </ToastProvider>
  ),
};

export const TaskList: Story = {
  name: 'Task List',
  render: () => (
    <Page as="section" aria-label="Quadro de tarefas">
      <PageHeader
        title="Tarefas do turno"
        actions={
          <SegmentedControl
            aria-label="Filtro"
            defaultValue="todas"
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'pendentes', label: 'Pendentes' },
            ]}
          />
        }
      />
      <Flex gap={100} wrap>
        <Chip selected>Produção</Chip>
        <Chip>Estoque</Chip>
        <Chip>Limpeza</Chip>
      </Flex>
      <Section title="Em andamento">
        <ResponsiveGrid itemSize="md">
          {TAREFAS.map((tarefa) => (
            <Card key={tarefa.nome}>
              <Stack gap={100}>
                <Flex justify="between">
                  <Heading level={3} visualLevel={4}>
                    {tarefa.nome}
                  </Heading>
                  <Badge status={tarefa.status}>
                    {tarefa.progresso === tarefa.total ? 'Concluída' : 'Em andamento'}
                  </Badge>
                </Flex>
                <Progress
                  label={`Progresso de ${tarefa.nome}`}
                  value={tarefa.progresso}
                  max={tarefa.total}
                  valueText={`${String(tarefa.progresso)} de ${String(tarefa.total)}`}
                  showValueText
                />
              </Stack>
            </Card>
          ))}
        </ResponsiveGrid>
      </Section>
    </Page>
  ),
};

export const MasterDetail: Story = {
  name: 'Master Detail',
  render: () => (
    <Page as="section" aria-label="Catálogo">
      <PageHeader title="Catálogo de cortes" />
      <Section title="Lista e detalhe">
        <SplitView
          ratio="1:2"
          primary={
            <Panel fill>
              <PanelHeader title="Cortes" />
              <PanelBody>
                <Stack gap={100}>
                  {['Picanha', 'Alcatra', 'Contrafilé'].map((corte, index) => (
                    <Card key={corte} {...(index === 0 ? { 'aria-current': 'true' } : {})}>
                      {corte}
                    </Card>
                  ))}
                </Stack>
              </PanelBody>
            </Panel>
          }
          secondary={
            <Panel fill>
              <PanelHeader title="Picanha bovina" actions={<Badge status="success">Ativo</Badge>} />
              <PanelBody>
                <Stack gap={100}>
                  <Text role="data">Preço/kg: R$ 89,90 · Estoque: 42,5 kg</Text>
                  <Text tone="secondary">
                    Detalhe estático demonstrativo — seleção é da aplicação.
                  </Text>
                </Stack>
              </PanelBody>
            </Panel>
          }
        />
      </Section>
    </Page>
  ),
};

export const DashboardComposition: Story = {
  name: 'Dashboard Composition',
  render: () => (
    <Page as="section" aria-label="Indicadores">
      <PageHeader title="Indicadores do dia" />
      <Banner status="info">Dados fictícios para demonstração de composição.</Banner>
      <Section title="Resumo do dia">
        <ResponsiveGrid itemSize="sm">
          {[
            ['Pesagens', '128'],
            ['Perdas (kg)', '4,2'],
            ['Tarefas', '9/12'],
            ['Etiquetas', '312'],
          ].map(([label, value]) => (
            <Card key={label}>
              <Text role="label" tone="secondary">
                {label}
              </Text>
              <Heading level={3} visualLevel={2}>
                {value}
              </Heading>
            </Card>
          ))}
        </ResponsiveGrid>
      </Section>
    </Page>
  ),
};

function EstadosAlternados(): React.ReactElement {
  const [estado, setEstado] = useState<'loading' | 'empty' | 'error' | 'dados'>('loading');
  return (
    <Page as="section" aria-label="Estados">
      <PageHeader
        title="Troca de estados na mesma estrutura"
        actions={
          <SegmentedControl
            aria-label="Estado"
            value={estado}
            onValueChange={(value) => setEstado(value as typeof estado)}
            options={[
              { value: 'loading', label: 'Loading' },
              { value: 'empty', label: 'Empty' },
              { value: 'error', label: 'Error' },
              { value: 'dados', label: 'Dados' },
            ]}
          />
        }
      />
      <Section title="Região demonstrada">
        <Panel>
          <PanelHeader title="Tarefas" />
          <PanelBody>
            {estado === 'loading' && <LoadingState label="Carregando tarefas" />}
            {estado === 'empty' && (
              <EmptyState
                title="Nenhuma tarefa"
                description="Crie a primeira tarefa do turno"
                action={<Button>Nova tarefa</Button>}
              />
            )}
            {estado === 'error' && (
              <ErrorState
                title="Falha ao carregar"
                errorReference="REF-2026-0042"
                retryAction={<Button>Tentar novamente</Button>}
              />
            )}
            {estado === 'dados' && <Text>3 tarefas em andamento.</Text>}
          </PanelBody>
        </Panel>
      </Section>
    </Page>
  );
}

export const LoadingEmptyError: Story = {
  name: 'Loading, Empty and Error',
  render: () => <EstadosAlternados />,
};
