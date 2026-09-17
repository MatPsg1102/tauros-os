// Tela de histórico — lotes salvos manualmente na calculadora e análises de
// desossa salvas na tela Desossa (listas separadas: são registros de
// naturezas diferentes). Tocar em "Abrir" restaura o snapshot completo.
// Exclusão é irreversível: sempre passa pelo ConfirmDialog (destrutivo).

import {
  Badge,
  Button,
  ConfirmDialog,
  Flex,
  Section,
  Stack,
  Surface,
  Text,
} from '@tauros/ui-primitives';
import { cssVar } from '@tauros/tokens';
import { useState, type CSSProperties, type ReactElement } from 'react';

import { deboningStatisticLabel } from '../domain/deboning.js';
import type { DeboningHistoryEntry, HistoryEntry } from '../state/model.js';
import type { CalculatorController } from '../state/use-calculator.js';
import {
  formatBRL,
  formatDate,
  formatDateTime,
  formatKg,
  formatPct,
  formatPerKg,
} from './format.js';
import { ScreenHeader } from './screen-header.js';

export interface HistoryScreenProps {
  readonly calc: CalculatorController;
  readonly onBack: () => void;
  /** Chamado após restaurar um lote (a tela volta para a calculadora). */
  readonly onOpenEntry: (id: string) => void;
  /** Chamado após restaurar uma desossa (a tela vai para a Desossa). */
  readonly onOpenDeboningEntry: (id: string) => void;
}

type PendingDelete =
  | { readonly kind: 'lot'; readonly entry: HistoryEntry }
  | { readonly kind: 'deboning'; readonly entry: DeboningHistoryEntry };

const HEADLINE: CSSProperties = {
  fontSize: cssVar('emphasis-level2-size'),
  fontWeight: cssVar('emphasis-level2-weight'),
};

