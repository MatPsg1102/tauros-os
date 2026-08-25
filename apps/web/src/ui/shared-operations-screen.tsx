// OPERAÇÃO DE HOJE — quadro COMPARTILHADO da loja (tablet no chão de
// operação). Apresentacional: consome o view model e a API pública do DS.
// Glove-first: ações principais grandes e visíveis (nunca menu escondido);
// estados reconhecíveis por TEXTO operacional pt-BR, não só cor. As ações
// críticas abrem o PIN contextual — a tela em si não exige identidade.

'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactElement } from 'react';

import {
  Alert,
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
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
  Select,
  SegmentedControl,
  Sidebar,
  Stack,
  Text,
  TextArea,
} from '@tauros/ui-primitives';
import type { NavigationLinkAdapter } from '@tauros/ui-primitives';

import { useIsMobile } from '../controllers/use-is-mobile.js';
import type {
  SharedOperationsActions,
  SharedOperationsView,
  SharedTaskView,
} from '../controllers/use-shared-operations.js';
import { OperationsSidebarSections } from './operations-sidebar.js';
import { firstName, memberBadge } from './team-member-badge.js';

/** Rótulos operacionais das situações — fonte única do SegmentedControl. */
const SITUATION_LABEL: Readonly<Record<SharedOperationsView['filter'], string>> = {
  all: 'todas',
  pending: 'pendentes',
  'in-progress': 'em execução',
  review: 'a conferir',
  returned: 'devolvidas',
  done: 'concluídas',
};

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
          {/* prazo: ícone + texto + forma/cor semântica — nunca só cor (P5) */}
          {task.dueState === 'OVERDUE' && task.dueLabel !== null && (
            <Badge status="error">{`🔴 ${task.dueLabel}`}</Badge>
          )}
          {task.dueState === 'DUE_SOON' && task.dueLabel !== null && (
            <Badge status="warn">{`⚠ ${task.dueLabel}`}</Badge>
          )}
          {task.isUnassigned && <Badge status="warn">Sem responsável</Badge>}
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
          {/* honestidade: nomear ocupante fora da escala nunca vira promessa
              de execução — a elegibilidade continua sendo do domínio (§4) */}
          {task.startedByName === null && task.assigneesOffSchedule
            ? ' (fora da escala de hoje)'
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
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  // remonta as células a cada ABERTURA (dígitos de ação anterior nunca ficam
  // visíveis — fechamento programático não dispara onOpenChange) e a cada
  // TENTATIVA (dois erros idênticos seguidos também limpam as células). A
  // SELEÇÃO persiste — a mesma pessoa em ações seguidas só redigita o PIN.
  const [openSeq, setOpenSeq] = useState(0);
  const [attemptSeq, setAttemptSeq] = useState(0);
  const request = view.pinRequest;
  const open = request !== null;
  const pinLength = request?.pinLength ?? 6;
  useEffect(() => {
    if (open) {
      setOpenSeq((sequence) => sequence + 1);
      setPin('');
    }
  }, [open]);
  const reset = (): void => {
    setEmployeeId('');
    setPin('');
  };
  return (
    <Dialog
      open={open}
      title={request?.prompt ?? 'Identificação'}
      {...(request?.taskTitle != null ? { description: request.taskTitle } : {})}
      closeLabel="Cancelar"
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          reset();
          actions.cancelPin();
        }
      }}
    >
      <Stack gap={200}>
        {/* employeeId IDENTIFICA; o PIN VERIFICA (ADR-021). A seleção não é
            autorização: o que cada um pode fazer vem da autorização efetiva. */}
        <Field label="Quem está executando?">
          <Select
            value={employeeId}
            onChange={(event) => {
              setEmployeeId(event.target.value);
              // trocar de pessoa NUNCA reaproveita dígitos ocultos do PIN
              // anterior (as células remontam vazias pela key abaixo)
              setPin('');
            }}
            disabled={request?.busy === true}
          >
            <option value="" disabled>
              Selecione o colaborador
            </option>
            {(request?.candidates ?? []).map((candidate) => (
              <option key={candidate.employeeId} value={candidate.employeeId}>
                {candidate.name}
              </option>
            ))}
          </Select>
        </Field>
        <PinInput
          key={`${String(openSeq)}:${String(attemptSeq)}:${employeeId}`}
          length={pinLength}
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
          disabled={employeeId === '' || pin.length < pinLength || request?.busy === true}
          onClick={() => {
            // erro de PIN NÃO apaga a seleção do colaborador (com luva, cada
            // reseleção custa caro); as células remontam a cada tentativa e
            // tudo é limpo quando o diálogo fecha
            setPin('');
            setAttemptSeq((sequence) => sequence + 1);
            void actions.confirmPin(employeeId, pin);
          }}
        >
          {request?.busy === true ? 'Confirmando…' : 'Confirmar'}
        </Button>
      </Stack>
    </Dialog>
  );
}

