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
  ConfirmDialog,
  DatePicker,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Flex,
  Heading,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  PinInput,
  Radio,
  RadioGroup,
  Section,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TimePicker,
} from '@tauros/ui-primitives';

import type { NavigationLinkAdapter } from '@tauros/ui-primitives';
import { ALL_WEEKDAYS, type TaskRecurrence, type Weekday } from '@tauros/contracts';

import type {
  SupervisorDashboardActions,
  SupervisorDashboardView,
  SupervisorTaskView,
} from '../controllers/use-supervisor-dashboard.js';
import type {
  TeamManagementActions,
  TeamManagementView,
} from '../controllers/use-team-management.js';
import { TeamManagementSection } from './team-management-section.js';

const WEEKDAY_LABEL: Readonly<Record<Weekday, string>> = {
  MON: 'Seg',
  TUE: 'Ter',
  WED: 'Qua',
  THU: 'Qui',
  FRI: 'Sex',
  SAT: 'Sáb',
  SUN: 'Dom',
};

function stateBadge(task: SupervisorTaskView): ReactElement {
  if (task.state === 'done') return <Badge status="success">Concluída</Badge>;
  if (task.state === 'skipped') return <Badge status="neutral">Adiada</Badge>;
  if (task.state === 'overdue') return <Badge status="warn">Atrasada</Badge>;
  if (task.state === 'in-progress') return <Badge status="info">Em execução</Badge>;
  if (task.state === 'awaiting-review') return <Badge status="info">Aguardando conferência</Badge>;
  if (task.state === 'needs-correction') return <Badge status="warn">Correção necessária</Badge>;
  return <Badge status="info">Pendente</Badge>;
}

function syncLine(task: SupervisorTaskView): string | null {
  if (task.syncStatus === 'queued') return 'Aguardando sincronização';
  if (task.syncStatus === 'synced' && task.createdLocally) return 'Confirmado pelo servidor';
  if (task.syncStatus === 'conflict') return 'Precisa de revisão do responsável';
  if (task.syncStatus === 'failed') return 'Não foi possível enviar — avise o encarregado';
  return null;
}

function IdentifyStep({
  view,
  actions,
}: {
  readonly view: SupervisorDashboardView;
  readonly actions: SupervisorDashboardActions;
}): ReactElement {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const pinLength = view.pinLength;
  return (
    <Section
      title="Identificação do encarregado"
      description="Selecione quem está assumindo a gestão do dia e confirme o PIN"
    >
      <Card>
        <Stack gap={200}>
          {/* employeeId IDENTIFICA; o painel de gestão só abre se a AUTORIZAÇÃO
              trouxer a capacidade — ninguém é encarregado por nome (ADR-021). */}
          <Field label="Quem está assumindo a gestão?">
            <Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="" disabled>
                Selecione o colaborador
              </option>
              {view.operators.map((candidate) => (
                <option key={candidate.employeeId} value={candidate.employeeId}>
                  {candidate.name}
                </option>
              ))}
            </Select>
          </Field>
          <Stack gap={100}>
            <Text role="label">Digite seu PIN</Text>
            <PinInput
              key={`${employeeId}:${view.identifyError ?? 'pin'}`}
              length={pinLength}
              label="PIN do encarregado"
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
            disabled={employeeId === '' || pin.length < pinLength}
            onClick={() => {
              const selected = employeeId;
              const value = pin;
              setEmployeeId('');
              setPin('');
              void actions.identify(selected, value);
            }}
          >
            Entrar
          </Button>
        </Stack>
      </Card>
    </Section>
  );
}

type ResponsibleMode = 'now' | 'later';
type RepeatMode = 'weekdays' | 'when_scheduled';

