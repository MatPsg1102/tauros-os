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
  Chip,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Flex,
  LoadingState,
  Modal,
  NumberInput,
  Page,
  PageHeader,
  PinInput,
  Radio,
  RadioGroup,
  ResponsiveGrid,
  Section,
  SegmentedControl,
  Sidebar,
  Stack,
  StickyRegion,
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
import { AttentionStrip, plural } from './attention-strip.js';
import { operationalDateLabel } from './format.js';
import { OperationalTaskCard } from './operational-task-card.js';
import { OperationsSidebarSections } from './operations-sidebar.js';
import { visualStateFromStatus } from './task-status.js';
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

/** Linha de responsabilidade: posição — pessoa(s), com honestidade de escala. */
function responsibilityLine(task: SharedTaskView): string {
  const who =
    task.startedByName !== null
      ? ` — ${task.startedByName}`
      : task.assigneeNames.length > 0
        ? ` — ${task.assigneeNames.join(', ')}`
        : '';
  // honestidade: nomear ocupante fora da escala nunca vira promessa de
  // execução — a elegibilidade continua sendo do domínio (§4)
  const offSchedule =
    task.startedByName === null && task.assigneesOffSchedule ? ' (fora da escala de hoje)' : '';
  const started = task.startedAtTime !== null ? ` · Iniciada ${task.startedAtTime}` : '';
  return `${task.positionName ?? '—'}${who}${offSchedule}${started}`;
}

