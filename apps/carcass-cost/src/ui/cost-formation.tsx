// Formação de um valor — sequência visual "parcela → subtotal → total" com
// os valores JÁ calculados pelo domínio (nenhuma conta aqui). A coluna de
// sinal à esquerda (+ / − / =) diz a operação; uma nota curta diz a origem de
// cada parcela; linhas "=" recebem um traço acima, como numa conta armada.
// Usada na formação do custo por kg (Estimativa/Lote Real) e na formação do
// valor comercial da Desossa.

import { cssVar } from '@tauros/tokens';
import { Divider, Flex, Stack, Text } from '@tauros/ui-primitives';
import { Fragment, type CSSProperties, type ReactElement } from 'react';

export type FormationKind = 'start' | 'add' | 'subtract' | 'subtotal' | 'total';

export interface FormationStep {
  readonly kind: FormationKind;
  readonly label: string;
  readonly value: string;
  /** Origem da parcela (ex.: "R$ 5.980,00 ÷ 10.237,01 kg"). */
  readonly note?: string;
}

export interface CostFormationProps {
  readonly label: string;
  readonly steps: readonly FormationStep[];
}

const SIGNS: Record<FormationKind, string> = {
  start: '',
  add: '+',
  subtract: '−',
  subtotal: '=',
  total: '=',
};
const CAPTION: CSSProperties = { fontSize: cssVar('emphasis-level4-size') };
const SIGN: CSSProperties = { width: cssVar('space-gap-300'), flexShrink: 0, textAlign: 'center' };
const VALUE: CSSProperties = { flexShrink: 0 };
const TOTAL_VALUE: CSSProperties = {
  flexShrink: 0,
  fontSize: cssVar('emphasis-level2-size'),
  fontWeight: cssVar('emphasis-level2-weight'),
};

function FormationRow({ step }: { readonly step: FormationStep }): ReactElement {
  const strong = step.kind === 'subtotal' || step.kind === 'total';
  return (
    <Flex align="baseline" gap={100}>
      <Text role="data" tone="tertiary" style={SIGN} aria-hidden="true">
        {SIGNS[step.kind]}
      </Text>
      <Stack gap={25} style={{ flex: 1, minWidth: 0 }}>
        <Text
          role={strong ? 'label' : 'caption'}
          tone={strong ? 'primary' : 'secondary'}
          style={strong ? undefined : CAPTION}
        >
          {step.label}
        </Text>
        {step.note !== undefined && (
          <Text role="caption" tone="tertiary" style={CAPTION}>
            {step.note}
          </Text>
        )}
      </Stack>
      <Text
        role="data"
        tone={step.kind === 'add' || step.kind === 'subtract' ? 'secondary' : 'primary'}
        style={step.kind === 'total' ? TOTAL_VALUE : VALUE}
      >
        {step.value}
      </Text>
    </Flex>
  );
}

export function CostFormation({ label, steps }: CostFormationProps): ReactElement {
  return (
    <Stack gap={50} role="group" aria-label={label}>
      {steps.map((step, index) => (
        <Fragment key={`${step.kind}-${index}`}>
          {(step.kind === 'subtotal' || step.kind === 'total') && <Divider />}
          <FormationRow step={step} />
        </Fragment>
      ))}
    </Stack>
  );
}
