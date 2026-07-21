// Patterns/Shift Opening (7.1 §40) — os estados da jornada de abertura de
// turno como composições demonstrativas (dados fictícios, view controlado).
// A tela real vive em apps/web consumindo os MESMOS componentes públicos;
// aqui não há domínio nem fila — apenas o contrato visual dos estados.

import type { Meta, StoryObj } from '@storybook/react';
import React, { type ReactElement, type ReactNode } from 'react';

import {
  Alert,
  AppShell,
  Badge,
  Banner,
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  Page,
  PageHeader,
  PinInput,
  Section,
  Select,
  Stack,
  Text,
  TopBar,
} from '@tauros/ui-primitives';

const meta = {
  title: 'Patterns/Shift Opening',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Estados oficiais da jornada de abertura de turno (vertical slice 7.1). Linguagem operacional: distingue "salvo neste aparelho" de "confirmado pelo servidor"; conflito nunca vira erro genérico.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function shell(children: ReactNode, online: boolean): ReactElement {
  return (
    <AppShell topBar={<TopBar title="Tauros OS" />}>
      <Page>
        <PageHeader
          title="Abertura de turno"
          eyebrow="Casa de Carnes Modelo — Centro"
          status={
            online ? (
              <Badge status="success">Conectado</Badge>
            ) : (
              <Badge status="warn">Sem conexão — operação local segura</Badge>
            )
          }
        />
        {!online && (
          <Banner status="warning">
            Sem conexão com o servidor. Você pode abrir o turno normalmente: tudo fica salvo neste
            aparelho e será enviado quando a conexão voltar.
          </Banner>
        )}
        {children}
      </Page>
    </AppShell>
  );
}

export const Identificacao: Story = {
  name: 'Identificação (PIN fictício)',
  render: () =>
    shell(
      <Section title="Identificação do operador" description="Confirme quem está assumindo o turno">
        <Card>
          <Stack gap={200}>
            <Field label="Operador">
              <Select defaultValue="op1">
                <option value="op1">Marina Álvares</option>
                <option value="op2">Carlos Nunes</option>
              </Select>
            </Field>
            <Stack gap={100}>
              <Text role="label">PIN de operação</Text>
              <PinInput length={4} label="PIN de operação (demonstração)" />
            </Stack>
            <Button fullWidth>Confirmar identificação</Button>
          </Stack>
        </Card>
      </Section>,
      true,
    ),
};

export const Ready: Story = {
  name: 'Pronto para abrir',
  render: () =>
    shell(
      <Section title="Pronto para abrir" description="Nenhum turno aberto para você hoje">
        <Card>
          <Stack gap={200}>
            <Text>
              Loja: <strong>Casa de Carnes Modelo — Centro</strong>
            </Text>
            <Text tone="secondary">
              A abertura registra data e horário oficiais da loja e entra na auditoria do dia.
            </Text>
            <Button fullWidth>Abrir turno</Button>
          </Stack>
        </Card>
      </Section>,
      true,
    ),
};

export const OfflinePendingSync: Story = {
  name: 'Offline / Aguardando sincronização',
  render: () =>
    shell(
      <Section title="Turno aberto" actions={<Badge status="info">Aguardando sincronização</Badge>}>
        <Card>
          <Stack gap={100}>
            <Text>Turno aberto para Marina Álvares em 2026-07-21.</Text>
            <Text tone="secondary">
              Salvo neste aparelho. Será enviado ao servidor assim que houver conexão.
            </Text>
            <Button variant="secondary">Tentar sincronizar agora</Button>
          </Stack>
        </Card>
      </Section>,
      false,
    ),
};

export const Opened: Story = {
  name: 'Aberto e sincronizado',
  render: () =>
    shell(
      <Section title="Turno aberto" actions={<Badge status="success">Turno sincronizado</Badge>}>
        <Card>
          <Stack gap={100}>
            <Text>Turno aberto para Marina Álvares em 2026-07-21.</Text>
            <Text tone="secondary">Confirmado pelo servidor.</Text>
          </Stack>
        </Card>
      </Section>,
      true,
    ),
};

export const PermissionDenied: Story = {
  name: 'Sem permissão',
  render: () =>
    shell(
      <Alert status="warning" title="Sem permissão para abrir turno">
        Seu perfil não permite abrir o turno nesta loja. Procure o responsável pela unidade para
        ajustar o acesso.
      </Alert>,
      true,
    ),
};

export const ConfigurationError: Story = {
  name: 'Configuração indisponível',
  render: () =>
    shell(
      <ErrorState
        title="Configuração indisponível"
        description="Não foi possível carregar as configurações da loja. Tente novamente em instantes."
        retryAction={<Button>Tentar novamente</Button>}
      />,
      true,
    ),
};

export const Conflict: Story = {
  name: 'Conflito ao sincronizar',
  render: () =>
    shell(
      <Section
        title="Conflito ao sincronizar"
        actions={<Badge status="critical">Precisa de revisão</Badge>}
      >
        <Alert status="error" title="Turno já aberto em outro aparelho">
          Este turno foi aberto em outro dispositivo. O registro deste aparelho foi preservado para
          revisão do responsável — nada foi perdido nem duplicado.
        </Alert>
      </Section>,
      true,
    ),
};

export const Bootstrapping: Story = {
  name: 'Carregando',
  render: () => shell(<LoadingState label="Preparando o turno" />, true),
};
