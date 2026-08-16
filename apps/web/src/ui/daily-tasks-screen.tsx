// Quadro de Tarefas do Dia (7.2) — apresentacional: consome APENAS o view
// model e a API pública do Design System. Linguagem operacional (nunca
// "fila", "payload", "conflito de idempotência"); estados explícitos e
// permanentes na página. Glove-first: ações são botões de alvo cheio.

'use client';

import { useState, type ReactElement } from 'react';

import {
  Alert,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Heading,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Section,
  Stack,
  Text,
  type NavigationLinkAdapter,
} from '@tauros/ui-primitives';

import type {
  DailyTaskItemView,
  DailyTasksActions,
  DailyTasksView,
} from '../controllers/use-daily-tasks.js';

function stateBadge(task: DailyTaskItemView): ReactElement {
  if (task.state === 'done') return <Badge status="success">Concluída</Badge>;
  if (task.state === 'skipped') return <Badge status="neutral">Adiada</Badge>;
  if (task.state === 'overdue') return <Badge status="warn">Atrasada</Badge>;
  if (task.state === 'in-progress') return <Badge status="info">Em execução</Badge>;
  if (task.state === 'awaiting-review') return <Badge status="info">Aguardando conferência</Badge>;
  if (task.state === 'needs-correction') return <Badge status="warn">Correção necessária</Badge>;
  return <Badge status="info">A fazer</Badge>;
}

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
}: {
  readonly task: DailyTaskItemView;
  readonly actions: DailyTasksActions;
  readonly busy: boolean;
}): ReactElement {
  const [measurement, setMeasurement] = useState('');
  const [evidence, setEvidence] = useState(false);
  // resolvida OU em conferência: o operador não age aqui (o encarregado
  // confere na Operação de Hoje — o domínio também rejeita, isto é só UX)
  const resolved =
    task.state === 'done' || task.state === 'skipped' || task.state === 'awaiting-review';
  const sync = syncLabel(task);

  return (
    <Card>
      <Stack gap={200}>
        <Stack gap={100}>
          <Heading level={3}>{task.title}</Heading>
          <div>{stateBadge(task)}</div>
          {task.expectedRange !== null && (
            <Text role="data" tone="secondary">
              Faixa esperada: {task.expectedRange.min ?? '—'} a {task.expectedRange.max ?? '—'}
            </Text>
          )}
          {task.requiresPhoto && !resolved && (
            <Text tone="secondary">Esta tarefa exige registro de foto.</Text>
          )}
          {sync !== null && (
            <Text role="data" tone="secondary">
              {sync}
            </Text>
          )}
        </Stack>

        {!resolved && (
          <Stack gap={200}>
            {task.expectedRange !== null && (
              <Field label="Medição registrada">
                <Input
                  inputMode="decimal"
                  value={measurement}
                  onChange={(event) => setMeasurement(event.target.value)}
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
              onClick={() => {
                const parsed = measurement.trim() === '' ? null : Number(measurement);
                void actions.complete(task.id, {
                  numericValue: Number.isNaN(parsed) ? null : parsed,
                  hasEvidence: evidence,
                });
              }}
            >
              Concluir tarefa
            </Button>
            <Button
              fullWidth
              variant="secondary"
              disabled={busy}
              onClick={() => void actions.skip(task.id)}
            >
              Adiar tarefa
            </Button>
          </Stack>
        )}
      </Stack>
    </Card>
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
        {...(view.operationalDate !== null ? { eyebrow: view.operationalDate } : {})}
        description={
          view.operatorName === null ? 'Quadro do dia' : `Operador: ${view.operatorName}`
        }
        status={
          view.readyToSync ? (
            <Badge status="success">Conectado</Badge>
          ) : (
            <Badge status="warn">Sem conexão — operação local segura</Badge>
          )
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              shiftLink.navigate?.();
            }}
          >
            Voltar ao turno
          </Button>
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

      {view.phase === 'loading' && <LoadingState label="Carregando as tarefas de hoje" />}

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

      {view.phase === 'expired' && (
        <Alert status="warning" title="Identificação expirada">
          Sua identificação expirou. Volte ao turno e identifique-se novamente para continuar.
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
            <Card>
              <Text role="data">
                A fazer: {view.counts.pending} · Atrasadas: {view.counts.overdue} · Concluídas:{' '}
                {view.counts.done} · Adiadas: {view.counts.skipped}
              </Text>
            </Card>
          </Section>

          <Section title="Tarefas">
            <Stack gap={300}>
              {view.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  actions={actions}
                  busy={view.busyTaskId !== null}
                />
              ))}
            </Stack>
          </Section>
        </>
      )}

      {view.actionError !== null && view.phase === 'ready' && (
        <Alert status="warning" live="polite" title="Registro não concluído">
          {view.actionError}
        </Alert>
      )}
    </Page>
  );
}
