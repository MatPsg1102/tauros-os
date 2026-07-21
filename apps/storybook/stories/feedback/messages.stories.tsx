// Feedback — Alert, Banner, Progress e estados de região.
// Alert = persistente junto ao conteúdo · Banner = comunicação global de alta
// visibilidade · Toast = temporário sobreposto · Dialog = interrupção modal ·
// ErrorState = substitui a região de conteúdo.

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import {
  Alert,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  PanelBody,
  PanelHeader,
  Progress,
  ResponsiveGrid,
  Stack,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Feedback/Messages & States',
  parameters: {
    docs: {
      description: {
        component:
          'Alert vs Banner vs Toast vs Dialog vs ErrorState: persistente no fluxo · global de alta visibilidade · temporário em fila · interrupção modal · substituição de região. Live regions são explícitas (nunca assertivas por padrão).',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Alerts: Story = {
  name: 'Alert: status, título, ação, dismiss',
  render: () => (
    <Stack gap={200}>
      <Alert status="info" title="Sincronização pendente">
        3 pesagens aguardam envio. Elas serão sincronizadas automaticamente.
      </Alert>
      <Alert status="success" title="Turno aberto">
        Turno da manhã iniciado às 06:02.
      </Alert>
      <Alert
        status="warning"
        title="Estoque abaixo do mínimo"
        action={<Button size="sm">Ver itens</Button>}
      >
        4 cortes bovinos estão abaixo do estoque mínimo configurado para esta unidade.
      </Alert>
      <Alert status="error" title="Falha na impressora" onDismiss={() => undefined}>
        A impressora de etiquetas da bancada 02 não respondeu. Verifique o cabo de rede e tente
        novamente — este texto é intencionalmente longo para validar quebra de linha.
      </Alert>
    </Stack>
  ),
};

export const Banners: Story = {
  name: 'Banner: comunicação global',
  render: () => (
    <Stack gap={200}>
      <Banner status="critical" action={<Button size="sm">Detalhes</Button>}>
        Modo offline ativo — os dados serão sincronizados quando a conexão voltar.
      </Banner>
      <Banner status="info" onDismiss={() => undefined}>
        Manutenção programada neste sábado às 22h.
      </Banner>
      <Banner status="neutral">Configuração de impressão pendente para esta unidade.</Banner>
    </Stack>
  ),
};

export const Progresso: Story = {
  name: 'Progress: determinado e indeterminado',
  render: () => (
    <Stack gap={200} style={{ maxWidth: '65ch' }}>
      <Progress
        label="Sincronização da fila"
        value={3}
        min={0}
        max={8}
        valueText="3 de 8"
        showValueText
      />
      <Progress label="Processando lote" />
    </Stack>
  ),
};

export const EstadosDeRegiao: Story = {
  name: 'Loading / Empty / Error em painéis',
  render: () => (
    <ResponsiveGrid itemSize="md" gap={200}>
      <Panel>
        <PanelHeader title="Carregando" />
        <PanelBody>
          <LoadingState label="Carregando tarefas" />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title="Skeleton" />
        <PanelBody>
          <LoadingState variant="skeleton" lines={4} label="Carregando lista" />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title="Vazio" />
        <PanelBody>
          <EmptyState
            title="Nenhum corte cadastrado"
            description="Cadastre o primeiro corte desta unidade"
            action={<Button>Cadastrar corte</Button>}
          />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title="Erro" />
        <PanelBody>
          <ErrorState
            title="Falha ao carregar"
            description="Não foi possível carregar as tarefas"
            errorReference="REF-2026-0042"
            retryAction={<Button>Tentar novamente</Button>}
          />
        </PanelBody>
      </Panel>
    </ResponsiveGrid>
  ),
};
