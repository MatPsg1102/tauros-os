// Área do Encarregado — apresentacional: consome APENAS o view model e a API
// pública do Design System. Linguagem operacional, estados explícitos e
// permanentes na página, glove-first (alvos cheios, poucas ações).

'use client';

import { useState, type ReactElement } from 'react';

import {
  Alert,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Heading,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  PinInput,
  Section,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TimePicker,
} from '@tauros/ui-primitives';

import type {
  SupervisorDashboardActions,
  SupervisorDashboardView,
  SupervisorTaskView,
} from '../controllers/use-supervisor-dashboard.js';

function stateBadge(task: SupervisorTaskView): ReactElement {
  if (task.state === 'done') return <Badge status="success">Concluída</Badge>;
  if (task.state === 'skipped') return <Badge status="neutral">Adiada</Badge>;
  if (task.state === 'overdue') return <Badge status="warn">Atrasada</Badge>;
  return <Badge status="info">Pendente</Badge>;
}

function syncLine(task: SupervisorTaskView): string | null {
  if (task.syncStatus === 'queued') return 'Aguardando sincronização';
  if (task.syncStatus === 'synced' && task.createdLocally) return 'Confirmado pelo servidor';
  if (task.syncStatus === 'conflict') return 'Precisa de revisão do responsável';
  if (task.syncStatus === 'failed') return 'Aguardando nova tentativa';
  return null;
}

function IdentifyStep({
  view,
  actions,
}: {
  readonly view: SupervisorDashboardView;
  readonly actions: SupervisorDashboardActions;
}): ReactElement {
  const [pin, setPin] = useState('');
  return (
    <Section
      title="Identificação do encarregado"
      description="Confirme quem está assumindo a gestão do dia"
    >
      <Card>
        <Stack gap={200}>
          <Text>{view.supervisorName ?? 'Encarregado'}</Text>
          <Stack gap={100}>
            <Text role="label">Digite seu PIN</Text>
            <PinInput
              key={view.identifyError ?? 'pin'}
              length={4}
              label="PIN do encarregado"
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
              void actions.identify(pin);
              setPin('');
            }}
          >
            Entrar
          </Button>
        </Stack>
      </Card>
    </Section>
  );
}

