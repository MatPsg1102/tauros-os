// Layouts — Page/Container/PageHeader/Section/Panel/ResponsiveGrid/SplitView/
// StickyRegion. Grid (colunas explícitas) ≠ ResponsiveGrid (fluxo por medida
// mínima) · Surface/Card (superfícies) ≠ Panel (contrato operacional).

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Container,
  Field,
  Input,
  Page,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  ResponsiveGrid,
  Section,
  SplitView,
  Stack,
  StickyRegion,
  Text,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Layouts/Structure',
  parameters: {
    docs: {
      description: {
        component:
          'Page é o landmark da tela (main único — dois main geram erro orientado); Container só restringe largura (narrow=65ch leitura, standard/wide=breakpoints, full); PageHeader é o contexto da página (≠ TopBar). Section organiza tema; Panel entrega corpo rolável.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const PaginaComLarguras: Story = {
  name: 'Page + Container: larguras e densidade',
  render: () => (
    <Page as="section" density="compact" aria-label="Demonstração de larguras">
      {(['narrow', 'standard', 'wide', 'full'] as const).map((size) => (
        <Container key={size} size={size}>
          <Card>
            <Text role="label">Container {size}</Text>
            <Text tone="secondary">
              Texto de exemplo para visualizar a largura máxima correspondente.
            </Text>
          </Card>
        </Container>
      ))}
    </Page>
  ),
};

export const CabecalhoDePagina: Story = {
  name: 'PageHeader: completo e título longo',
  render: () => (
    <Stack gap={300}>
      {/* header dentro de section não é banner — evita landmarks duplicados */}
      <Page as="section" aria-label="Cabeçalho completo">
        <PageHeader
          title="Abertura de turno"
          eyebrow="Produção"
          description="Confira equipe, balanças e etiquetas antes de iniciar"
          breadcrumb={
            <Breadcrumb items={[{ label: 'Início', link: { href: '#' } }, { label: 'Turnos' }]} />
          }
          status={<Badge status="success">Pronto</Badge>}
          actions={
            <>
              <Button variant="secondary">Adiar</Button>
              <Button>Iniciar turno</Button>
            </>
          }
        />
      </Page>
      <Page as="section" aria-label="Cabeçalho com título longo">
        <PageHeader
          title="Conferência de recebimento de carcaças bovinas do fornecedor com nome extremamente longo para validar quebra e empilhamento no mobile"
          actions={
            <>
              <Button variant="secondary">Ação secundária</Button>
              <Button variant="secondary">Outra ação</Button>
              <Button>Ação primária</Button>
            </>
          }
        />
      </Page>
    </Stack>
  ),
};

export const SecoesEPaineis: Story = {
  name: 'Section + Panel (corpo rolável, footer)',
  render: () => (
    <Section
      title="Tarefas do turno"
      description="Painéis com altura controlada"
      actions={<Button size="sm">Nova tarefa</Button>}
    >
      <ResponsiveGrid itemSize="md">
        <div style={{ height: '16rem', display: 'flex' }}>
          <Panel fill>
            <PanelHeader title="Corpo rolável" actions={<Badge status="info">12</Badge>} />
            <PanelBody>
              {Array.from({ length: 12 }, (_, i) => (
                <Text key={i}>Tarefa {i + 1} — o corpo rola; header/footer ficam fixos.</Text>
              ))}
            </PanelBody>
            <PanelFooter>
              <Button size="sm" variant="secondary">
                Ver todas
              </Button>
            </PanelFooter>
          </Panel>
        </div>
        <Panel>
          <PanelHeader title="Painel simples" />
          <PanelBody>
            <Text tone="secondary">Sem altura fixa: cresce com o conteúdo.</Text>
          </PanelBody>
        </Panel>
      </ResponsiveGrid>
    </Section>
  ),
};

export const GridResponsivo: Story = {
  name: 'ResponsiveGrid: medidas e volumes',
  render: () => (
    <Stack gap={300}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Section key={size} title={`itemSize=${size}`}>
          <ResponsiveGrid itemSize={size}>
            {Array.from({ length: size === 'sm' ? 8 : 4 }, (_, i) => (
              <Card key={i}>
                <Text role="label">Indicador {i + 1}</Text>
                <Text role="data">1.284,5 kg</Text>
              </Card>
            ))}
          </ResponsiveGrid>
        </Section>
      ))}
      <Section title="Alturas diferentes e nomes longos">
        <ResponsiveGrid itemSize="sm">
          <Card>Curto</Card>
          <Card>
            Conteúdo maior com um nome de corte bastante extenso que valida o alinhamento entre
            itens de alturas distintas dentro da mesma linha do grid.
          </Card>
          <Card>Médio de duas linhas de texto.</Card>
        </ResponsiveGrid>
      </Section>
    </Stack>
  ),
};

export const DivisaoMestreDetalhe: Story = {
  name: 'SplitView: ratios e mestre–detalhe',
  render: () => (
    <Stack gap={300}>
      <SplitView
        ratio="1:2"
        primary={
          <Panel fill>
            <PanelHeader title="Cortes" />
            <PanelBody>
              {['Picanha', 'Alcatra', 'Contrafilé', 'Costela'].map((corte) => (
                <Text key={corte}>{corte}</Text>
              ))}
            </PanelBody>
          </Panel>
        }
        secondary={
          <Panel fill>
            <PanelHeader title="Detalhe" />
            <PanelBody>
              <Text tone="secondary">
                A seleção pertence à aplicação/rota — o SplitView só estrutura. No mobile as regiões
                empilham (media query tokenizada).
              </Text>
            </PanelBody>
          </Panel>
        }
      />
      <SplitView
        orientation="vertical"
        ratio="1:1"
        primary={<Card>Região superior</Card>}
        secondary={<Card>Região inferior</Card>}
      />
    </Stack>
  ),
};

export const RegiaoFixa: Story = {
  name: 'StickyRegion: formulário com ações fixas',
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ height: '60vh', overflowY: 'auto' }}>
      <Page as="section" aria-label="Formulário longo">
        <StickyRegion position="top">
          <Text role="label" style={{ padding: 'var(--tauros-space-inset-sm)' }}>
            Filtros fixos no topo do container de scroll
          </Text>
        </StickyRegion>
        <Container size="narrow">
          <Stack gap={200}>
            {Array.from({ length: 8 }, (_, i) => (
              <Field key={i} label={`Campo ${i + 1}`}>
                <Input />
              </Field>
            ))}
          </Stack>
        </Container>
        <StickyRegion position="bottom">
          <div
            style={{
              display: 'flex',
              gap: 'var(--tauros-space-gap-100)',
              padding: 'var(--tauros-space-inset-sm)',
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="secondary">Cancelar</Button>
            <Button>Salvar alterações</Button>
          </div>
        </StickyRegion>
      </Page>
    </div>
  ),
};
