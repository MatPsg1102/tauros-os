// Sidebar da OPERAÇÃO DE HOJE — ferramenta de TRIAGEM (UI Operacional V1.1):
// "onde está o problema? quem tem pendência? o que está prestes a atrasar?".
// Agrupa pela dimensão REAL do domínio (posição operacional responsável —
// não existe entidade "área"; lacuna registrada na rastreabilidade) e pela
// presença PLANEJADA do dia (Escala V1 — nunca o cadastro inteiro).
// Apresentacional: só compõe o DS; filtros são leitura pura (sem fila/audit).
//
// UX V1.2 — ADAPTATIVA: desktop (hover real) inicia RECOLHIDA como rail de
// sinais operacionais; aproximar expande (overlay, sem empurrar o quadro);
// "Fixar aberta" torna persistente. Touch (sem hover) abre por toque via
// Drawer do DS. Mobile (<768px) segue com o Drawer da tela. Estado é
// EFÊMERO de apresentação — nunca fila/auditoria/dado de negócio.

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cssVar } from '@tauros/tokens';
import {
  Badge,
  Button,
  Drawer,
  NavigationGroup,
  NavigationItem,
  Sidebar,
  Text,
} from '@tauros/ui-primitives';

import {
  usePointerMode,
  usePrefersReducedMotion,
} from '../controllers/use-interaction-capabilities.js';
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
        <NavigationItem
          label="Devolvidas"
          active={view.filter === 'returned'}
          badge={
            view.counts.needsCorrection > 0 ? (
              <Badge status="warn">{view.counts.needsCorrection}</Badge>
            ) : undefined
          }
          onSelect={() => {
            actions.setFilter(view.filter === 'returned' ? 'all' : 'returned');
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

/** Evita fechar sem querer ao cruzar o ponteiro entre sidebar e conteúdo. */
const HOVER_COLLAPSE_DELAY_MS = 300;

/** Estados efêmeros de apresentação (desktop): rail → overlay → fixada. */
type PanelMode = 'collapsed' | 'temporary' | 'pinned';

/** Sinal da rail: quantidade quando relevante; glifo discreto quando zero. */
function railGlyph(count: number, status: 'error' | 'warn' | 'info', glyph: string): ReactElement {
  if (count > 0) return <Badge status={status}>{count}</Badge>;
  return <span>{glyph}</span>;
}

/**
 * Painel temporário SOBRE o conteúdo (fixed: escapa do overflow do shell sem
 * tocar o DS) — evita deslocamento brusco do quadro a cada hover (§12).
 */
function TemporaryPanelShell({
  anchor,
  reducedMotion,
  children,
}: {
  readonly anchor: { readonly top: number; readonly left: number };
  readonly reducedMotion: boolean;
  readonly children: ReactNode;
}): ReactElement {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setEntered(true);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, []);
  const motion: CSSProperties = reducedMotion
    ? {}
    : {
        transition: `transform ${cssVar('motion-enter-duration')} ${cssVar('motion-enter-easing')}, opacity ${cssVar('motion-enter-duration')} ${cssVar('motion-enter-easing')}`,
        transform: entered ? 'none' : 'translateX(-8px)',
        opacity: entered ? 1 : 0,
      };
  return (
    <div
      style={{
        position: 'fixed',
        top: anchor.top,
        left: anchor.left,
        bottom: 0,
        // mesma largura máxima do .t-sidebar expandido do DS
        width: '30ch',
        maxWidth: '85vw',
        zIndex: cssVar('z-overlay'),
        background: cssVar('color-surface-raised'),
        borderRight: `1px solid ${cssVar('color-border-default')}`,
        boxShadow: cssVar('elevation-sheet'),
        overflowY: 'auto',
        ...motion,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Sidebar ADAPTATIVA (UX V1.2). Desktop/hover: COLLAPSED (rail) →
 * EXPANDED_TEMPORARY (overlay por aproximação/teclado) → PINNED (in-flow).
 * Touch: rail → Drawer do DS (toque fora/ESC/foco por conta do primitive).
 * Recolhida, a situação operacional continua visível: badges na rail + a
 * região de alertas acima do quadro (§6). Nada aqui abre sozinho por
 * mudança de prazo (§7) — só gesto do usuário.
 */
export function OperationsSidebar({ view, actions }: OperationsSidebarProps): ReactElement {
  const pointerMode = usePointerMode();
  const reducedMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState<PanelMode>('collapsed');
  const [touchOpen, setTouchOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });

  const cancelScheduledCollapse = useCallback(() => {
    if (collapseTimer.current !== null) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const scheduleCollapse = useCallback(() => {
    cancelScheduledCollapse();
    collapseTimer.current = setTimeout(() => {
      collapseTimer.current = null;
      setMode((current) => (current === 'temporary' ? 'collapsed' : current));
    }, HOVER_COLLAPSE_DELAY_MS);
  }, [cancelScheduledCollapse]);

  useEffect(() => cancelScheduledCollapse, [cancelScheduledCollapse]);

  const openPanel = useCallback(() => {
    if (pointerMode === 'touch') {
      setTouchOpen(true);
      return;
    }
    cancelScheduledCollapse();
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect !== undefined) setAnchor({ top: rect.top, left: rect.left });
    setMode((current) => (current === 'pinned' ? current : 'temporary'));
  }, [cancelScheduledCollapse, pointerMode]);

  const collapseTemporary = useCallback(() => {
    cancelScheduledCollapse();
    setMode((current) => (current === 'temporary' ? 'collapsed' : current));
  }, [cancelScheduledCollapse]);

  const rail = (
    <Sidebar
      label="Triagem da operação"
      collapsed
      toggleLabel="Abrir painel operacional"
      onCollapsedChange={(next) => {
        if (!next) openPanel();
      }}
    >
      <NavigationItem
        label={`Atrasadas (${String(view.counts.late)})`}
        icon={railGlyph(view.counts.late, 'error', '🔴')}
        onSelect={openPanel}
      />
      <NavigationItem
        label={`Próximas do prazo (${String(view.counts.dueSoon)})`}
        icon={railGlyph(view.counts.dueSoon, 'warn', '⚠')}
        onSelect={openPanel}
      />
      <NavigationItem
        label={`Conferir (${String(view.counts.awaitingReview)})`}
        icon={railGlyph(view.counts.awaitingReview, 'info', '✓')}
        onSelect={openPanel}
      />
      <NavigationItem
        label={`Devolvidas (${String(view.counts.needsCorrection)})`}
        icon={railGlyph(view.counts.needsCorrection, 'warn', '↩')}
        onSelect={openPanel}
      />
      <NavigationItem
        label={`Equipe de hoje (${String(view.teamToday.length)})`}
        icon={<span>👥</span>}
        onSelect={openPanel}
      />
      <NavigationItem label="Filtros" icon={<span>🔍</span>} onSelect={openPanel} />
    </Sidebar>
  );

  const panel = (
    <Sidebar
      label="Triagem da operação"
      toggleLabel="Fechar painel operacional"
      onCollapsedChange={(next) => {
        if (next) collapseTemporary();
      }}
      header={
        <Button
          variant="ghost"
          onClick={() => {
            cancelScheduledCollapse();
            setMode(mode === 'pinned' ? 'collapsed' : 'pinned');
          }}
        >
          {mode === 'pinned' ? 'Recolher' : 'Fixar aberta'}
        </Button>
      }
    >
      <OperationsSidebarSections
        view={view}
        actions={actions}
        // §9: selecionar filtro recolhe SÓ quando não está fixada
        {...(mode === 'temporary' ? { onNavigate: collapseTemporary } : {})}
      />
    </Sidebar>
  );

  return (
    <div
      ref={wrapperRef}
      data-operations-sidebar
      data-panel-mode={pointerMode === 'touch' ? (touchOpen ? 'touch-open' : 'touch-rail') : mode}
      style={{ display: 'flex', minHeight: 0 }}
      // eventos LOCALIZADOS no shell da sidebar — nunca onMouseMove global (§10)
      onMouseEnter={
        pointerMode === 'hover'
          ? () => {
              cancelScheduledCollapse();
              openPanel();
            }
          : undefined
      }
      onMouseLeave={pointerMode === 'hover' ? scheduleCollapse : undefined}
      // teclado: painel não some enquanto o foco estiver dentro dele (§14)
      onFocus={cancelScheduledCollapse}
      onBlur={(event) => {
        if (pointerMode !== 'hover') return;
        const next = event.relatedTarget as Node | null;
        if (next === null || !event.currentTarget.contains(next)) scheduleCollapse();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || mode !== 'temporary') return;
        collapseTemporary();
        // devolve o foco ao gatilho da rail após fechar o overlay
        requestAnimationFrame(() => {
          wrapperRef.current?.querySelector('button')?.focus();
        });
      }}
    >
      {pointerMode === 'touch' ? (
        <>
          {/* rail some da árvore de acessibilidade enquanto o Drawer cobre */}
          <div style={{ visibility: touchOpen ? 'hidden' : 'visible' }}>{rail}</div>
          <Drawer
            open={touchOpen}
            side="left"
            title="Filtros e equipe"
            description="Toque para filtrar o quadro por situação, posição ou colaborador"
            closeLabel="Fechar"
            onOpenChange={(isOpen) => {
              if (!isOpen) setTouchOpen(false);
            }}
          >
            <Sidebar label="Triagem da operação">
              <OperationsSidebarSections
                view={view}
                actions={actions}
                onNavigate={() => setTouchOpen(false)}
              />
            </Sidebar>
          </Drawer>
        </>
      ) : mode === 'pinned' ? (
        panel
      ) : (
        <>
          <div style={{ visibility: mode === 'temporary' ? 'hidden' : 'visible' }}>{rail}</div>
          {mode === 'temporary' && (
            <TemporaryPanelShell anchor={anchor} reducedMotion={reducedMotion}>
              {panel}
            </TemporaryPanelShell>
          )}
        </>
      )}
    </div>
  );
}
