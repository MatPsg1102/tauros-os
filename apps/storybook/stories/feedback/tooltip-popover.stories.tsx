// Feedback — Tooltip e Popover: validação VISUAL de posicionamento e colisão
// (risco registrado nas etapas 6.3.5/6.3.6 — geometria não observável em
// jsdom). Os cantos forçam flip/shift do adapter compartilhado.

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Button, Checkbox, Popover, Stack, Text, Tooltip } from '@tauros/ui-primitives';

const meta = {
  title: 'Feedback/Tooltip & Popover',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Tooltip = informação suplementar não interativa (hover com atraso tokenizado, foco imediato, Escape fecha). Popover = superfície contextual interativa não modal (foco entra e restaura ao trigger; não é Menu/Select). Ambos compartilham o adapter de posicionamento com flip/shift.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const ColisaoNosCantos: Story = {
  name: 'Colisão: cantos e bordas (flip/shift)',
  render: () => (
    <div
      style={{
        position: 'relative',
        height: '70vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        padding: 'var(--tauros-space-inset-md)',
      }}
    >
      <div style={{ justifySelf: 'start', alignSelf: 'start' }}>
        <Tooltip content="Flip para baixo perto do topo" placement="top">
          <Button variant="secondary">Topo-esquerda</Button>
        </Tooltip>
      </div>
      <div style={{ justifySelf: 'end', alignSelf: 'start' }}>
        <Tooltip
          content="Shift para dentro da viewport com conteúdo longo de exemplo"
          placement="right"
        >
          <Button variant="secondary">Topo-direita</Button>
        </Tooltip>
      </div>
      <div style={{ justifySelf: 'start', alignSelf: 'end' }}>
        <Popover triggerLabel="Inferior-esquerda" placement="left">
          <Stack gap={100}>
            <Text>Popover interativo com colisão à esquerda.</Text>
            <Checkbox label="Opção contextual" />
          </Stack>
        </Popover>
      </div>
      <div style={{ justifySelf: 'end', alignSelf: 'end' }}>
        <Popover triggerLabel="Inferior-direita" placement="bottom">
          <Stack gap={100}>
            <Text>Perto da base: o adapter faz flip para cima.</Text>
            <Button size="sm">Ação interna</Button>
          </Stack>
        </Popover>
      </div>
    </div>
  ),
};

export const ContainerEstreito: Story = {
  name: 'Container estreito + conteúdo longo',
  render: () => (
    <div style={{ maxWidth: '30ch', margin: 'var(--tauros-space-inset-lg)' }}>
      <Stack gap={200}>
        <Tooltip content="Peso líquido apurado na balança 02 após o desconto de embalagem">
          <Button variant="secondary" fullWidth>
            Tooltip com texto longo
          </Button>
        </Tooltip>
        <Popover triggerLabel="Filtros do relatório">
          <Stack gap={100}>
            <Checkbox label="Somente ativos" defaultChecked />
            <Checkbox label="Incluir perdas registradas no período selecionado" />
            <Button size="sm">Aplicar filtros</Button>
          </Stack>
        </Popover>
      </Stack>
    </div>
  ),
};