function CreateTaskDrawer({
  view,
  actions,
}: {
  readonly view: SupervisorDashboardView;
  readonly actions: SupervisorDashboardActions;
}): ReactElement {
  const [title, setTitle] = useState('');
  const [responsibleMode, setResponsibleMode] = useState<ResponsibleMode>('now');
  const [positionId, setPositionId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(view.operationalDate ?? '');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresReview, setRequiresReview] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('weekdays');
  const [weekdays, setWeekdays] = useState<readonly Weekday[]>(ALL_WEEKDAYS);
  const open = view.creation.status !== 'idle';
  const submitting = view.creation.status === 'submitting';

  // "Definir no dia" não conhece posição alvo — "Quando estiver escalado" fica
  // indisponível (não há como perguntar "está escalado?" sem posição).
  const scheduledAvailable = responsibleMode === 'now';
  const effectiveRepeatMode: RepeatMode = scheduledAvailable ? repeatMode : 'weekdays';

  function toggleWeekday(day: Weekday): void {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );
  }

  function reset(): void {
    setTitle('');
    setResponsibleMode('now');
    setPositionId('');
    setEffectiveFrom(view.operationalDate ?? '');
    setStartTime('08:00');
    setEndTime('10:00');
    setRequiresPhoto(false);
    setRequiresReview(false);
    setRepeat(false);
    setRepeatMode('weekdays');
    setWeekdays(ALL_WEEKDAYS);
  }

  function submit(): void {
    const recurrence: TaskRecurrence = !repeat
      ? { kind: 'ONCE' }
      : effectiveRepeatMode === 'when_scheduled'
        ? { kind: 'WHEN_SCHEDULED' }
        : { kind: 'WEEKDAYS', weekdays };
    void actions
      .createTask({
        title,
        positionId: responsibleMode === 'now' ? positionId : '',
        effectiveFrom,
        startTime,
        endTime,
        requiresPhoto,
        requiresReview,
        recurrence,
      })
      .then(reset);
  }

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

        <RadioGroup
          label="Responsável"
          value={responsibleMode}
          onValueChange={(value) => setResponsibleMode(value as ResponsibleMode)}
          orientation="horizontal"
        >
          <Radio value="now" label="Definir agora" disabled={submitting} />
          <Radio value="later" label="Definir no dia" disabled={submitting} />
        </RadioGroup>

        {responsibleMode === 'now' && (
          <Field label="Posição responsável">
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
        )}

        <Field label="Data inicial">
          <DatePicker
            value={effectiveFrom}
            onValueChange={setEffectiveFrom}
            disabled={submitting}
          />
        </Field>
        <Field label="Início">
          <TimePicker value={startTime} onValueChange={setStartTime} disabled={submitting} />
        </Field>
        <Field label="Fim máximo">
          <TimePicker value={endTime} onValueChange={setEndTime} disabled={submitting} />
        </Field>

        <Checkbox
          label="Exigir foto para concluir"
          checked={requiresPhoto}
          onChange={(event) => setRequiresPhoto(event.target.checked)}
          disabled={submitting}
        />

        <Checkbox
          label="Exigir conferência do encarregado"
          checked={requiresReview}
          onChange={(event) => setRequiresReview(event.target.checked)}
          disabled={submitting}
        />

        <Switch
          label="Repetir"
          checked={repeat}
          onChange={(event) => setRepeat(event.target.checked)}
          disabled={submitting}
        />

        {repeat && (
          <>
            <RadioGroup
              label="Repetir"
              value={effectiveRepeatMode}
              onValueChange={(value) => setRepeatMode(value as RepeatMode)}
            >
              <Radio value="weekdays" label="Dias da semana" disabled={submitting} />
              <Radio
                value="when_scheduled"
                label="Quando estiver escalado"
                disabled={submitting || !scheduledAvailable}
              />
            </RadioGroup>

            {effectiveRepeatMode === 'weekdays' && (
              <Stack gap={100} aria-label="Dias da semana">
                <Text role="label">Dias da semana</Text>
                <Flex gap={100} wrap>
                  {ALL_WEEKDAYS.map((day) => (
                    <Checkbox
                      key={day}
                      label={WEEKDAY_LABEL[day]}
                      checked={weekdays.includes(day)}
                      onChange={() => toggleWeekday(day)}
                      disabled={submitting}
                    />
                  ))}
                </Flex>
                <Button
                  variant="secondary"
                  onClick={() => setWeekdays(ALL_WEEKDAYS)}
                  disabled={submitting}
                >
                  Selecionar todos
                </Button>
              </Stack>
            )}

            {effectiveRepeatMode === 'when_scheduled' && (
              <Text tone="secondary">
                A tarefa será criada nos dias em que o responsável estiver na escala.
              </Text>
            )}
          </>
        )}

        {view.creation.status === 'error' && (
          <Alert status="error" live="polite" title="Tarefa não criada">
            {view.creation.message}
          </Alert>
        )}
        <Button fullWidth disabled={submitting} onClick={submit}>
          {submitting ? 'Criando tarefa…' : 'Criar tarefa'}
        </Button>
      </Stack>
    </Drawer>
  );
}

