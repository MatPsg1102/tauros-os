// Quadro de Tarefas do Dia (7.2) — apresentacional: consome APENAS o view
// model e a API pública do Design System. Linguagem operacional (nunca
// "fila", "payload", "conflito de idempotência"); estados explícitos e
// permanentes na página. Glove-first: ações são botões de alvo cheio.

'use client';

import { useState, type ReactElement } from 'react';

import {
  Alert,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Flex,
  LoadingState,
  NumberInput,
  Page,
  PageHeader,
  Section,
  Stack,
  Text,
  TextArea,
  type NavigationLinkAdapter,
} from '@tauros/ui-primitives';

import type {
  DailyTaskItemView,
  DailyTasksActions,
  DailyTasksView,
} from '../controllers/use-daily-tasks.js';
import { operationalDateLabel } from './format.js';
import { OperationalTaskCard } from './operational-task-card.js';

function syncLabel(task: DailyTaskItemView): string | null {
  if (task.syncStatus === 'queued') return 'Salvo neste aparelho';
  if (task.syncStatus === 'synced') return 'Confirmado pelo servidor';
  if (task.syncStatus === 'conflict') return 'Tarefa já concluída em outro aparelho';
  if (task.syncStatus === 'failed') return 'Não foi possível enviar — avise o encarregado';
  return null;
}

