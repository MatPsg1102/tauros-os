// ATTENTION STRIP (Frontend Experience V2) — a região de exceção do cockpit:
// um único lugar acionável para "onde está o problema?". Funde os antigos
// DueAlerts (chips) e o Card de contadores em texto corrido: cada tile é um
// Chip glove-first que FILTRA o quadro ao toque (leitura pura — nenhum
// contador é calculado aqui; tudo chega pronto do view model).
//
// Exceção > normalidade: tile zerado NÃO aparece; sem exceção alguma, a
// faixa inteira some e o quadro respira. Número forte + rótulo por extenso
// (nunca só cor/ícone — P5).

'use client';

import type { ReactElement } from 'react';

import { Chip, Flex, Text } from '@tauros/ui-primitives';

export interface AttentionTile {
  readonly key: string;
  readonly count: number;
  /** Rótulo por extenso já flexionado ("tarefa atrasada"/"tarefas atrasadas"). */
  readonly label: string;
  readonly selected: boolean;
  readonly onToggle: () => void;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

export function AttentionStrip({
  tiles,
  groupLabel,
}: {
  readonly tiles: readonly AttentionTile[];
  readonly groupLabel: string;
}): ReactElement | null {
  const visible = tiles.filter((tile) => tile.count > 0);
  if (visible.length === 0) return null;
  return (
    <Flex gap={100} wrap role="group" aria-label={groupLabel}>
      {visible.map((tile) => (
        <Chip key={tile.key} selected={tile.selected} onClick={tile.onToggle}>
          {/* número em role=data (peso/mono) + rótulo por extenso no mesmo
              nome acessível: "3 tarefas atrasadas" */}
          <Text role="data">{String(tile.count)}</Text>
          {` ${tile.label}`}
        </Chip>
      ))}
    </Flex>
  );
}
