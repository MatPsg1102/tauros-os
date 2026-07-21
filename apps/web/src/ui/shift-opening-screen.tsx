// Tela de Abertura de Turno (7.1 §21/§28) — apresentacional: consome APENAS
// o view model e o Design System público. Linguagem operacional (nunca
// termos técnicos); estado do turno permanece visível na página (toast não é
// o único lugar). Decisão ADR-020 registrada: fluxo de confirmação simples —
// composição React explícita, sem UI Metadata Engine (sem campos
// parametrizáveis neste slice).

'use client';

import { useState, type ReactElement } from 'react';

import {
  Alert,
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
} from '@tauros/ui-primitives';

import type { ShiftOpeningActions, ShiftOpeningView } from '../controllers/use-shift-opening.js';

function syncBadge(view: ShiftOpeningView): ReactElement {
  const status = view.session?.syncStatus;
  if (status === 'synced') return <Badge status="success">Turno sincronizado</Badge>;
  if (status === 'conflict') return <Badge status="critical">Conflito ao sincronizar</Badge>;
  if (status === 'failed') return <Badge status="error">Falha ao sincronizar</Badge>;
  return <Badge status="info">Aguardando sincronização</Badge>;
}

function IdentifyStep({
  view,
  actions,
}: {
  readonly view: ShiftOpeningView;
  readonly actions: ShiftOpeningActions;
}): ReactElement {
  const [employeeId, setEmployeeId] = useState(view.operators[0]?.employeeId ?? '');
  const [pin, setPin] = useState('');
  return (
    <Section title="Identificação do operador" description="Confirme quem está assumindo o turno">
      <Card>
        <Stack gap={200}>
          <Field label="Operador">
            <Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              {view.operators.map((candidate) => (
                <option key={candidate.employeeId} value={candidate.employeeId}>
                  {candidate.name}
                </option>
              ))}
            </Select>
          </Field>
          <Stack gap={100}>
            <Text role="label">PIN de operação</Text>
            <PinInput
              key={view.identifyError ?? 'pin'}
              length={4}
              label="PIN de operação"
              onValueChange={setPin}
            />
          </Stack>
          {view.identifyError !== null && (
            <Alert status="error" live="polite" title="Identificação não confirmada">
              {view.identifyError}
            </Alert>
          )}
          <Button
            fullWidth
            disabled={pin.length < 4}
            onClick={() => {
              void actions.identify(employeeId, pin);
              setPin('');
            }}
          >
            Confirmar identificação
          </Button>
        </Stack>
      </Card>
    </Section>
  );
}

export function ShiftOpeningScreen({
  view,
  actions,
}: {
  readonly view: ShiftOpeningView;
  readonly actions: ShiftOpeningActions;
}): ReactElement {
  return (
    <Page id="conteudo">
      <PageHeader
        title="Abertura de turno"
        eyebrow={view.store.name}
        description={
          view.operator === null
            ? 'Identifique-se para iniciar o turno de trabalho'
            : `Operador: ${view.operator.name}`
        }
        status={
          view.connectivity.readyToSync ? (
            <Badge status="success">Conectado</Badge>
          ) : (
            <Badge status="warn">Sem conexão — operação local segura</Badge>
          )
        }
      />

      {!view.connectivity.readyToSync && view.phase !== 'bootstrapping' && (
        <Banner status="warning">
          Sem conexão com o servidor. Você pode abrir o turno normalmente: tudo fica salvo neste
          aparelho e será enviado quando a conexão voltar.
        </Banner>
      )}

      {view.phase === 'bootstrapping' && <LoadingState label="Preparando o turno" />}

      {view.phase === 'identify' && <IdentifyStep view={view} actions={actions} />}

      {view.phase === 'ready' && (
        <Section title="Pronto para abrir" description="Nenhum turno aberto para você hoje">
          <Card>
            <Stack gap={200}>
              <Text>
                Loja: <strong>{view.store.name}</strong>
              </Text>
              <Text tone="secondary">
                A abertura registra data e horário oficiais da loja e entra na auditoria do dia.
              </Text>
              <Button fullWidth onClick={() => void actions.openShift()}>
                Abrir turno
              </Button>
            </Stack>
          </Card>
        </Section>
      )}

      {view.phase === 'submitting' && <LoadingState label="Abrindo o turno" />}

      {view.phase === 'opened' && view.session !== null && (
        <Section title="Turno aberto" actions={syncBadge(view)}>
          <Card>
            <Stack gap={100}>
              <div role="status">
                <Text>
                  Turno aberto para {view.operator?.name} em {view.session.operationalDate}.
                </Text>
              </div>
              <Text role="data" tone="secondary">
                Data operacional: {view.session.operationalDate} · Loja: {view.store.name}
              </Text>
              {view.session.syncStatus === 'queued' && (
                <>
                  <Text tone="secondary">
                    Salvo neste aparelho. Será enviado ao servidor assim que houver conexão.
                  </Text>
                  <Button variant="secondary" onClick={() => void actions.retrySync()}>
                    Tentar sincronizar agora
                  </Button>
                </>
              )}
              {view.session.syncStatus === 'synced' && (
                <Text tone="secondary">Confirmado pelo servidor.</Text>
              )}
            </Stack>
          </Card>
        </Section>
      )}

      {view.phase === 'denied' && (
        <Alert status="warning" title="Sem permissão para abrir turno">
          Seu perfil não permite abrir o turno nesta loja. Procure o responsável pela unidade para
          ajustar o acesso.
        </Alert>
      )}

      {view.phase === 'config-error' && (
        <ErrorState
          title="Configuração indisponível"
          description="Não foi possível carregar as configurações da loja. Tente novamente em instantes."
          retryAction={<Button onClick={() => void actions.openShift()}>Tentar novamente</Button>}
        />
      )}

      {view.phase === 'conflict' && (
        <Section
          title="Conflito ao sincronizar"
          actions={<Badge status="critical">Precisa de revisão</Badge>}
        >
          <Alert status="error" title="Turno já aberto em outro aparelho">
            Este turno foi aberto em outro dispositivo. O registro deste aparelho foi preservado
            para revisão do responsável — nada foi perdido nem duplicado.
          </Alert>
        </Section>
      )}

      {view.phase === 'error' && (
        <ErrorState
          title="Não foi possível abrir o turno"
          description={view.actionError ?? 'Tente novamente em instantes.'}
          retryAction={<Button onClick={() => void actions.openShift()}>Tentar novamente</Button>}
        />
      )}

      {view.actionError !== null && view.phase === 'identify' && (
        <Alert status="warning" live="polite" title="Sessão expirada">
          {view.actionError}
        </Alert>
      )}
    </Page>
  );
}