function TaskCard({
  task,
  actions,
  busy,
  processing,
}: {
  readonly task: DailyTaskItemView;
  readonly actions: DailyTasksActions;
  readonly busy: boolean;
  /** ESTA tarefa está processando (feedback no card certo, não em todos). */
  readonly processing: boolean;
}): ReactElement {
  const [measurement, setMeasurement] = useState<number | null>(null);
  const [evidence, setEvidence] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  // resolvida OU em conferência: o operador não age aqui (o encarregado
  // confere na Operação de Hoje — o domínio também rejeita, isto é só UX)
  const resolved =
    task.state === 'done' || task.state === 'skipped' || task.state === 'awaiting-review';
  const range = task.expectedRange;

  return (
    <OperationalTaskCard
      title={task.title}
      state={task.state}
      pendingLabel="A fazer"
      timeCaption="até"
      timePrimary={task.dueTime ?? '—'}
      meta={
        range !== null
          ? `Faixa esperada: ${range.min ?? '—'} a ${range.max ?? '—'}`
          : 'Tarefa do dia'
      }
      requirementLabel={
        task.requiresPhoto && !resolved ? '📷 Esta tarefa exige registro de foto' : null
      }
      syncLabel={syncLabel(task)}
    >
      {!resolved && (
        <Stack gap={200}>
          {range !== null && (
            <Field label="Medição registrada">
              {/* NumberInput do DS: vírgula pt-BR nativa — fim do parse manual */}
              <NumberInput
                value={measurement}
                onValueChange={(change) => setMeasurement(change.value)}
                allowNegative
                disabled={busy}
              />
            </Field>
          )}
          {task.requiresPhoto && (
            <Button
              fullWidth
              variant={evidence ? 'primary' : 'secondary'}
              onClick={() => setEvidence(true)}
            >
              {evidence ? 'Foto registrada' : 'Registrar foto'}
            </Button>
          )}
          <Button
            fullWidth
            disabled={busy}
            loading={processing}
            onClick={() =>
              void actions.complete(task.id, {
                numericValue: measurement,
                hasEvidence: evidence,
              })
            }
          >
            Concluir tarefa
          </Button>
          {task.state === 'needs-correction' ? null : !skipOpen ? (
            // devolvida NÃO oferece adiamento (o domínio rejeitaria):
            // corrija e reenvie — a devolução do encarregado não se anula
            <Button fullWidth variant="secondary" disabled={busy} onClick={() => setSkipOpen(true)}>
              Adiar tarefa
            </Button>
          ) : (
            <Stack gap={100}>
              <Field label="Motivo do adiamento (obrigatório)">
                <TextArea
                  value={skipReason}
                  onChange={(event) => setSkipReason(event.target.value)}
                  disabled={busy}
                  rows={2}
                />
              </Field>
              <Flex gap={100} wrap>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setSkipOpen(false);
                    setSkipReason('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={busy || skipReason.trim() === ''}
                  loading={processing && skipOpen}
                  onClick={() => void actions.skip(task.id, skipReason.trim())}
                >
                  Confirmar adiamento
                </Button>
              </Flex>
            </Stack>
          )}
        </Stack>
      )}
    </OperationalTaskCard>
  );
}

export function DailyTasksScreen({
  view,
  actions,
  shiftLink,
}: {
  readonly view: DailyTasksView;
  readonly actions: DailyTasksActions;
  readonly shiftLink: NavigationLinkAdapter;
}): ReactElement {
  return (
    <Page id="conteudo">
      <PageHeader
        title="Tarefas de hoje"
        {...(view.operationalDate !== null
          ? { eyebrow: operationalDateLabel(view.operationalDate) }
          : {})}
        description={
          view.operatorName === null ? 'Quadro do dia' : `Operador: ${view.operatorName}`
        }
      />

      {!view.readyToSync && view.phase === 'ready' && (
        <Banner status="warning">
          Sem conexão com o servidor. Você pode registrar as tarefas normalmente: tudo fica salvo
          neste aparelho e será enviado quando a conexão voltar.
        </Banner>
      )}

      {view.pendingSyncCount > 0 && (
        <div role="status">
          <Text tone="secondary">
            {view.pendingSyncCount === 1
              ? '1 registro salvo neste aparelho aguardando envio.'
              : `${view.pendingSyncCount} registros salvos neste aparelho aguardando envio.`}
          </Text>
        </div>
      )}

      {view.hasConflict && (
        <Alert status="error" title="Tarefa já concluída em outro aparelho">
          O registro deste aparelho foi preservado para revisão do responsável — nada foi perdido
          nem duplicado.
        </Alert>
      )}

      {view.phase === 'loading' && (
        <LoadingState label="Carregando as tarefas de hoje" variant="skeleton" lines={4} />
      )}

      {view.phase === 'no-session' && (
        <EmptyState
          title="Nenhum turno aberto"
          description="Abra o turno para ver e registrar as tarefas do dia."
          action={
            <Button
              onClick={() => {
                shiftLink.navigate?.();
              }}
            >
              Ir para o turno
            </Button>
          }
        />
      )}

      {view.phase === 'stale-session' && (
        <EmptyState
          title="O turno aberto é de outro dia"
          description="O dia operacional virou. Feche o turno anterior na tela de turno antes de registrar tarefas de hoje."
          action={
            <Button
              onClick={() => {
                shiftLink.navigate?.();
              }}
            >
              Ir para o turno
            </Button>
          }
        />
      )}

      {view.phase === 'expired' && (
        <Alert
          status="warning"
          title="Identificação expirada"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                shiftLink.navigate?.();
              }}
            >
              Ir para o turno
            </Button>
          }
        >
          Sua identificação expirou. Identifique-se novamente para continuar.
        </Alert>
      )}

      {view.phase === 'unavailable' && (
        <ErrorState
          title="Tarefas indisponíveis"
          description="Não foi possível carregar as definições de tarefa da loja."
          retryAction={<Button onClick={() => void actions.reload()}>Tentar novamente</Button>}
        />
      )}

      {view.phase === 'error' && (
        <ErrorState
          title="Não foi possível carregar as tarefas"
          description={view.actionError ?? 'Tente novamente em instantes.'}
          retryAction={<Button onClick={() => void actions.reload()}>Tentar novamente</Button>}
        />
      )}

      {view.phase === 'ready' && view.tasks.length === 0 && (
        <EmptyState
          title="Nenhuma tarefa para hoje"
          description="Não há tarefas programadas para esta data operacional."
        />
      )}

      {view.phase === 'ready' && view.tasks.length > 0 && (
        <>
          <Section
            title="Resumo do dia"
            actions={
              view.pendingSyncCount > 0 ? (
                <Button variant="secondary" onClick={() => void actions.retrySync()}>
                  Tentar sincronizar agora
                </Button>
              ) : undefined
            }
          >
            <Flex gap={300} wrap>
              {(
                [
                  ['Atrasadas', view.counts.overdue],
                  ['A fazer', view.counts.pending],
                  ['Concluídas', view.counts.done],
                  ['Adiadas', view.counts.skipped],
                ] as const
              ).map(([label, count]) => (
                <Stack key={label} gap={0}>
                  <Text role="caption" tone="secondary">
                    {label}
                  </Text>
                  <Text role="data">{count}</Text>
                </Stack>
              ))}
            </Flex>
          </Section>

          <Section title="Tarefas">
            {/* erro de ação VISÍVEL onde o operador age — nunca no rodapé
                depois de todos os cards */}
            {view.actionError !== null && (
              <Alert status="warning" live="polite" title="Registro não concluído">
                {view.actionError}
              </Alert>
            )}
            <Stack gap={200}>
              {/* exceção primeiro: atrasadas/devolvidas sobem; dentro de cada
                  grupo a ordem do carregador é preservada (apresentação pura) */}
              {[...view.tasks]
                .sort((a, b) => {
                  const rank = (task: DailyTaskItemView): number =>
                    task.state === 'overdue'
                      ? 0
                      : task.state === 'needs-correction'
                        ? 1
                        : task.state === 'done' || task.state === 'skipped'
                          ? 3
                          : 2;
                  return rank(a) - rank(b);
                })
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    actions={actions}
                    busy={view.busyTaskId !== null}
                    processing={view.busyTaskId === task.id}
                  />
                ))}
            </Stack>
          </Section>
        </>
      )}
    </Page>
  );
}