/**
 * Turno do próprio encarregado (encarregado também é operador). Progressive
 * disclosure: nunca mostra Abrir e Fechar ao mesmo tempo — a ação exibida
 * deriva do estado da sessão e das DECISÕES prontas do view model.
 */
function ShiftSection({
  view,
  actions,
}: {
  readonly view: SupervisorDashboardView;
  readonly actions: SupervisorDashboardActions;
}): ReactElement {
  const session = view.session;
  const isOpen = session?.status === 'ACTIVE';
  const isClosed = session !== null && session.status !== 'ACTIVE';
  return (
    <Section title="Turno">
      <Card>
        <Stack gap={200}>
          {session === null && (
            <>
              <div role="status">
                <Text>Nenhum turno aberto agora.</Text>
              </div>
              {view.permissions.canOpenShift ? (
                <Button
                  fullWidth
                  disabled={view.shiftSubmitting}
                  onClick={() => void actions.openShift()}
                >
                  {view.shiftSubmitting ? 'Abrindo turno…' : 'Abrir turno'}
                </Button>
              ) : (
                <Alert status="warning" title="Sem permissão para abrir turno">
                  Seu perfil não permite abrir o turno nesta loja. Procure o responsável pela
                  unidade.
                </Alert>
              )}
            </>
          )}

          {isOpen && (
            <>
              <div role="status">
                <Text>Turno aberto em {session.operationalDate}.</Text>
              </div>
              {session.syncStatus === 'synced' ? (
                <Badge status="success">Confirmado pelo servidor</Badge>
              ) : (
                <Badge status="info">Aguardando sincronização</Badge>
              )}
              {view.permissions.canCloseShift ? (
                <Button
                  fullWidth
                  variant="secondary"
                  disabled={view.closing.phase === 'submitting'}
                  onClick={actions.requestCloseShift}
                >
                  Fechar turno
                </Button>
              ) : (
                <Alert status="warning" title="Sem permissão para fechar turno">
                  Seu perfil não permite fechar o turno nesta loja. Procure o responsável pela
                  unidade.
                </Alert>
              )}
            </>
          )}

          {isClosed && (
            <>
              <div role="status">
                <Text>Turno fechado. Nada foi perdido.</Text>
              </div>
              {session.closeSyncStatus === 'synced' ? (
                <Text tone="secondary">Confirmado pelo servidor.</Text>
              ) : (
                <>
                  <Text tone="secondary">
                    Fechado neste aparelho. O fechamento será enviado assim que houver conexão.
                  </Text>
                  <Button variant="secondary" onClick={() => void actions.retrySync()}>
                    Tentar sincronizar agora
                  </Button>
                </>
              )}
            </>
          )}

          {view.shiftError !== null && (
            <Alert status="error" live="polite" title="Turno não alterado">
              {view.shiftError}
            </Alert>
          )}
        </Stack>
      </Card>

      <ConfirmDialog
        open={view.closing.phase === 'confirming'}
        onOpenChange={(open) => {
          if (!open) actions.cancelCloseShift();
        }}
        title="Fechar o turno agora?"
        description="Depois de fechado, este turno não recebe novos registros de tarefa neste aparelho."
        confirmLabel="Fechar turno"
        cancelLabel="Continuar no turno"
        onConfirm={() => actions.confirmCloseShift()}
      />
    </Section>
  );
}

/**
 * Atribuição situacional inline para ocorrências sem responsável. Candidatos
 * = posições com ocupante ESCALADO hoje (presença planejada oficial) — nunca
 * o cadastro inteiro da loja.
 */
