// Linha "razão" — rótulo à esquerda, valor tabular à direita: o padrão único
// de apresentação de valor CALCULADO no app (resultado, resumo, indicador).
// Rótulo no tamanho de caption do DS (emphasis-level4, o mesmo de
// .t-field-desc) e valor no tamanho de dado: o número pesa mais que o texto
// auxiliar. value e detail são elementos separados (leitura por partes e
// testes exatos).

import { cssVar } from '@tauros/tokens';
import { Flex, Stack, Text } from '@tauros/ui-primitives';
import type { CSSProperties, ReactElement } from 'react';

export interface LedgerRowProps {
  readonly label: string;
  readonly value: string;
  /** Complemento do valor, na mesma linha (ex.: percentual ao lado do kg). */
  readonly detail?: string;
  /** Complemento do rótulo, abaixo dele. */
  readonly note?: string;
}

const CAPTION: CSSProperties = { fontSize: cssVar('emphasis-level4-size') };

export function LedgerRow({ label, value, detail, note }: LedgerRowProps): ReactElement {
  return (
    <Flex justify="between" align="baseline" gap={100}>
      <Stack gap={25}>
        <Text role="caption" tone="secondary" style={CAPTION}>
          {label}
        </Text>
        {note !== undefined && (
          <Text role="caption" tone="tertiary" style={CAPTION}>
            {note}
          </Text>
        )}
      </Stack>
      <Flex align="baseline" gap={50} style={{ flexShrink: 0 }}>
        <Text role="data">{value}</Text>
        {detail !== undefined && (
          <Text role="caption" tone="tertiary" style={CAPTION}>
            {detail}
          </Text>
        )}
      </Flex>
    </Flex>
  );
}
