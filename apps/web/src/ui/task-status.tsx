// Vocabulário visual ÚNICO de estado de tarefa (Frontend Experience V2).
// Os três quadros (/operacao, /encarregado, /turno/tarefas) apresentavam o
// MESMO estado de domínio com cores divergentes (PENDING era neutral num
// quadro e info noutro; OVERDUE era warn + um segundo badge error). Este
// módulo é a fonte única da representação: badge, régua e prioridade.
//
// Princípio (direção V2): NORMALIDADE É CALMA, EXCEÇÃO CHAMA ATENÇÃO.
// Pendente/concluída/adiada não competem por cor; atrasada/devolvida/sem
// responsável gritam. Nenhum estado de domínio novo é criado aqui — apenas
// representação (a cadeia task_templates → daily_tasks → task_executions
// permanece congelada).

'use client';

import type { ReactElement } from 'react';

import { cssVar } from '@tauros/tokens';
import { Badge } from '@tauros/ui-primitives';

/** Estados apresentáveis — união dos view models dos três quadros. */
export type TaskVisualState =
  | 'pending'
  | 'overdue'
  | 'in-progress'
  | 'awaiting-review'
  | 'needs-correction'
  | 'done'
  | 'skipped';

/**
 * Badge canônico do estado. `pendingLabel` preserva o vocabulário próprio do
 * quadro individual ("A fazer" — a lista pessoal fala com quem executa);
 * os quadros compartilhados usam "Pendente".
 */
export function taskStateBadge(
  state: TaskVisualState,
  options?: { readonly pendingLabel?: string },
): ReactElement {
  switch (state) {
    case 'done':
      return <Badge status="success">Concluída</Badge>;
    case 'skipped':
      return <Badge status="neutral">Adiada</Badge>;
    case 'in-progress':
      return <Badge status="info">Em execução</Badge>;
    case 'awaiting-review':
      return <Badge status="info">Aguardando conferência</Badge>;
    case 'needs-correction':
      return <Badge status="warn">Correção necessária</Badge>;
    case 'overdue':
      return <Badge status="error">Atrasada</Badge>;
    case 'pending':
      return <Badge status="neutral">{options?.pendingLabel ?? 'Pendente'}</Badge>;
  }
}

/**
 * Régua de estado do card (assinatura visual V2): cor semântica na borda
 * esquerda SÓ para exceções — quem precisa de gente age; o resto fica quieto.
 * null = sem régua (normalidade calma). Sempre acompanhada de texto/badge
 * (P5: nunca só cor).
 */
export function taskStateRail(state: TaskVisualState, isUnassigned = false): string | null {
  if (state === 'overdue') return cssVar('color-status-error-fg');
  if (state === 'needs-correction') return cssVar('color-status-warn-fg');
  if (isUnassigned && state === 'pending') return cssVar('color-status-warn-fg');
  if (state === 'awaiting-review') return cssVar('color-status-info-fg');
  return null;
}

/** Mapeia o DailyTaskStatus do domínio para o estado apresentável. */
export function visualStateFromStatus(status: string): TaskVisualState {
  switch (status) {
    case 'DONE':
      return 'done';
    case 'SKIPPED':
      return 'skipped';
    case 'IN_PROGRESS':
      return 'in-progress';
    case 'AWAITING_REVIEW':
      return 'awaiting-review';
    case 'NEEDS_CORRECTION':
      return 'needs-correction';
    case 'OVERDUE':
      return 'overdue';
    default:
      return 'pending';
  }
}
