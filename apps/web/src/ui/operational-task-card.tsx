// LINHA DE OPERAÇÃO (Frontend Experience V2) — o card de tarefa dos quadros.
// Assinatura visual do produto: régua de estado na borda esquerda (cor
// semântica SÓ para exceção) + horário-limite como âncora tipográfica
// (número em fonte de dados, peso de ênfase). O quadro lê-se como uma rail
// de expedição: hora → tarefa → responsável → ação.
//
// Componente de APLICAÇÃO: composição pura da API pública do DS + tokens via
// cssVar (nenhum primitive novo, nenhum valor visual fora de token — as
// larguras estruturais de 1–4px seguem o mesmo critério do allowlist do DS).
// Card as="article" + aria-labelledby: o card é um artigo NOMEADO pelo
// próprio título — âncora semântica estável para leitores de tela e testes.

'use client';

import { useId, type ReactElement, type ReactNode } from 'react';

import { cssVar } from '@tauros/tokens';
import { Alert, Badge, Card, Flex, Heading, Stack, Text } from '@tauros/ui-primitives';

import { taskStateBadge, taskStateRail, type TaskVisualState } from './task-status.js';

export function OperationalTaskCard({
  title,
  state,
  pendingLabel,
  isUnassigned = false,
  dueState = 'NORMAL',
  dueLabel = null,
  timeCaption,
  timePrimary,
  meta,
  requirementLabel = null,
  extraBadges,
  correctionReason = null,
  syncLabel = null,
  action,
  children,
}: {
  readonly title: string;
  readonly state: TaskVisualState;
  /** Vocabulário do quadro para PENDING ("Pendente" | "A fazer"). */
  readonly pendingLabel?: string;
  readonly isUnassigned?: boolean;
  readonly dueState?: 'OVERDUE' | 'DUE_SOON' | 'NORMAL';
  /** Rótulo pronto do prazo ("Atrasada há 28 min" / "Vence em 18 min"). */
  readonly dueLabel?: string | null;
  /** Legenda do bloco de tempo ("até" / "08:00 →"). */
  readonly timeCaption: string;
  /** O número-âncora ("14:00"). */
  readonly timePrimary: string;
  /** Linha de responsabilidade ("Produção — Carlos Nunes"). */
  readonly meta: string;
  /** Requisito da tarefa ("📷 Foto obrigatória"). */
  readonly requirementLabel?: string | null;
  readonly extraBadges?: ReactNode;
  readonly correctionReason?: string | null;
  readonly syncLabel?: string | null;
  /** Ação principal (botão de alvo cheio) — glove-first. */
  readonly action?: ReactNode;
  readonly children?: ReactNode;
}): ReactElement {
  const headingId = useId();
  const rail = taskStateRail(state, isUnassigned);
  // OVERDUE: um único sinal de atraso (badge error com o "há quanto tempo") —
  // nunca dois badges para o mesmo fato
  const showStateBadge = !(state === 'overdue' && dueLabel !== null);
  return (
    <Card
      as="article"
      aria-labelledby={headingId}
      style={
        rail !== null
          ? { borderLeft: `4px solid ${rail}` }
          : // borda-régua neutra: o alinhamento do quadro não "dança" entre
            // cards com e sem exceção
            { borderLeft: `4px solid ${cssVar('color-border-default')}` }
      }
    >
      <Stack gap={100}>
        <Flex gap={100} align="start" justify="between" wrap>
          <Stack gap={50}>
            <Heading id={headingId} level={3} visualLevel={4}>
              {title}
            </Heading>
            <Flex gap={50} wrap>
              {showStateBadge &&
                taskStateBadge(state, pendingLabel !== undefined ? { pendingLabel } : undefined)}
              {state === 'overdue' && dueLabel !== null && <Badge status="error">{dueLabel}</Badge>}
              {state !== 'overdue' && dueState === 'DUE_SOON' && dueLabel !== null && (
                <Badge status="warn">{dueLabel}</Badge>
              )}
              {isUnassigned && <Badge status="warn">Sem responsável</Badge>}
              {extraBadges}
            </Flex>
          </Stack>
          {/* bloco de tempo — âncora tipográfica da linha de operação */}
          <Stack gap={0} align="end">
            <Text role="caption" tone="secondary">
              {timeCaption}
            </Text>
            <Text
              role="data"
              style={{
                fontSize: cssVar('emphasis-level2-size'),
                fontWeight: cssVar('emphasis-level2-weight'),
                lineHeight: 1,
              }}
            >
              {timePrimary}
            </Text>
          </Stack>
        </Flex>

        <Text role="data" tone="secondary">
          {meta}
        </Text>

        {requirementLabel !== null && (
          <Text role="caption" tone="secondary">
            {requirementLabel}
          </Text>
        )}

        {correctionReason !== null && (
          <Alert status="warning" title="Motivo da devolução">
            {correctionReason}
          </Alert>
        )}

        {syncLabel !== null && (
          <Text role="caption" tone="secondary">
            {syncLabel}
          </Text>
        )}

        {children}
        {action}
      </Stack>
    </Card>
  );
}
