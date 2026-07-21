// Foundation/Tokens — visualização dos tokens congelados (5.2-B) a partir da
// API pública de @tauros/tokens. Dados determinísticos, sem valores locais.

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { core, cssVar, lightTheme } from '@tauros/tokens';
import { Badge, Heading, Stack, Surface, Text } from '@tauros/ui-primitives';

const meta = {
  title: 'Foundation/Tokens',
  parameters: {
    docs: {
      description: {
        component:
          'Tokens congelados (Core → Semantic). A folha oficial consome exclusivamente CSS variables; nenhuma story define valores visuais próprios.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function Swatch({
  name,
  value,
}: {
  readonly name: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: cssVar('space-gap-100') }}>
      <span
        aria-hidden="true"
        style={{
          width: cssVar('space-gap-400'),
          height: cssVar('space-gap-400'),
          background: value,
          borderRadius: cssVar('radius-control'),
          border: `1px solid ${cssVar('color-border-default')}`,
          flexShrink: 0,
        }}
      />
      <Text role="data">{name}</Text>
      <Text role="data" tone="tertiary">
        {value}
      </Text>
    </div>
  );
}

export const Cores: Story = {
  render: () => (
    <Stack gap={300}>
      {(['neutral', 'brand', 'green', 'amber', 'red', 'blue'] as const).map((ramp) => (
        <Stack key={ramp} gap={100}>
          <Heading level={2} visualLevel={4}>
            {ramp}
          </Heading>
          {Object.entries(core.color[ramp]).map(([step, value]) => (
            <Swatch key={step} name={`${ramp}.${step}`} value={value} />
          ))}
        </Stack>
      ))}
    </Stack>
  ),
};

export const StatusMultidimensional: Story = {
  name: 'Status multidimensional (P5)',
  render: () => (
    <Stack gap={200}>
      <Text tone="secondary">Cada status combina cor + forma + rótulo — nunca somente cor.</Text>
      <Stack gap={100}>
        {(Object.keys(lightTheme.color.status) as (keyof typeof lightTheme.color.status)[]).map(
          (status) => (
            <div key={status} style={{ display: 'flex', gap: cssVar('space-gap-100') }}>
              <Badge status={status}>{status}</Badge>
              <Text role="data" tone="tertiary">
                forma: {lightTheme.color.status[status].shape} · ícone:{' '}
                {lightTheme.color.status[status].icon}
              </Text>
            </div>
          ),
        )}
      </Stack>
    </Stack>
  ),
};

export const EscalaTipografica: Story = {
  name: 'Escala tipográfica e ênfase',
  render: () => (
    <Stack gap={200}>
      {([1, 2, 3, 4, 5] as const).map((level) => (
        <Heading key={level} level={level}>
          Ênfase nível {level} — pesagem de dianteiro bovino
        </Heading>
      ))}
      <Text role="body">Body — texto operacional corrente.</Text>
      <Text role="label">Label — rótulos de controles.</Text>
      <Text role="data">Data — 128,450 kg (tabular)</Text>
      <Text role="caption" tone="secondary">
        Caption — metadados e apoio.
      </Text>
    </Stack>
  ),
};

export const EspacamentoEToque: Story = {
  name: 'Espaçamento e alvos de toque',
  render: () => (
    <Stack gap={200}>
      <Text tone="secondary">Grade de 4px; alvo mínimo glove-first = 64px (P4).</Text>
      {Object.entries(core.space).map(([step, value]) => (
        <div
          key={step}
          style={{ display: 'flex', alignItems: 'center', gap: cssVar('space-gap-100') }}
        >
          <span
            aria-hidden="true"
            style={{
              width: value,
              height: cssVar('space-gap-100'),
              background: cssVar('color-accent-default'),
            }}
          />
          <Text role="data" tone="tertiary">
            space.{step} = {value}
          </Text>
        </div>
      ))}
      <Surface elevation="flat" style={{ padding: cssVar('space-inset-md') }}>
        <Text role="data">touch: {JSON.stringify(core.touch)}</Text>
      </Surface>
    </Stack>
  ),
};

export const CamadasZ: Story = {
  name: 'Camadas (z-index)',
  render: () => (
    <Stack gap={100}>
      {Object.entries(core.z).map(([layer, value]) => (
        <Text key={layer} role="data">
          z.{layer} = {String(value)}
        </Text>
      ))}
      <Text tone="secondary">
        Política de overlays: backdrop=overlay · superfícies=dialog (ordem por montagem) ·
        toasts=toast.
      </Text>
    </Stack>
  ),
};