/**
 * Captura de evidência (Foto V1.1) — evolução do input único: CÂMERA ou
 * GALERIA, com preview e confirmação explícita; nada persiste sem "Usar
 * foto". Nativo por input file (sem getUserMedia — nenhum stream aberto):
 * em celular/tablet `capture="environment"` abre a câmera traseira; onde o
 * navegador não abre câmera (notebook sem suporte), o MESMO controle degrada
 * para o seletor do sistema — fallback correto, não erro. "Escolher foto"
 * fica sempre visível como alternativa; a câmera só dispara por toque
 * explícito do operador.
 */
function PhotoCapture({
  disabled,
  onConfirm,
}: {
  readonly disabled: boolean;
  readonly onConfirm: (file: File) => void;
}): ReactElement {
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{
    readonly file: File;
    readonly url: string;
    readonly source: 'camera' | 'pick';
  } | null>(null);

  // preview usa object URL — revogado SEMPRE que sai de cena (troca,
  // descarte, confirmação, desmontagem)
  const pendingUrl = useRef<string | null>(null);
  pendingUrl.current = pending?.url ?? null;
  useEffect(
    () => () => {
      if (pendingUrl.current !== null) URL.revokeObjectURL(pendingUrl.current);
    },
    [],
  );

  function replacePending(
    next: { readonly file: File; readonly url: string; readonly source: 'camera' | 'pick' } | null,
  ): void {
    setPending((current) => {
      if (current !== null) URL.revokeObjectURL(current.url);
      return next;
    });
  }

  function onFile(source: 'camera' | 'pick') {
    return (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      // limpa o input: reapresentar o MESMO arquivo dispara change de novo
      event.target.value = '';
      if (file === undefined) return;
      replacePending({ file, url: URL.createObjectURL(file), source });
    };
  }

  return (
    <Stack gap={100}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Capturar pela câmera"
        hidden
        disabled={disabled}
        onChange={onFile('camera')}
      />
      <input
        ref={pickRef}
        type="file"
        accept="image/*"
        aria-label="Adicionar foto"
        hidden
        disabled={disabled}
        onChange={onFile('pick')}
      />
      {pending === null ? (
        <Flex gap={100} wrap>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
          >
            Abrir câmera
          </Button>
          <Button variant="secondary" disabled={disabled} onClick={() => pickRef.current?.click()}>
            Escolher foto
          </Button>
        </Flex>
      ) : (
        <Stack gap={100}>
          <img
            src={pending.url}
            alt="Pré-visualização da foto"
            style={{ maxWidth: '160px', maxHeight: '160px', borderRadius: '4px' }}
          />
          {/* confirmar e repetir andam juntas (mesmo peso de decisão);
              descartar é a saída — nunca compete com elas na mesma linha */}
          <Flex gap={100} wrap>
            <Button
              disabled={disabled}
              onClick={() => {
                onConfirm(pending.file);
                replacePending(null);
              }}
            >
              Usar foto
            </Button>
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => (pending.source === 'camera' ? cameraRef : pickRef).current?.click()}
            >
              Tirar outra
            </Button>
          </Flex>
          <Button variant="ghost" disabled={disabled} onClick={() => replacePending(null)}>
            Descartar
          </Button>
        </Stack>
      )}
    </Stack>
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
          <PhotoCapture
            disabled={form?.busy === true}
            onConfirm={(file) => void actions.addEvidence(file)}
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

/** Região compacta de atenção operacional (§12) — visível e acionável, nunca modal. */
function DueAlerts({
  view,
  actions,
}: {
  readonly view: SharedOperationsView;
  readonly actions: SharedOperationsActions;
}): ReactElement | null {
  if (view.counts.late === 0 && view.counts.dueSoon === 0 && view.counts.needsCorrection === 0)
    return null;
  return (
    <Flex gap={100} wrap role="group" aria-label="Alertas de prazo">
      {view.counts.late > 0 && (
        <Chip
          selected={view.dueFilter === 'overdue'}
          onClick={() => actions.setDueFilter(view.dueFilter === 'overdue' ? null : 'overdue')}
        >
          {`🔴 ${String(view.counts.late)} ${view.counts.late === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`}
        </Chip>
      )}
      {view.counts.dueSoon > 0 && (
        <Chip
          selected={view.dueFilter === 'due-soon'}
          onClick={() => actions.setDueFilter(view.dueFilter === 'due-soon' ? null : 'due-soon')}
        >
          {`⚠ ${String(view.counts.dueSoon)} ${view.counts.dueSoon === 1 ? 'próxima do prazo' : 'próximas do prazo'}`}
        </Chip>
      )}
      {view.counts.needsCorrection > 0 && (
        <Chip
          selected={view.filter === 'returned'}
          onClick={() => actions.setFilter(view.filter === 'returned' ? 'all' : 'returned')}
        >
          {`↩ ${String(view.counts.needsCorrection)} ${view.counts.needsCorrection === 1 ? 'devolvida' : 'devolvidas'}`}
        </Chip>
      )}
    </Flex>
  );
}

/** Filtros ativos como chips removíveis (§14) + limpar tudo. */
function ActiveFilters({
  view,
  actions,
}: {
  readonly view: SharedOperationsView;
  readonly actions: SharedOperationsActions;
}): ReactElement | null {
  const positionName =
    view.assignmentFilter?.kind === 'position'
      ? (view.positionSummaries.find(
          (summary) =>
            view.assignmentFilter?.kind === 'position' &&
            summary.positionId === view.assignmentFilter.positionId,
        )?.name ?? 'Posição')
      : null;
  const chips: { readonly key: string; readonly label: string; readonly clear: () => void }[] = [];
  if (positionName !== null)
    chips.push({
      key: 'position',
      label: positionName,
      clear: () => actions.setAssignmentFilter(null),
    });
  if (view.assignmentFilter?.kind === 'unassigned')
    chips.push({
      key: 'unassigned',
      label: 'Sem responsável',
      clear: () => actions.setAssignmentFilter(null),
    });
  if (view.employeeFilterName !== null)
    chips.push({
      key: 'employee',
      label: view.employeeFilterName,
      clear: () => actions.setEmployeeFilter(null),
    });
  if (view.dueFilter !== null)
    chips.push({
      key: 'due',
      label: view.dueFilter === 'overdue' ? 'Atrasadas' : 'Próximas do prazo',
      clear: () => actions.setDueFilter(null),
    });
  if (chips.length === 0) return null;
  return (
    <Flex gap={100} wrap role="group" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          selected
          onClick={chip.clear}
          onRemove={chip.clear}
          removeLabel={`Remover filtro ${chip.label}`}
        >
          {chip.label}
        </Chip>
      ))}
      <Button variant="ghost" onClick={() => actions.clearFilters()}>
        Limpar filtros
      </Button>
    </Flex>
  );
}