function CreateTaskDrawer({
  view,
  actions,
}: {
  readonly view: SupervisorDashboardView;
  readonly actions: SupervisorDashboardActions;
}): ReactElement {
  const [title, setTitle] = useState('');
  const [positionId, setPositionId] = useState('');
  const [dueTime, setDueTime] = useState('17:00');
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const open = view.creation.status !== 'idle';
  const submitting = view.creation.status === 'submitting';

  return (
    <Drawer
      open={open}
      side="right"
      title="Nova tarefa"
      description="A tarefa entra no quadro do dia da equipe"
      closeLabel="Fechar"
      onOpenChange={(isOpen) => {
        if (!isOpen) actions.closeCreate();
      }}
    >
      <Stack gap={200}>
        <Field label="Título da tarefa">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={submitting}
          />
        </Field>
        <Field label="Responsável">
          <Select
            value={positionId}
            onChange={(event) => setPositionId(event.target.value)}
            disabled={submitting}
          >
            <option value="">Escolha o responsável</option>
            {view.positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
                {position.memberNames.length > 0 ? ` — ${position.memberNames.join(', ')}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Horário limite">
          <TimePicker value={dueTime} onValueChange={setDueTime} disabled={submitting} />
        </Field>
        <Checkbox
          label="Exigir foto para concluir"
          checked={requiresPhoto}
          onChange={(event) => setRequiresPhoto(event.target.checked)}
          disabled={submitting}
        />
        {view.creation.status === 'error' && (
          <Alert status="error" live="polite" title="Tarefa não criada">
            {view.creation.message}
          </Alert>
        )}
        <Button
          fullWidth
          disabled={submitting}
          onClick={() => {
            void actions.createTask({ title, positionId, dueTime, requiresPhoto }).then(() => {
              setTitle('');
              setPositionId('');
              setRequiresPhoto(false);
            });
          }}
        >
          {submitting ? 'Criando tarefa…' : 'Criar tarefa'}
        </Button>
      </Stack>
    </Drawer>
  );
}

function TaskItem({ task }: { readonly task: SupervisorTaskView }): ReactElement {
  const sync = syncLine(task);
  return (
    <Card>
      <Stack gap={100}>
        <Heading level={3}>{task.title}</Heading>
        <div>{stateBadge(task)}</div>
        <Text role="data" tone="secondary">
          {task.assigneeNames.length > 0
            ? `${task.positionName} — ${task.assigneeNames.join(', ')}`
            : task.positionName}
          {' · até '}
          {task.dueTime}
        </Text>
        {task.requiresPhoto && <Text tone="secondary">Exige registro de foto.</Text>}
        {sync !== null && (
          <Text role="data" tone="secondary">
            {sync}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

export function SupervisorDashboardScreen({
  view,
  actions,
}: {
  readonly view: SupervisorDashboardView;
  readonly actions: SupervisorDashboardActions;
}): ReactElement {
  return (
    <Page id="conteudo">
      <PageHeader
        title={
          view.phase === 'ready' && view.supervisorName !== null
            ? `${view.greeting}, ${view.supervisorName}`
            : 'Área do Encarregado'
        }
        eyebrow="Gestão do dia"
        description={
          view.phase === 'ready'
            ? 'Equipe de hoje · Tarefas do dia · Pendências'
            : 'Acompanhe e organize as tarefas da equipe'
        }
        status={
          view.readyToSync ? (
            <Badge status="success">Conectado</Badge>
          ) : (
            <Badge status="warn">Sem conexão — operação local segura</Badge>
          )
        }
        actions={
          view.phase === 'ready' ? (
            <Button onClick={actions.openCreate}>+ Nova tarefa</Button>
          ) : undefined
        }
      />

      {!view.readyToSync && view.phase === 'ready' && (
        <Banner status="warning">
          Sem conexão com o servidor. Você pode criar e acompanhar tarefas normalmente: tudo fica
          salvo neste aparelho e será enviado quando a conexão voltar.
        </Banner>
      )}

      {view.pendingSyncCount > 0 && view.phase === 'ready' && (
        <div role="status">
          <Text tone="secondary">
            {view.pendingSyncCount === 1
              ? '1 tarefa criada neste aparelho aguardando envio.'
              : `${view.pendingSyncCount} tarefas criadas neste aparelho aguardando envio.`}
          </Text>
        </div>
      )}

      {view.phase === 'bootstrapping' && <LoadingState label="Preparando a área do encarregado" />}
      {view.phase === 'loading' && <LoadingState label="Carregando o quadro da equipe" />}

      {view.phase === 'identify' && <IdentifyStep view={view} actions={actions} />}

      {view.phase === 'denied' && (
        <Alert status="warning" title="Acesso restrito">
          Você não possui permissão para acessar esta área.
        </Alert>
      )}

      {view.phase === 'expired' && (
        <Alert status="warning" title="Identificação expirada">
          Sua identificação expirou. Identifique-se novamente para continuar.
        </Alert>
      )}

      {view.phase === 'unavailable' && (
        <ErrorState
          title="Quadro indisponível"
          description="Não foi possível carregar as definições de tarefa da loja."
          retryAction={<Button onClick={() => void actions.reload()}>Tentar novamente</Button>}
        />
      )}

      {view.phase === 'error' && (
        <ErrorState
          title="Não foi possível carregar o quadro"
          description="Tente novamente em instantes."
          retryAction={<Button onClick={() => void actions.reload()}>Tentar novamente</Button>}
        />
      )}

      {view.phase === 'ready' && (
        <>
          <Section
            title="Tarefas do dia"
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
                Pendentes: {view.counts.pending} · Atrasadas: {view.counts.overdue} · Concluídas:{' '}
                {view.counts.done} · Adiadas: {view.counts.skipped}
              </Text>
            </Card>
          </Section>

          <Section title="Tarefas da equipe">
            <Panel>
              <PanelHeader>
                <Stack gap={200}>
                  <SegmentedControl
                    aria-label="Filtrar tarefas por situação"
                    value={view.filter}
                    onValueChange={(value) =>
                      actions.setFilter(value as SupervisorDashboardView['filter'])
                    }
                    options={[
                      { value: 'all', label: 'Todas' },
                      { value: 'pending', label: 'Pendentes' },
                      { value: 'overdue', label: 'Atrasadas' },
                      { value: 'done', label: 'Concluídas' },
                    ]}
                  />
                  <Field label="Por funcionário">
                    <Select
                      value={view.positionFilter ?? ''}
                      onChange={(event) =>
                        actions.setPositionFilter(
                          event.target.value === '' ? null : event.target.value,
                        )
                      }
                    >
                      <option value="">Toda a equipe</option>
                      {view.positions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.memberNames.length > 0
                            ? position.memberNames.join(', ')
                            : position.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </Stack>
              </PanelHeader>
              <PanelBody>
                {view.tasks.length === 0 ? (
                  <EmptyState
                    title="Nenhuma tarefa aqui"
                    description="Não há tarefas nesta situação para hoje. Crie uma nova tarefa se necessário."
                  />
                ) : (
                  <Stack gap={200}>
                    {view.tasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </Stack>
                )}
              </PanelBody>
            </Panel>
          </Section>

          <CreateTaskDrawer view={view} actions={actions} />
        </>
      )}
    </Page>
  );
}
