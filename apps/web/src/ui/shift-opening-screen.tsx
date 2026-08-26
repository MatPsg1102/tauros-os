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
  ConfirmDialog,
  ErrorState,
  Flex,
  LoadingState,
  Page,
  PageHeader,
  PinInput,
  Radio,
  RadioGroup,
  Section,
  Stack,
  Text,
  type NavigationLinkAdapter,
} from '@tauros/ui-primitives';

import type { ShiftClosingActions, ShiftClosingView } from '../controllers/use-shift-closing.js';
import type { ShiftOpeningActions, ShiftOpeningView } from '../controllers/use-shift-opening.js';
import { shortDateLabel } from './format.js';

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
  // tablet COMPARTILHADO: ninguém nasce selecionado — cada pessoa escolhe a
  // si mesma (pré-selecionar o primeiro do roster induzia erro de identidade)
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  // células remontam por TENTATIVA (contador): a antiga key usava a STRING do
  // erro e dois erros idênticos seguidos deixavam as células cheias com o
  // botão travado (P0 da auditoria). A seleção persiste no erro de PIN.
  const [attemptSeq, setAttemptSeq] = useState(0);
  return (
    <Section title="Identificação do operador" description="Confirme quem está assumindo o turno">
      <Card>
        <Stack gap={200}>
          {/* V2 glove-first: RadioGroup (alvos 64px), não dropdown do SO */}
          <RadioGroup
            label="Operador"
            value={employeeId}
            onValueChange={(value) => {
              setEmployeeId(value);
              setPin('');
            }}
          >
            {view.operators.map((candidate) => (
              <Radio
                key={candidate.employeeId}
                value={candidate.employeeId}
                label={candidate.name}
              />
            ))}
          </RadioGroup>
          <Stack gap={100}>
            <Text role="label">PIN de operação</Text>
            <PinInput
              key={`${employeeId}:${String(attemptSeq)}`}
              length={view.pinLength}
              label="PIN de operação"
              mask
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
            disabled={employeeId === '' || pin.length < view.pinLength}
            onClick={() => {
              const value = pin;
              setPin('');
              setAttemptSeq((sequence) => sequence + 1);
              void actions.identify(employeeId, value);
            }}
          >
            Confirmar identificação
          </Button>
        </Stack>
      </Card>
    </Section>
  );
}

/** Turno aberto: acesso ao quadro do dia + fechamento (7.2). */
function ActiveShiftActions({
  closing,
  closingActions,
  tasksLink,
}: {
  readonly closing: ShiftClosingView;
  readonly closingActions: ShiftClosingActions;
  readonly tasksLink: NavigationLinkAdapter;
}): ReactElement {
  return (
    <Stack gap={200}>
      {/* a ação do DIA é ir ao quadro; fechar é a ação TERMINAL — pesos
          distintos (antes ambas eram secondary) */}
      <Button
        fullWidth
        onClick={() => {
          tasksLink.navigate?.();
        }}
      >
        Ver tarefas de hoje
      </Button>

      {closing.canCloseShift ? (
        <Button
          fullWidth
          variant="secondary"
          disabled={closing.phase === 'submitting'}
          onClick={closingActions.requestClose}
        >
          Fechar turno
        </Button>
      ) : (
        <Alert status="warning" title="Sem permissão para fechar turno">
          Seu perfil não permite fechar o turno nesta loja. Procure o responsável pela unidade.
        </Alert>
      )}

      <ConfirmDialog
        open={closing.phase === 'confirming'}
        onOpenChange={(open) => {
          if (!open) closingActions.cancelClose();
        }}
        title="Fechar o turno agora?"
        description="Depois de fechado, este turno não recebe novos registros de tarefa neste aparelho."
        confirmLabel="Fechar turno"
        cancelLabel="Continuar no turno"
        onConfirm={() => closingActions.confirmClose()}
      >
        {/* fechar SABENDO o que fica para trás — exceções primeiro;
            avisar ≠ impedir (nenhuma regra de bloqueio aprovada) */}
        {closing.summary !== null && (
          <Stack gap={100}>
            <Stack gap={50}>
              {(
                [
                  ['Atrasadas', closing.summary.overdue],
                  ['Pendentes', closing.summary.pending],
                  ['Em conferência', closing.summary.awaitingReview],
                  ['Devolvidas', closing.summary.needsCorrection],
                  ['Concluídas', closing.summary.done],
                  ['Adiadas', closing.summary.skipped],
                ] as const
              ).map(([label, count]) => (
                <Flex key={label} gap={100} justify="between" align="baseline">
                  <Text role="caption" tone="secondary">
                    {label}
                  </Text>
                  <Text role="data">{count}</Text>
                </Flex>
              ))}
            </Stack>
            {closing.summary.pending +
              closing.summary.overdue +
              closing.summary.awaitingReview +
              closing.summary.needsCorrection >
              0 && (
              <Alert status="warning" title="Ainda há trabalho em aberto">
                Você pode fechar mesmo assim — as tarefas continuam no quadro do dia.
              </Alert>
            )}
          </Stack>
        )}
      </ConfirmDialog>
    </Stack>
  );
}

