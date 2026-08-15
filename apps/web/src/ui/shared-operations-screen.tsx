// OPERAÇÃO DE HOJE — quadro COMPARTILHADO da loja (tablet no chão de
// operação). Apresentacional: consome o view model e a API pública do DS.
// Glove-first: ações principais grandes e visíveis (nunca menu escondido);
// estados reconhecíveis por TEXTO operacional pt-BR, não só cor. As ações
// críticas abrem o PIN contextual — a tela em si não exige identidade.

'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

import {
  Alert,
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
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
  PinInput,
  Section,
  SegmentedControl,
  Stack,
  Text,
  TextArea,
} from '@tauros/ui-primitives';
import type { NavigationLinkAdapter } from '@tauros/ui-primitives';

import type {
  SharedOperationsActions,
  SharedOperationsView,
  SharedTaskView,
} from '../controllers/use-shared-operations.js';

function statusBadge(task: SharedTaskView): ReactElement {
  if (task.status === 'DONE') return <Badge status="success">Concluída</Badge>;
  if (task.status === 'SKIPPED') return <Badge status="neutral">Adiada</Badge>;
  if (task.status === 'IN_PROGRESS') return <Badge status="info">Em execução</Badge>;
  if (task.status === 'AWAITING_REVIEW') return <Badge status="info">Aguardando conferência</Badge>;
  if (task.status === 'NEEDS_CORRECTION') return <Badge status="warn">Correção necessária</Badge>;
  if (task.status === 'OVERDUE') return <Badge status="warn">Atrasada</Badge>;
  return <Badge status="neutral">Pendente</Badge>;
}

/** Ação PRINCIPAL do card conforme o estado — grande e óbvia. */
function primaryAction(
  task: SharedTaskView,
  actions: SharedOperationsActions,
): ReactElement | null {
  if (task.isUnassigned && (task.status === 'PENDING' || task.status === 'OVERDUE')) {
    return (
      <Button fullWidth onClick={() => actions.requestAction('claim', task.id)}>
        Assumir
      </Button>
    );
  }
  if (task.status === 'PENDING' || task.status === 'OVERDUE') {
    return (
      <Button fullWidth onClick={() => actions.requestAction('start', task.id)}>
        Iniciar
      </Button>
    );
  }
  if (task.status === 'IN_PROGRESS') {
    return (
      <Button fullWidth onClick={() => actions.requestAction('submit', task.id)}>
        Finalizar
      </Button>
    );
  }
  if (task.status === 'NEEDS_CORRECTION') {
    return (
      <Button fullWidth onClick={() => actions.requestAction('start', task.id)}>
        Corrigir
      </Button>
    );
  }
  if (task.status === 'AWAITING_REVIEW') {
    return (
      <Button fullWidth onClick={() => actions.requestAction('review', task.id)}>
        Conferir
      </Button>
    );
  }
  return null;
}

function TaskCard({
  task,
  actions,
}: {
  readonly task: SharedTaskView;
  readonly actions: SharedOperationsActions;
}): ReactElement {
  const window =
    task.startTime !== null ? `${task.startTime} → ${task.dueTime}` : `Até ${task.dueTime}`;
  return (
    <Card>
      <Stack gap={100}>
        <Heading level={3}>{task.title}</Heading>
        <Flex gap={100} wrap>
          {statusBadge(task)}
          {task.isUnassigned && <Badge status="warn">Sem responsável</Badge>}
          {task.isLate && task.status !== 'OVERDUE' && <Badge status="warn">Atrasada</Badge>}
          {task.evidenceCount > 0 && (
            <Badge status="neutral">{`📷 ${task.evidenceCount} evidência${task.evidenceCount > 1 ? 's' : ''}`}</Badge>
          )}
        </Flex>
        <Text role="data" tone="secondary">
          {task.positionName ?? 'Sem responsável'}
          {task.startedByName !== null
            ? ` — ${task.startedByName}`
            : task.assigneeNames.length > 0
              ? ` — ${task.assigneeNames.join(', ')}`
              : ''}
          {' · '}
          {window}
          {task.startedAtTime !== null ? ` · Iniciada ${task.startedAtTime}` : ''}
        </Text>
        {task.requiresPhoto && task.status !== 'DONE' && (
          <Text tone="secondary">Exige registro de foto.</Text>
        )}
        {task.correctionReason !== null && (
          <Alert status="warning" title="Motivo da devolução">
            {task.correctionReason}
          </Alert>
        )}
        {task.syncLabel !== null && (
          <Text role="data" tone="secondary">
            {task.syncLabel}
          </Text>
        )}
        {primaryAction(task, actions)}
      </Stack>
    </Card>
  );
}