export function HistoryScreen({
  calc,
  onBack,
  onOpenEntry,
  onOpenDeboningEntry,
}: HistoryScreenProps): ReactElement {
  const { history, deboningHistory, historySource, cloudError } = calc;
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  return (
    <Stack gap={200}>
      <ScreenHeader title="Histórico" onBack={onBack} />

      <Section title="Lotes">
        <Stack gap={100}>
          <Flex justify="between" align="center" gap={100}>
            {historySource === 'cloud' ? (
              <Badge status="info">NA NUVEM</Badge>
            ) : (
              <Badge status="neutral">NESTE APARELHO</Badge>
            )}
          </Flex>
          <div role="alert">{cloudError !== null && <Text role="caption">{cloudError}</Text>}</div>
          {history.length === 0 ? (
            <Surface elevation="card" style={{ padding: cssVar('space-inset-md') }}>
              <Stack gap={50}>
                <Text role="label">Nenhum lote salvo ainda.</Text>
                <Text role="caption" tone="secondary">
                  Use “Salvar lote no histórico” na calculadora para registrar um lote.
                </Text>
              </Stack>
            </Surface>
          ) : (
            history.map((entry) => (
              <Surface
                as="article"
                key={entry.id}
                aria-label={`Lote de ${formatDateTime(entry.savedAt)}`}
                elevation="card"
                style={{ padding: cssVar('space-inset-md') }}
              >
                <Stack gap={50}>
                  <Flex justify="between" align="center" gap={100}>
                    <Text role="label">{formatDateTime(entry.savedAt)}</Text>
                    {entry.mode === 'real' ? (
                      <Badge status="info">LOTE REAL</Badge>
                    ) : (
                      <Badge status="neutral">ESTIMATIVA</Badge>
                    )}
                  </Flex>
                  <Text role="data" style={HEADLINE}>
                    {entry.summary.costPerKg === null ? '—' : formatPerKg(entry.summary.costPerKg)}
                  </Text>
                  <Text role="caption" tone="secondary">
                    {[
                      entry.summary.animals === null ? null : `${entry.summary.animals} suínos`,
                      entry.summary.referenceWeightKg === null
                        ? null
                        : formatKg(entry.summary.referenceWeightKg),
                      entry.summary.finalWeightKg === null
                        ? null
                        : `→ ${formatKg(entry.summary.finalWeightKg)}`,
                      entry.summary.livePricePerKg === null
                        ? null
                        : `vivo ${formatBRL(entry.summary.livePricePerKg)}/kg`,
                    ]
                      .filter((part) => part !== null)
                      .join(' · ')}
                  </Text>
                  <Flex gap={100} wrap>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        calc.actions.loadHistoryEntry(entry.id);
                        onOpenEntry(entry.id);
                      }}
                    >
                      Abrir este lote
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setPendingDelete({ kind: 'lot', entry });
                      }}
                    >
                      Excluir
                    </Button>
                  </Flex>
                </Stack>
              </Surface>
            ))
          )}
        </Stack>
      </Section>

      {deboningHistory.length > 0 && (
        <Section title="Desossas">
          <Stack gap={100}>
            {deboningHistory.map((entry) => (
              <Surface
                as="article"
                key={entry.id}
                aria-label={`Desossa de ${formatDateTime(entry.savedAt)}`}
                elevation="card"
                style={{ padding: cssVar('space-inset-md') }}
              >
                <Stack gap={50}>
                  <Flex justify="between" align="center" gap={100}>
                    <Text role="label">
                      {entry.name.trim().length > 0
                        ? entry.name
                        : `Desossa de ${formatDateTime(entry.savedAt)}`}
                    </Text>
                    <Badge status="success">DESOSSA</Badge>
                  </Flex>
                  {/* Data (sem hora) e, quando houver, a estatística de pesos usada. */}
                  <Text role="caption" tone="secondary">
                    {[
                      formatDate(entry.savedAt),
                      entry.deboning.statistic === null
                        ? null
                        : deboningStatisticLabel(entry.deboning.statistic),
                    ]
                      .filter((part) => part !== null)
                      .join(' · ')}
                  </Text>
                  <Text role="data" style={HEADLINE}>
                    {entry.summary.marginPct === null
                      ? '—'
                      : formatPct(entry.summary.marginPct / 100)}
                  </Text>
                  <Text role="caption" tone="secondary">
                    {[
                      entry.summary.carcassWeightKg === null
                        ? null
                        : `carcaça ${formatKg(entry.summary.carcassWeightKg)}`,
                      entry.summary.carcassValueBRL === null
                        ? null
                        : formatBRL(entry.summary.carcassValueBRL),
                      entry.summary.commercialValueBRL === null
                        ? null
                        : `→ ${formatBRL(entry.summary.commercialValueBRL)}`,
                      `${entry.summary.productCount} produtos`,
                    ]
                      .filter((part) => part !== null)
                      .join(' · ')}
                  </Text>
                  <Flex gap={100} wrap>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        calc.actions.loadDeboningEntry(entry.id);
                        onOpenDeboningEntry(entry.id);
                      }}
                    >
                      Abrir esta desossa
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setPendingDelete({ kind: 'deboning', entry });
                      }}
                    >
                      Excluir análise
                    </Button>
                  </Flex>
                </Stack>
              </Surface>
            ))}
          </Stack>
        </Section>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === 'deboning' ? 'Excluir desossa salva?' : 'Excluir lote salvo?'
        }
        {...(pendingDelete !== null
          ? {
              description: `${pendingDelete.kind === 'deboning' ? 'A desossa' : 'O lote'} de ${formatDateTime(pendingDelete.entry.savedAt)} será apagad${pendingDelete.kind === 'deboning' ? 'a' : 'o'}. Isso não pode ser desfeito.`,
            }
          : {})}
        destructive
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (pendingDelete?.kind === 'lot')
            calc.actions.removeHistoryEntry(pendingDelete.entry.id);
          if (pendingDelete?.kind === 'deboning') {
            calc.actions.removeDeboningEntry(pendingDelete.entry.id);
          }
          setPendingDelete(null);
        }}
      />
    </Stack>
  );
}