/**
 * Faixa "Equipe de hoje" — navegação PRIMÁRIA por pessoa no corpo do quadro
 * (UX Operacional V1.3). Antes, filtrar por colaborador exigia alcançar a
 * sidebar (recolhida como rail no desktop) e rolar até o terceiro grupo: caro
 * demais para tablet com luva. Aqui é toque único, alvo grande, sempre
 * visível — mesma linguagem de Chip dos alertas de prazo.
 *
 * Fonte ÚNICA: `view.teamToday` = presença PLANEJADA da data (Escala V1),
 * nunca o cadastro inteiro. Escreve no MESMO `employeeFilter` da sidebar —
 * não há segunda fonte de verdade nem estado paralelo. Selecionar uma pessoa
 * é LEITURA PURA: não toca fila, auditoria nem autorização. Aparecer na faixa
 * não autoriza nada — claim/start seguem decididos pelo domínio no PIN.
 */
/**
 * Resumo pt-BR dos filtros ativos para o vazio HONESTO: dizer QUAL combinação
 * esvaziou o quadro, em vez do genérico "nenhuma tarefa aqui". Leitura pura
 * do view model — nenhum estado próprio.
 */
function activeFilterSummary(view: SharedOperationsView): string {
  const parts: string[] = [];
  if (view.employeeFilterName !== null) parts.push(view.employeeFilterName);
  if (view.assignmentFilter?.kind === 'unassigned') parts.push('sem responsável');
  else if (view.assignmentFilter?.kind === 'position') {
    const positionId = view.assignmentFilter.positionId;
    parts.push(
      view.positionSummaries.find((summary) => summary.positionId === positionId)?.name ??
        'a posição selecionada',
    );
  }
  if (view.dueFilter !== null)
    parts.push(view.dueFilter === 'overdue' ? 'atrasadas' : 'próximas do prazo');
  if (view.filter !== 'all') parts.push(SITUATION_LABEL[view.filter]);
  return parts.length === 0 ? 'os filtros atuais' : parts.join(' + ');
}