/** PIN contextual — identidade just-in-time para a ação crítica. */
function ActionPinDialog({
  view,
  actions,
}: {
  readonly view: SharedOperationsView;
  readonly actions: SharedOperationsActions;
}): ReactElement {
  const [pin, setPin] = useState('');
  const request = view.pinRequest;
  const open = request !== null;
  return (
    <Dialog
      open={open}
      title={request?.prompt ?? 'Identificação'}
      {...(request?.taskTitle != null ? { description: request.taskTitle } : {})}
      closeLabel="Cancelar"
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setPin('');
          actions.cancelPin();
        }
      }}
    >
      <Stack gap={200}>
        <PinInput
          key={`${request?.action ?? 'pin'}:${request?.error ?? ''}`}
          length={4}
          label="PIN"
          mask
          onValueChange={setPin}
        />
        {request?.error != null && (
          <Alert status="error" live="polite" title="Identificação não confirmada">
            {request.error}
          </Alert>
        )}
        <Button
          fullWidth
          disabled={pin.length < 4 || request?.busy === true}
          onClick={() => {
            const value = pin;
            setPin('');
            void actions.confirmPin(value);
          }}
        >
          {request?.busy === true ? 'Confirmando…' : 'Confirmar'}
        </Button>
      </Stack>
    </Dialog>
  );
}

/** Finalização: medição/foto/observação → concluir ou enviar p/ conferência. */
function SubmitDrawer({
  view,
  actions,
}: {
  readonly view: SharedOperationsView;
  readonly actions: SharedOperationsActions;
}): ReactElement {
  const [measure, setMeasure] = useState('');
  const [notes, setNotes] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const form = view.submitForm;
  const open = form !== null;

  // formulário limpo a cada ABERTURA; erro de validação NUNCA apaga o que o
  // operador digitou (mesmo contrato dos demais drawers do app)
  useEffect(() => {
    if (open) return;
    setMeasure('');
    setNotes('');
  }, [open]);
  return (
    <Drawer
      open={open}
      side="right"
      title={form?.title ?? 'Finalizar tarefa'}
      description={
        form?.requiresReview === true
          ? 'Ao enviar, a execução vai para a conferência do encarregado'
          : 'Ao concluir, a tarefa é registrada como feita'
      }
      closeLabel="Fechar"
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setMeasure('');
          setNotes('');
          actions.cancelSubmit();
        }
      }}
    >
      <Stack gap={200}>
        {form?.expectedRange != null && (
          <Field label="Medição registrada">
            <Input
              inputMode="decimal"
              value={measure}
              onChange={(event) => setMeasure(event.target.value)}
              disabled={form.busy}
            />
          </Field>
        )}

        <Stack gap={100}>
          <Text role="label">
            {form?.requiresPhoto === true ? 'Foto da tarefa (obrigatória)' : 'Foto da tarefa'}
          </Text>
          {form !== null && form.evidence.length > 0 && (
            <Flex gap={100} wrap>
              {form.evidence.map((item) =>
                item.url !== null ? (
                  <img
                    key={item.id}
                    src={item.url}
                    alt="Evidência registrada"
                    style={{ maxWidth: '96px', maxHeight: '96px', borderRadius: '4px' }}
                  />
                ) : (
                  <Badge key={item.id} status="neutral">
                    📷 aguardando sincronização
                  </Badge>
                ),
              )}
            </Flex>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Adicionar foto"
            disabled={form?.busy === true}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void actions.addEvidence(file);
              event.target.value = '';
            }}
          />
        </Stack>

        <Field label="Observação (opcional)">
          <TextArea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={form?.busy === true}
            rows={2}
          />
        </Field>

        {form?.error != null && (
          <Alert status="error" live="polite" title="Não foi possível finalizar">
            {form.error}
          </Alert>
        )}
        <Button
          fullWidth
          disabled={form?.busy === true}
          onClick={() => {
            const parsed = measure.trim() === '' ? null : Number(measure.replace(',', '.'));
            void actions.submitExecution({
              numericValue: parsed !== null && Number.isFinite(parsed) ? parsed : null,
              notes,
            });
          }}
        >
          {form?.busy === true
            ? 'Enviando…'
            : form?.requiresReview === true
              ? 'Enviar para conferência'
              : 'Concluir tarefa'}
        </Button>
      </Stack>
    </Drawer>
  );
}

