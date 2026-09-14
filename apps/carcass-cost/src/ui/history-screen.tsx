// Tela de histórico — lotes salvos manualmente na calculadora. Tocar em
// "Abrir este lote" restaura o snapshot completo (modo, pesos e custos).
// Exclusão é irreversível: sempre passa pelo ConfirmDialog (destrutivo).

import { Badge, Button, ConfirmDialog, Flex, Stack, Surface, Text } from '@tauros/ui-primitives';
import { cssVar } from '@tauros/tokens';
import { useState, type ReactElement } from 'react';

import type { HistoryEntry } from '../state/model.js';
import type { CalculatorController } from '../state/use-calculator.js';
import { formatBRL, formatDateTime, formatKg, formatPerKg } from './format.js';
import { ScreenHeader } from './screen-header.js';

export interface HistoryScreenProps {
  readonly calc: CalculatorController;
  readonly onBack: () => void;
  /** Chamado após restaurar um lote (a tela volta para a calculadora). */
  readonly onOpenEntry: (id: string) => void;
}

export function HistoryScreen({ calc, onBack, onOpenEntry }: HistoryScreenProps): ReactElement {
  const { history } = calc;
  const [pendingDelete, setPendingDelete] = useState<HistoryEntry | null>(null);

  return (
    <Stack gap={200}>
      <ScreenHeader title="Histórico" onBack={onBack} />

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
              <Text
                role="data"
                style={{
                  fontSize: cssVar('emphasis-level2-size'),
                  fontWeight: cssVar('emphasis-level2-weight'),
                }}
              >
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
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPendingDelete(entry);
                  }}
                >
                  Excluir
                </Button>
              </Flex>
            </Stack>
          </Surface>
        ))
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Excluir lote salvo?"
        {...(pendingDelete !== null
          ? {
              description: `O lote de ${formatDateTime(pendingDelete.savedAt)} será apagado. Isso não pode ser desfeito.`,
            }
          : {})}
        destructive
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (pendingDelete !== null) calc.actions.removeHistoryEntry(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </Stack>
  );
}