function TeamStrip({
  view,
  actions,
  managementLink,
}: {
  readonly view: SharedOperationsView;
  readonly actions: SharedOperationsActions;
  readonly managementLink: NavigationLinkAdapter;
}): ReactElement {
  const captionId = useId();
  // rótulo VISÍVEL e acessível são o mesmo nó: sem heading (o outline pertence
  // aos cards) e sem anúncio duplicado.
  const caption = (
    <Text id={captionId} role="data">
      Equipe escalada hoje
    </Text>
  );

  if (view.scheduleStatus === 'unconfigured') {
    return (
      <Stack gap={100}>
        {caption}
        <EmptyState
          title="Escala de hoje não configurada"
          description="Esta loja ainda não tem um padrão de escala vigente para a data. As tarefas continuam no quadro pela posição responsável, mas ninguém aparece como escalado."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                managementLink.navigate?.();
              }}
            >
              Configurar escala
            </Button>
          }
        />
      </Stack>
    );
  }

  if (view.teamToday.length === 0) {
    return (
      <Stack gap={100}>
        {caption}
        <EmptyState
          title="Ninguém escalado para hoje"
          description="Nenhum colaborador está previsto na escala desta data. As tarefas seguem no quadro pela posição responsável e podem ser assumidas mediante identificação por PIN."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                managementLink.navigate?.();
              }}
            >
              Ver escala e equipe
            </Button>
          }
        />
      </Stack>
    );
  }

  const selected = view.teamToday.find((member) => member.employeeId === view.employeeFilter);
  return (
    <Stack gap={100}>
      {caption}
      <Flex gap={100} wrap role="group" aria-labelledby={captionId}>
        <Chip
          selected={view.employeeFilter === null}
          onClick={() => actions.setEmployeeFilter(null)}
        >
          Toda a equipe
        </Chip>
        {view.teamToday.map((member) => (
          <Chip
            key={member.employeeId}
            selected={view.employeeFilter === member.employeeId}
            onClick={() =>
              actions.setEmployeeFilter(
                view.employeeFilter === member.employeeId ? null : member.employeeId,
              )
            }
          >
            <Flex gap={50} align="center">
              {/* nome já está ao lado: avatar é decorativo (sem anúncio duplo) */}
              <Avatar name={member.name} size="sm" decorative />
              {firstName(member.name)}
              {memberBadge(member)}
            </Flex>
          </Chip>
        ))}
      </Flex>
      {/* contexto de quem está selecionado: posição e jornada JÁ vêm prontas do
          view model — o operador confirma que filtrou a pessoa certa */}
      {selected !== undefined && (
        <Text role="data" tone="secondary">
          {selected.name}
          {selected.positionName !== null ? ` · ${selected.positionName}` : ''}
          {selected.workPeriodLabel !== null ? ` · ${selected.workPeriodLabel}` : ''}
        </Text>
      )}
    </Stack>
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
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFilters =
    view.filter !== 'all' ||
    view.assignmentFilter !== null ||
    view.employeeFilter !== null ||
    view.dueFilter !== null;
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
        <Section
          title={
            view.employeeFilterName !== null
              ? `Tarefas de ${view.employeeFilterName}`
              : 'Tarefas da loja'
          }
          actions={
            view.readyToSync && view.pendingSyncCount > 0 ? (
              <Button variant="secondary" onClick={() => void actions.syncNow()}>
                Sincronizar agora
              </Button>
            ) : undefined
          }
        >
          <Stack gap={200}>
            {/* mobile: sidebar de triagem vira Drawer (§16) */}
            {isMobile && (
              <Button variant="secondary" onClick={() => setFiltersOpen(true)}>
                Filtros e equipe
              </Button>
            )}

            <DueAlerts view={view} actions={actions} />

            <TeamStrip view={view} actions={actions} managementLink={managementLink} />

            <ActiveFilters view={view} actions={actions} />

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
                { value: 'returned', label: 'Devolvidas' },
                { value: 'done', label: 'Concluídas' },
              ]}
            />

            {view.tasks.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  title="Nenhuma tarefa nesta combinação de filtros"
                  description={`Nada corresponde a ${activeFilterSummary(view)} agora. Ajuste ou limpe os filtros para ver o quadro completo.`}
                  action={
                    <Button onClick={() => actions.clearFilters()}>Limpar todos os filtros</Button>
                  }
                  {...(view.employeeFilterName !== null
                    ? {
                        secondaryAction: (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              actions.setFilter('all');
                              actions.setAssignmentFilter(null);
                              actions.setDueFilter(null);
                            }}
                          >
                            {`Ver todas de ${view.employeeFilterName}`}
                          </Button>
                        ),
                      }
                    : {})}
                />
              ) : (
                <EmptyState
                  title="Nenhuma tarefa aqui"
                  description="Não há tarefas nesta situação agora."
                />
              )
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

      {/* Drawer móvel de triagem — MESMO componente Sidebar/seções do desktop */}
      <Drawer
        open={isMobile && filtersOpen}
        side="left"
        title="Filtros e equipe"
        description="Toque para filtrar o quadro por situação, posição ou colaborador"
        closeLabel="Fechar"
        onOpenChange={(isOpen) => {
          if (!isOpen) setFiltersOpen(false);
        }}
      >
        <Sidebar label="Triagem da operação">
          <OperationsSidebarSections
            view={view}
            actions={actions}
            onNavigate={() => setFiltersOpen(false)}
          />
        </Sidebar>
      </Drawer>

      <ActionPinDialog view={view} actions={actions} />
      <SubmitDrawer view={view} actions={actions} />
      <ReviewDrawer view={view} actions={actions} />
    </Page>
  );
}
