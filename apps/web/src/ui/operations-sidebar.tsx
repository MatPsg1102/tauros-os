// Sidebar da OPERAÇÃO DE HOJE — ferramenta de TRIAGEM (UI Operacional V1.1):
// "onde está o problema? quem tem pendência? o que está prestes a atrasar?".
// Agrupa pela dimensão REAL do domínio (posição operacional responsável —
// não existe entidade "área"; lacuna registrada na rastreabilidade) e pela
// presença PLANEJADA do dia (Escala V1 — nunca o cadastro inteiro).
// Apresentacional: só compõe o DS; filtros são leitura pura (sem fila/audit).

'use client';

import type { ReactElement } from 'react';

import { Badge, NavigationGroup, NavigationItem, Sidebar, Text } from '@tauros/ui-primitives';

import type {
  SharedOperationsActions,
  SharedOperationsView,
  TeamMemberSummary,
} from '../controllers/use-shared-operations.js';

function plural(count: number, singular: string, pluralForm: string): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

/** Resumo compacto do colaborador — no máximo dois números úteis (§7). */
function memberBadge(member: TeamMemberSummary): ReactElement {
  if (member.overdueCount > 0) {
    return (
      <Badge status="error">
        {plural(member.overdueCount, 'atrasada', 'atrasadas')}
        {member.openCount > member.overdueCount
          ? ` · ${plural(member.openCount, 'aberta', 'abertas')}`
          : ''}
      </Badge>
    );
  }
  if (member.openCount > 0) {
    return <Badge status="neutral">{plural(member.openCount, 'aberta', 'abertas')}</Badge>;
  }
  if (member.awaitingReviewCount > 0) {
    return (
      <Badge status="info">
        {plural(member.awaitingReviewCount, 'em conferência', 'em conferência')}
      </Badge>
    );
  }
  return <Badge status="success">Em dia</Badge>;
}

export interface OperationsSidebarProps {
  readonly view: SharedOperationsView;
  readonly actions: SharedOperationsActions;
  /** Chamado após aplicar um filtro (mobile: fecha o Drawer). */
  readonly onNavigate?: () => void;
}

/**
 * Seções de triagem — reutilizadas pela Sidebar persistente (tablet/desktop)
 * e pelo Drawer móvel. Toque em item ATIVO remove o próprio filtro.
 */
export function OperationsSidebarSections({
  view,
  actions,
  onNavigate,
}: OperationsSidebarProps): ReactElement {
  const done = (): void => {
    onNavigate?.();
  };
  return (
    <>
      <NavigationGroup title="Situação">
        <NavigationItem
          label="Atrasadas"
          active={view.dueFilter === 'overdue'}
          badge={
            view.counts.late > 0 ? <Badge status="error">{view.counts.late}</Badge> : undefined
          }
          onSelect={() => {
            actions.setDueFilter(view.dueFilter === 'overdue' ? null : 'overdue');
            done();
          }}
        />
        <NavigationItem
          label="Próximas do prazo"
          active={view.dueFilter === 'due-soon'}
          badge={
            view.counts.dueSoon > 0 ? <Badge status="warn">{view.counts.dueSoon}</Badge> : undefined
          }
          onSelect={() => {
            actions.setDueFilter(view.dueFilter === 'due-soon' ? null : 'due-soon');
            done();
          }}
        />
        <NavigationItem
          label="Conferir"
          active={view.filter === 'review'}
          badge={
            view.counts.awaitingReview > 0 ? (
              <Badge status="info">{view.counts.awaitingReview}</Badge>
            ) : undefined
          }
          onSelect={() => {
            actions.setFilter(view.filter === 'review' ? 'all' : 'review');
            done();
          }}
        />
      </NavigationGroup>

      <NavigationGroup title="Posições">
        <NavigationItem
          label="Todas"
          active={view.assignmentFilter === null}
          badge={<Badge status="neutral">{view.counts.open}</Badge>}
          onSelect={() => {
            actions.setAssignmentFilter(null);
            done();
          }}
        />
        {view.positionSummaries.map((position) => (
          <NavigationItem
            key={position.positionId}
            label={position.name}
            active={
              view.assignmentFilter?.kind === 'position' &&
              view.assignmentFilter.positionId === position.positionId
            }
            badge={
              position.overdueCount > 0 ? (
                <Badge status="error">{`${String(position.openCount)} · ${String(position.overdueCount)} atras.`}</Badge>
              ) : (
                <Badge status="neutral">{position.openCount}</Badge>
              )
            }
            onSelect={() => {
              const isActive =
                view.assignmentFilter?.kind === 'position' &&
                view.assignmentFilter.positionId === position.positionId;
              actions.setAssignmentFilter(
                isActive ? null : { kind: 'position', positionId: position.positionId },
              );
              done();
            }}
          />
        ))}
        <NavigationItem
          label="Sem responsável"
          active={view.assignmentFilter?.kind === 'unassigned'}
          badge={
            view.unassignedCount > 0 ? (
              <Badge status="warn">{view.unassignedCount}</Badge>
            ) : undefined
          }
          onSelect={() => {
            actions.setAssignmentFilter(
              view.assignmentFilter?.kind === 'unassigned' ? null : { kind: 'unassigned' },
            );
            done();
          }}
        />
      </NavigationGroup>

      <NavigationGroup title="Equipe de hoje">
        {view.scheduleStatus === 'unconfigured' ? (
          <li>
            <Text tone="secondary">Sem escala configurada para esta data.</Text>
          </li>
        ) : view.teamToday.length === 0 ? (
          <li>
            <Text tone="secondary">Ninguém escalado para hoje.</Text>
          </li>
        ) : (
          view.teamToday.map((member) => (
            <NavigationItem
              key={member.employeeId}
              label={member.name}
              {...(member.positionName !== null
                ? {
                    description:
                      member.workPeriodLabel !== null
                        ? `${member.positionName} · ${member.workPeriodLabel}`
                        : member.positionName,
                  }
                : member.workPeriodLabel !== null
                  ? { description: member.workPeriodLabel }
                  : {})}
              active={view.employeeFilter === member.employeeId}
              badge={memberBadge(member)}
              onSelect={() => {
                actions.setEmployeeFilter(
                  view.employeeFilter === member.employeeId ? null : member.employeeId,
                );
                done();
              }}
            />
          ))
        )}
      </NavigationGroup>
    </>
  );
}

/** Sidebar persistente (tablet/desktop) — some no mobile via CSS do DS. */
export function OperationsSidebar({ view, actions }: OperationsSidebarProps): ReactElement {
  return (
    <Sidebar label="Triagem da operação">
      <OperationsSidebarSections view={view} actions={actions} />
    </Sidebar>
  );
}