/** Conferência do encarregado: detalhe + evidências → aprovar/devolver. */
function ReviewDrawer({
  view,
  actions,
}: {
  readonly view: SharedOperationsView;
  readonly actions: SharedOperationsActions;
}): ReactElement {
  const [reason, setReason] = useState('');
  const detail = view.reviewDetail;
  const open = detail !== null;
  const detailTaskId = detail?.taskId ?? null;

  // o motivo NUNCA vaza de uma conferência para outra: limpa ao fechar e ao
  // trocar de tarefa (fechamento programático não dispara onOpenChange)
  useEffect(() => {
    setReason('');
  }, [detailTaskId, open]);
  return (
    <Drawer
      open={open}
      side="right"
      title={detail?.title ?? 'Conferência'}
      description="Confira a execução antes de aprovar ou devolver"
      closeLabel="Fechar"
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setReason('');
          actions.cancelReview();
        }
      }}
    >
      <Stack gap={200}>
        <Card>
          <Stack gap={100}>
            <Text role="data">Executor: {detail?.executorName ?? '—'}</Text>
            <Text role="data">Posição: {detail?.positionName ?? '—'}</Text>
            <Text role="data">Planejado: {detail?.plannedWindow ?? '—'}</Text>
            <Text role="data">
              Início real: {detail?.startedAtTime ?? '—'} · Fim real:{' '}
              {detail?.finishedAtTime ?? '—'}
            </Text>
            {detail?.notes != null && <Text role="data">Observação: {detail.notes}</Text>}
          </Stack>
        </Card>

        <Stack gap={100}>
          <Text role="label">Evidências</Text>
          {detail !== null && detail.evidence.length === 0 ? (
            <Text tone="secondary">Nenhuma evidência anexada.</Text>
          ) : (
            <Flex gap={100} wrap>
              {detail?.evidence.map((item) =>
                item.url !== null ? (
                  <img
                    key={item.id}
                    src={item.url}
                    alt="Evidência da execução"
                    style={{ maxWidth: '160px', maxHeight: '160px', borderRadius: '4px' }}
                  />
                ) : (
                  <Badge key={item.id} status="neutral">
                    📷 aguardando sincronização
                  </Badge>
                ),
              )}
            </Flex>
          )}
        </Stack>

        <Field label="Motivo da devolução (obrigatório ao devolver)">
          <TextArea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={detail?.busy === true}
            rows={2}
          />
        </Field>

        {detail?.error != null && (
          <Alert status="error" live="polite" title="Conferência não registrada">
            {detail.error}
          </Alert>
        )}
        <Flex gap={100} wrap>
          <Button
            variant="secondary"
            disabled={detail?.busy === true}
            onClick={() => void actions.sendBack(reason)}
          >
            Devolver para correção
          </Button>
          <Button disabled={detail?.busy === true} onClick={() => void actions.approve()}>
            Aprovar
          </Button>
        </Flex>
      </Stack>
    </Drawer>
  );
}

export function SharedOperationsScreen({
  view,
  actions,
  managementLink,
}: {
  readonly view: SharedOperationsView;
  readonly actions: SharedOperationsActions;
  readonly managementLink: NavigationLinkAdapter;
}): ReactElement {
  return (
    <Page id="conteudo">
      <PageHeader
        title="Operação de Hoje"
        eyebrow="Quadro da loja"
        description="Toque na ação e identifique-se com seu PIN"
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
              managementLink.navigate?.();
            }}
          >
            Gestão
          </Button>
        }
      />

      {!view.readyToSync && view.phase === 'ready' && (
        <Banner status="warning">
          Sem conexão com o servidor. A operação continua normalmente: tudo fica salvo neste
          aparelho e será enviado quando a conexão voltar.
        </Banner>
      )}

      {view.notice !== null && (
        <div role="status">
          <Text tone="secondary">{view.notice}</Text>
        </div>
      )}

      {view.phase === 'loading' && <LoadingState label="Carregando a operação de hoje" />}
      {view.phase === 'error' && (
        <ErrorState
          title="Não foi possível carregar a operação"
          description="Tente novamente em instantes."
          retryAction={<Button onClick={() => void actions.reload()}>Tentar novamente</Button>}
        />
      )}

      {view.phase === 'ready' && view.dayNotMaterialized && (
        <EmptyState
          title="O dia ainda não foi aberto"
          description="Identifique-se para abrir a operação de hoje e carregar as tarefas da loja."
          action={
            <Button onClick={() => actions.requestAction('materialize', null)}>Abrir o dia</Button>
          }
        />
      )}

      {view.phase === 'ready' && !view.dayNotMaterialized && (
        <Section title="Tarefas da loja">
          <Stack gap={200}>
            <Card>
              <Text role="data">
                Atrasadas: {view.counts.late} · Em execução: {view.counts.inProgress} · Aguardando
                conferência: {view.counts.awaitingReview} · Concluídas: {view.counts.done}
              </Text>
            </Card>

            <SegmentedControl
              aria-label="Filtrar tarefas da operação"
              value={view.filter}
              onValueChange={(value) => actions.setFilter(value as SharedOperationsView['filter'])}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'pending', label: 'Pendentes' },
                { value: 'in-progress', label: 'Em execução' },
                { value: 'review', label: 'Conferir' },
                { value: 'done', label: 'Concluídas' },
              ]}
            />

            {view.tasks.length === 0 ? (
              <EmptyState
                title="Nenhuma tarefa aqui"
                description="Não há tarefas nesta situação agora."
              />
            ) : (
              <Stack gap={200}>
                {view.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} actions={actions} />
                ))}
              </Stack>
            )}
          </Stack>
        </Section>
      )}

      <ActionPinDialog view={view} actions={actions} />
      <SubmitDrawer view={view} actions={actions} />
      <ReviewDrawer view={view} actions={actions} />
    </Page>
  );
}