function TaskCard({
  task,
  actions,
}: {
  readonly task: SharedTaskView;
  readonly actions: SharedOperationsActions;
}): ReactElement {
  // o atraso é derivação OFICIAL do domínio (isOverdue) e chega por dueState:
  // uma tarefa PENDING vencida É visualmente atrasada
  const state =
    task.dueState === 'OVERDUE' ? ('overdue' as const) : visualStateFromStatus(task.status);
  return (
    <OperationalTaskCard
      title={task.title}
      state={state}
      isUnassigned={task.isUnassigned}
      dueState={task.dueState}
      dueLabel={task.dueLabel}
      timeCaption={task.startTime !== null ? `${task.startTime} →` : 'até'}
      timePrimary={task.dueTime}
      meta={responsibilityLine(task)}
      requirementLabel={
        task.requiresPhoto && task.status !== 'DONE' ? '📷 Exige registro de foto' : null
      }
      extraBadges={
        task.evidenceCount > 0 ? (
          <Badge status="neutral">{`📷 ${task.evidenceCount} evidência${task.evidenceCount > 1 ? 's' : ''}`}</Badge>
        ) : undefined
      }
      correctionReason={task.correctionReason}
      syncLabel={task.syncLabel}
      action={primaryAction(task, actions)}
    />
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
            autorização: o que cada um pode fazer vem da autorização efetiva.
            V2 glove-first: RadioGroup do DS (alvos de 64px) no lugar do
            dropdown nativo do SO — a interação mais frequente do produto. */}
        <RadioGroup
          label="Quem está executando?"
          value={employeeId}
          onValueChange={(value) => {
            setEmployeeId(value);
            // trocar de pessoa NUNCA reaproveita dígitos ocultos do PIN
            // anterior (as células remontam vazias pela key abaixo)
            setPin('');
          }}
        >
          {(request?.candidates ?? []).map((candidate) => (
            <Radio
              key={candidate.employeeId}
              value={candidate.employeeId}
              label={candidate.name}
              disabled={request?.busy === true}
            />
          ))}
        </RadioGroup>
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

/**
 * Miniaturas de evidência AMPLIÁVEIS: 96–160px não permitem julgar uma foto
 * em tablet — o toque abre a imagem em tamanho real num Modal (conferência
 * de verdade). Leitura pura; nada é persistido aqui.
 */
function EvidenceGallery({
  items,
  altLabel,
}: {
  readonly items: readonly { readonly id: string; readonly url: string | null }[];
  readonly altLabel: string;
}): ReactElement {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <>
      <Flex gap={100} wrap>
        {items.map((item) =>
          item.url !== null ? (
            <button
              key={item.id}
              type="button"
              aria-label="Ampliar foto"
              onClick={() => setExpanded(item.url)}
              style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
            >
              <img
                src={item.url}
                alt={altLabel}
                style={{ maxWidth: '160px', maxHeight: '160px', borderRadius: '4px' }}
              />
            </button>
          ) : (
            <Badge key={item.id} status="neutral">
              📷 aguardando sincronização
            </Badge>
          ),
        )}
      </Flex>
      <Modal
        open={expanded !== null}
        title="Foto da evidência"
        closeLabel="Fechar"
        onOpenChange={(isOpen) => {
          if (!isOpen) setExpanded(null);
        }}
      >
        {expanded !== null && (
          <img src={expanded} alt={altLabel} style={{ maxWidth: '100%', height: 'auto' }} />
        )}
      </Modal>
    </>
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
  const [measure, setMeasure] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const form = view.submitForm;
  const open = form !== null;

  // formulário limpo a cada ABERTURA; erro de validação NUNCA apaga o que o
  // operador digitou (mesmo contrato dos demais drawers do app)
  useEffect(() => {
    if (open) return;
    setMeasure(null);
    setNotes('');
  }, [open]);
  const range = form?.expectedRange ?? null;
  const rangeLabel =
    range === null ? undefined : `Faixa esperada: ${range.min ?? '—'} a ${range.max ?? '—'}`;
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
          setMeasure(null);
          setNotes('');
          actions.cancelSubmit();
        }
      }}
    >
      <Stack gap={200}>
        {form?.expectedRange != null && (
          <Field
            label="Medição registrada"
            {...(rangeLabel !== undefined ? { description: rangeLabel } : {})}
          >
            {/* NumberInput do DS: vírgula pt-BR nativa — fim do parse manual */}
            <NumberInput
              value={measure}
              onValueChange={(change) => setMeasure(change.value)}
              allowNegative
              disabled={form.busy}
            />
          </Field>
        )}

        <Stack gap={100}>
          <Text role="label">
            {form?.requiresPhoto === true ? 'Foto da tarefa (obrigatória)' : 'Foto da tarefa'}
          </Text>
          {/* o operador SEMPRE sabe se a evidência já vale: estado explícito,
              nunca deduzido da presença de miniatura */}
          {form !== null && form.evidence.length > 0 ? (
            <Stack gap={100}>
              <Badge status="success">
                {`Foto adicionada${form.evidence.length > 1 ? ` (${form.evidence.length})` : ''}`}
              </Badge>
              <EvidenceGallery items={form.evidence} altLabel="Evidência registrada" />
            </Stack>
          ) : form?.requiresPhoto === true ? (
            <Text role="caption" tone="secondary">
              Nenhuma foto adicionada ainda.
            </Text>
          ) : null}
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
            void actions.submitExecution({ numericValue: measure, notes });
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
        {/* decisão gerencial: os FATOS primeiro, sem card-dentro-de-painel
            (informação > contêiner) — rótulo e valor em linhas escaneáveis */}
        <Stack gap={50}>
          {(
            [
              ['Executor', detail?.executorName ?? '—'],
              ['Posição', detail?.positionName ?? '—'],
              ['Planejado', detail?.plannedWindow ?? '—'],
              ['Executado', `${detail?.startedAtTime ?? '—'} → ${detail?.finishedAtTime ?? '—'}`],
            ] as const
          ).map(([label, value]) => (
            <Flex key={label} gap={100} justify="between" align="baseline">
              <Text role="caption" tone="secondary">
                {label}
              </Text>
              <Text role="data">{value}</Text>
            </Flex>
          ))}
          {detail?.notes != null && (
            <Flex gap={100} justify="between" align="baseline">
              <Text role="caption" tone="secondary">
                Observação
              </Text>
              <Text role="data">{detail.notes}</Text>
            </Flex>
          )}
        </Stack>

        <Stack gap={100}>
          <Text role="label">Evidências</Text>
          {detail !== null && detail.evidence.length === 0 ? (
            <Text tone="secondary">Nenhuma evidência anexada.</Text>
          ) : (
            <EvidenceGallery items={detail?.evidence ?? []} altLabel="Evidência da execução" />
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
        {/* consequências opostas NUNCA lado a lado (mis-tap com luva):
            Aprovar é a primária em linha própria; Devolver vem abaixo */}
        <Stack gap={100}>
          <Button fullWidth disabled={detail?.busy === true} onClick={() => void actions.approve()}>
            Aprovar
          </Button>
          <Button
            fullWidth
            variant="secondary"
            disabled={detail?.busy === true}
            onClick={() => void actions.sendBack(reason)}
          >
            Devolver para correção
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

/**
 * Região de atenção do cockpit (V2) — exceções acionáveis num único lugar:
 * atraso, prazo, conferência, devolução e distribuição. Cada tile filtra o
 * quadro ao toque (leitura pura). Zero = tile ausente; tudo em dia = faixa
 * ausente (exceção > normalidade).
 */
function DueAlerts({
  view,
  actions,
}: {
  readonly view: SharedOperationsView;
  readonly actions: SharedOperationsActions;
}): ReactElement | null {
  return (
    <AttentionStrip
      groupLabel="Alertas da operação"
      tiles={[
        {
          key: 'late',
          count: view.counts.late,
          label: plural(view.counts.late, 'tarefa atrasada', 'tarefas atrasadas'),
          selected: view.dueFilter === 'overdue',
          onToggle: () => actions.setDueFilter(view.dueFilter === 'overdue' ? null : 'overdue'),
        },
        {
          key: 'due-soon',
          count: view.counts.dueSoon,
          label: plural(view.counts.dueSoon, 'próxima do prazo', 'próximas do prazo'),
          selected: view.dueFilter === 'due-soon',
          onToggle: () => actions.setDueFilter(view.dueFilter === 'due-soon' ? null : 'due-soon'),
        },
        {
          key: 'review',
          count: view.counts.awaitingReview,
          label: plural(view.counts.awaitingReview, 'para conferir', 'para conferir'),
          selected: view.filter === 'review',
          onToggle: () => actions.setFilter(view.filter === 'review' ? 'all' : 'review'),
        },
        {
          key: 'returned',
          count: view.counts.needsCorrection,
          label: plural(view.counts.needsCorrection, 'devolvida', 'devolvidas'),
          selected: view.filter === 'returned',
          onToggle: () => actions.setFilter(view.filter === 'returned' ? 'all' : 'returned'),
        },
        {
          key: 'unassigned',
          count: view.unassignedCount,
          label: plural(view.unassignedCount, 'sem responsável', 'sem responsável'),
          selected: view.assignmentFilter?.kind === 'unassigned',
          onToggle: () =>
            actions.setAssignmentFilter(
              view.assignmentFilter?.kind === 'unassigned' ? null : { kind: 'unassigned' },
            ),
        },
      ]}
    />
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
        // glove-first: o CHIP INTEIRO (64px) remove o filtro — nunca um ×
        // de 24px; o rótulo acessível declara a ação
        <Chip
          key={chip.key}
          selected
          aria-label={`Remover filtro ${chip.label}`}
          onClick={chip.clear}
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

/** Alternador de situação — fonte única (corpo mobile e região sticky). */
function situationControl(
  view: SharedOperationsView,
  actions: SharedOperationsActions,
): ReactElement {
  return (
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
      {/* conexão e navegação vivem no chrome global (AppChrome) — o header
          da tela carrega só a identidade dela e a data operacional */}
      <PageHeader
        title="Operação de Hoje"
        eyebrow="Quadro da loja"
        description="Toque na ação e identifique-se com seu PIN"
        status={<Text role="data">{operationalDateLabel(view.operationalDate)}</Text>}
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

      {view.phase === 'loading' && (
        <LoadingState label="Carregando a operação de hoje" variant="skeleton" lines={4} />
      )}
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
            view.pendingSyncCount > 0 ? (
              // o tamanho da fila é visível SEMPRE que houver pendência —
              // offline o botão não aparece, mas o número continua contando
              view.readyToSync ? (
                <Button variant="secondary" onClick={() => void actions.syncNow()}>
                  {`Sincronizar ${String(view.pendingSyncCount)} ${view.pendingSyncCount === 1 ? 'registro' : 'registros'}`}
                </Button>
              ) : (
                <Text role="caption" tone="secondary">
                  {`${String(view.pendingSyncCount)} ${view.pendingSyncCount === 1 ? 'registro aguardando' : 'registros aguardando'} conexão`}
                </Text>
              )
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

            {/* triagem por situação persiste durante o scroll do quadro
                (tablet/desktop); no mobile ela rola junto — 2 linhas fixas
                custariam caro em 390px */}
            {isMobile ? (
              situationControl(view, actions)
            ) : (
              <StickyRegion position="top">{situationControl(view, actions)}</StickyRegion>
            )}

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
              /* linhas de operação em grade responsiva: 2–3 por linha no
                 tablet landscape, 1 no portrait/mobile — zero JS de viewport */
              <ResponsiveGrid itemSize="lg" gap={200}>
                {view.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} actions={actions} />
                ))}
              </ResponsiveGrid>
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