/** Estado do fechamento em linguagem operacional (local × servidor). */
function ClosedShiftSection({
  closing,
  closingActions,
}: {
  readonly closing: ShiftClosingView;
  readonly closingActions: ShiftClosingActions;
}): ReactElement {
  const status = closing.session?.closeSyncStatus;
  return (
    <Section
      title="Turno fechado"
      actions={
        status === 'synced' ? (
          <Badge status="success">Confirmado pelo servidor</Badge>
        ) : status === 'conflict' ? (
          <Badge status="critical">Precisa de revisão</Badge>
        ) : status === 'failed' ? (
          // estado TERMINAL da fila: prometer "aguardando conexão" mentiria
          <Badge status="error">Não foi possível enviar</Badge>
        ) : (
          <Badge status="info">Aguardando conexão</Badge>
        )
      }
    >
      <Card>
        <Stack gap={100}>
          <div role="status">
            <Text>Turno encerrado. Nada foi perdido.</Text>
          </div>
          {status === 'queued' && (
            <>
              <Text tone="secondary">
                Salvo neste aparelho. O fechamento será enviado assim que houver conexão.
              </Text>
              <Button variant="secondary" onClick={() => void closingActions.retrySync()}>
                Tentar sincronizar agora
              </Button>
            </>
          )}
          {status === 'failed' && (
            <>
              <Text tone="secondary">
                O registro está seguro neste aparelho, mas o envio falhou. Tente de novo; se
                persistir, avise o responsável.
              </Text>
              <Button variant="secondary" onClick={() => void closingActions.retrySync()}>
                Tentar sincronizar agora
              </Button>
            </>
          )}
          {status === 'synced' && <Text tone="secondary">Confirmado pelo servidor.</Text>}
        </Stack>
      </Card>
    </Section>
  );
}

export function ShiftOpeningScreen({
  view,
  actions,
  closing,
  closingActions,
  tasksLink,
  supervisorLink,
}: {
  readonly view: ShiftOpeningView;
  readonly actions: ShiftOpeningActions;
  readonly closing: ShiftClosingView;
  readonly closingActions: ShiftClosingActions;
  readonly tasksLink: NavigationLinkAdapter;
  readonly supervisorLink: NavigationLinkAdapter;
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

      {view.phase === 'submitting' && <LoadingState label="Processando o turno" />}

      {view.phase === 'stale-session' && (
        <Section title="Turno de outro dia ainda aberto">
          <Card>
            <Stack gap={200}>
              <Alert status="warning" title="O dia operacional virou">
                {`Seu turno de ${view.staleSessionDate !== null ? shortDateLabel(view.staleSessionDate) : 'outro dia'} continua aberto. Feche-o para começar o dia de hoje — o fechamento fica registrado com a sua identificação.`}
              </Alert>
              {view.actionError !== null && (
                <Alert status="error" live="polite" title="Fechamento não realizado">
                  {view.actionError}
                </Alert>
              )}
              <Button fullWidth onClick={() => void actions.closeStaleShift()}>
                Fechar turno de{' '}
                {view.staleSessionDate !== null
                  ? shortDateLabel(view.staleSessionDate)
                  : 'outro dia'}
              </Button>
            </Stack>
          </Card>
        </Section>
      )}

      {view.phase === 'opened' &&
        view.session !== null &&
        closing.phase !== 'closed' &&
        closing.phase !== 'conflict' && (
          <Section title="Turno aberto" actions={syncBadge(view)}>
            <Card>
              <Stack gap={100}>
                <div role="status">
                  <Text>
                    Turno aberto para {view.operator?.name} em{' '}
                    {shortDateLabel(view.session.operationalDate)}.
                  </Text>
                </div>
                <Text role="data" tone="secondary">
                  Data operacional: {shortDateLabel(view.session.operationalDate)} · Loja:{' '}
                  {view.store.name}
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
                <ActiveShiftActions
                  closing={closing}
                  closingActions={closingActions}
                  tasksLink={tasksLink}
                />
              </Stack>
            </Card>
          </Section>
        )}

      {view.phase === 'opened' && closing.phase === 'submitting' && (
        <LoadingState label="Fechando o turno" />
      )}

      {view.phase === 'opened' && (closing.phase === 'closed' || closing.phase === 'conflict') && (
        <ClosedShiftSection closing={closing} closingActions={closingActions} />
      )}

      {closing.phase === 'conflict' && (
        <Alert status="error" title="Turno já fechado em outro aparelho">
          Este turno foi fechado em outro dispositivo. O registro deste aparelho foi preservado para
          revisão do responsável — nada foi perdido nem duplicado.
        </Alert>
      )}

      {closing.phase === 'config-error' && (
        <ErrorState
          title="Configuração indisponível"
          description="Não foi possível carregar as configurações da loja para fechar o turno."
          retryAction={
            <Button onClick={() => void closingActions.confirmClose()}>Tentar novamente</Button>
          }
        />
      )}

      {closing.actionError !== null && (
        <Alert status="warning" live="polite" title="Não foi possível fechar o turno">
          {closing.actionError}
        </Alert>
      )}

      {/* Entrada da Área do Encarregado — só com a DECISÃO pronta do view
          model (capability efetiva), nunca por nome/cargo. Depois do conteúdo
          da fase: a navegação de gestão não fura a fila do job da tela. */}
      {view.canManageTeam && view.operator !== null && (
        <Section title="Gestão da equipe">
          <Card>
            <Stack gap={100}>
              <Text tone="secondary">
                Acompanhe as tarefas da equipe, crie e atribua novas tarefas e coordene o dia.
              </Text>
              <Button
                fullWidth
                variant="secondary"
                onClick={() => {
                  supervisorLink.navigate?.();
                }}
              >
                Ir para a Área do Encarregado
              </Button>
            </Stack>
          </Card>
        </Section>
      )}

      {view.phase === 'denied' && (
        <Stack gap={200}>
          <Alert status="warning" title="Sem permissão para abrir turno">
            Seu perfil não permite abrir o turno nesta loja. Procure o responsável pela unidade para
            ajustar o acesso.
          </Alert>
          {/* tablet compartilhado: o beco sem saída de UMA pessoa não pode
              travar o aparelho para as demais */}
          <Button variant="secondary" onClick={() => actions.reset()}>
            Identificar outro operador
          </Button>
        </Stack>
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