function AssignControl({
  task,
  positions,
  onAssign,
}: {
  readonly task: SupervisorTaskView;
  readonly positions: SupervisorDashboardView['assignablePositions'];
  readonly onAssign: SupervisorDashboardActions['assignTask'];
}): ReactElement {
  const [positionId, setPositionId] = useState('');
  if (positions.length === 0) {
    return (
      <Text tone="secondary">
        Ninguém está escalado hoje para receber esta tarefa. Confira a aba Escala.
      </Text>
    );
  }
  const reassigning = !task.isUnassigned;
  return (
    <Stack gap={100}>
      <Field label={reassigning ? 'Passar para' : 'Atribuir a'}>
        <Select value={positionId} onChange={(event) => setPositionId(event.target.value)}>
          <option value="">Escolha quem está escalado hoje</option>
          {positions.map((position) => (
            <option key={position.id} value={position.id}>
              {position.name}
              {position.scheduledNames.length > 0 ? ` — ${position.scheduledNames.join(', ')}` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        variant="secondary"
        disabled={positionId === ''}
        onClick={() => void onAssign(task.id, positionId)}
      >
        {reassigning ? 'Reatribuir' : 'Atribuir'}
      </Button>
    </Stack>
  );
}

function TaskItem({
  task,
  positions,
  onAssign,
}: {
  readonly task: SupervisorTaskView;
  readonly positions: SupervisorDashboardView['assignablePositions'];
  readonly onAssign: SupervisorDashboardActions['assignTask'];
}): ReactElement {
  const sync = syncLine(task);
  const window =
    task.startTime !== null ? `${task.startTime}–${task.dueTime}` : `até ${task.dueTime}`;
  return (
    <Card>
      <Stack gap={100}>
        <Heading level={3}>{task.title}</Heading>
        <Flex gap={100} wrap>
          {stateBadge(task)}
          {task.isUnassigned && <Badge status="warn">Sem responsável</Badge>}
        </Flex>
        <Text role="data" tone="secondary">
          {task.assigneeNames.length > 0
            ? `${task.positionName} — ${task.assigneeNames.join(', ')}`
            : task.positionName}
          {' · '}
          {window}
        </Text>
        {task.requiresPhoto && <Text tone="secondary">Exige registro de foto.</Text>}
        {sync !== null && (
          <Text role="data" tone="secondary">
            {sync}
          </Text>
        )}
        {/* distribuição/REdistribuição: só enquanto ninguém pôs a mão —
            execução viva e trabalho entregue não se redistribuem (domínio
            rejeita TASK_IN_EXECUTION; a UI nem oferece) */}
        {(task.state === 'pending' ||
          task.state === 'overdue' ||
          task.state === 'needs-correction') && (
          <AssignControl task={task} positions={positions} onAssign={onAssign} />
        )}
      </Stack>
    </Card>
  );
}

export function SupervisorDashboardScreen({
  view,
  actions,
  teamView,
  teamActions,
  turnoLink,
  operationsLink,
}: {
  readonly view: SupervisorDashboardView;
  readonly actions: SupervisorDashboardActions;
  readonly teamView: TeamManagementView;
  readonly teamActions: TeamManagementActions;
  readonly turnoLink: NavigationLinkAdapter;
  readonly operationsLink: NavigationLinkAdapter;
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
          <>
            <Button
              variant="secondary"
              onClick={() => {
                operationsLink.navigate?.();
              }}
            >
              Operação de Hoje
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                turnoLink.navigate?.();
              }}
            >
              Voltar ao turno
            </Button>
            {view.phase === 'ready' && view.permissions.canCreateTask && (
              <Button onClick={actions.openCreate}>+ Nova tarefa</Button>
            )}
          </>
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
        <Stack gap={200}>
          <Alert status="warning" title="Identificação expirada">
            Sua identificação expirou. Identifique-se novamente para continuar.
          </Alert>
          <Button onClick={actions.reidentify}>Identificar novamente</Button>
        </Stack>
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
                Pendentes: {view.counts.pending} · Atrasadas: {view.counts.overdue} · Sem
                responsável: {view.counts.unassigned} · Concluídas: {view.counts.done} · Adiadas:{' '}
                {view.counts.skipped}
              </Text>
            </Card>
          </Section>

          <Section title="Tarefas da equipe">
            {view.assignError !== null && (
              <Alert status="error" live="polite" title="Atribuição não realizada">
                {view.assignError}
              </Alert>
            )}
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
                      { value: 'unassigned', label: 'Sem responsável' },
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
                      <TaskItem
                        key={task.id}
                        task={task}
                        positions={view.assignablePositions}
                        onAssign={actions.assignTask}
                      />
                    ))}
                  </Stack>
                )}
              </PanelBody>
            </Panel>
          </Section>

          {teamView.enabled && <TeamManagementSection view={teamView} actions={teamActions} />}

          <ShiftSection view={view} actions={actions} />

          <CreateTaskDrawer view={view} actions={actions} />
        </>
      )}
    </Page>
  );
}
