// Tela Transformação — indicador ECONÔMICO dos subprodutos (não é quebra).
// O usuário edita pesos/preços dos subprodutos e o preço da carcaça de
// exportação; o indicador recalcula em tempo real (controller/domínio) e
// passa a ser o ajuste comercial da Estimativa. A tela só apresenta.

import { cssVar } from '@tauros/tokens';
import {
  Button,
  CurrencyInput,
  Divider,
  Field,
  Flex,
  NumberInput,
  PageHeader,
  Section,
  Stack,
  Surface,
  Text,
} from '@tauros/ui-primitives';
import type { ReactElement } from 'react';

import {
  DEFAULT_COMMERCIAL_ADJUSTMENT_PCT,
  SUBPRODUCT_KEYS,
  type SubproductKey,
} from '../domain/transformation.js';
import type { CalculatorController } from '../state/use-calculator.js';
import {
  formatBRL,
  formatKg,
  formatPct,
  formatPerKg,
  formatPoints,
  fromMinorUnits,
  toMinorUnits,
} from './format.js';

export interface TransformationScreenProps {
  readonly calc: CalculatorController;
  readonly onBack: () => void;
}

const SUBPRODUCT_LABELS: Record<SubproductKey, string> = {
  head: 'Cabeça',
  headTrim: 'Retalho da cabeça',
  lard: 'Banha',
  jowl: 'Papada',
  trotter: 'Mãozinha',
  ear: 'Orelha',
  tail: 'Rabinho',
};

function SummaryRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}): ReactElement {
  return (
    <Flex justify="between" gap={100}>
      <Stack gap={25}>
        <Text role="caption" tone="secondary">
          {label}
        </Text>
        {detail !== undefined && (
          <Text role="caption" tone="tertiary">
            {detail}
          </Text>
        )}
      </Stack>
      <Text role="data">{value}</Text>
    </Flex>
  );
}

export function TransformationScreen({ calc, onBack }: TransformationScreenProps): ReactElement {
  const { transformation, commercialAdjustmentPct } = calc;
  const { patchSubproduct, setExportCarcassPrice } = calc.actions;
  const valueByKey = Object.fromEntries(
    transformation.items.map((item) => [item.key, item.valueBRL]),
  );
  const differencePoints = commercialAdjustmentPct - DEFAULT_COMMERCIAL_ADJUSTMENT_PCT;

  return (
    <Stack gap={300}>
      <PageHeader
        title="Transformação"
        eyebrow="Subprodutos"
        description="Indicador econômico dos subprodutos em relação ao valor da carcaça de exportação."
        actions={
          <Button variant="ghost" size="sm" onClick={onBack}>
            Voltar
          </Button>
        }
      />

      <Section
        title="Subprodutos"
        description="Peso e preço de venda de cada item. O valor recalcula na hora."
      >
        <Stack gap={200}>
          {SUBPRODUCT_KEYS.map((key) => {
            const item = calc.state.transformation.subproducts[key];
            return (
              <Surface
                key={key}
                role="group"
                aria-label={SUBPRODUCT_LABELS[key]}
                elevation="flat"
                style={{ padding: cssVar('space-inset-md') }}
              >
                <Stack gap={100}>
                  <Flex justify="between" gap={100}>
                    <Text role="label">{SUBPRODUCT_LABELS[key]}</Text>
                    <Text role="data">{formatBRL(valueByKey[key] ?? 0)}</Text>
                  </Flex>
                  <Field label="Peso (kg)">
                    <NumberInput
                      size="lg"
                      endAdornment="kg"
                      value={item.weightKg}
                      onValueChange={(change) => {
                        patchSubproduct(key, { weightKg: change.value });
                      }}
                    />
                  </Field>
                  <Field label="Preço de venda (R$/kg)">
                    <CurrencyInput
                      size="lg"
                      valueInMinorUnits={toMinorUnits(item.pricePerKg)}
                      onValueChange={(change) => {
                        patchSubproduct(key, {
                          pricePerKg: fromMinorUnits(change.valueInMinorUnits),
                        });
                      }}
                    />
                  </Field>
                </Stack>
              </Surface>
            );
          })}
        </Stack>
      </Section>

      <Section
        title="Carcaça de exportação"
        description="Preço de referência usado para valorar a carcaça principal."
      >
        <Field label="Preço da carcaça de exportação (R$/kg)">
          <CurrencyInput
            size="lg"
            valueInMinorUnits={toMinorUnits(calc.state.transformation.exportCarcassPricePerKg)}
            onValueChange={(change) => {
              setExportCarcassPrice(fromMinorUnits(change.valueInMinorUnits));
            }}
          />
        </Field>
      </Section>

      <Section title="Resumo">
        <Surface elevation="flat" style={{ padding: cssVar('space-inset-md') }}>
          <Stack gap={100}>
            <SummaryRow
              label="Peso total dos subprodutos"
              value={formatKg(transformation.totalWeightKg)}
            />
            <SummaryRow
              label="Valor total dos subprodutos"
              value={formatBRL(transformation.totalValueBRL)}
            />
            <SummaryRow
              label="Preço da carcaça exportação"
              value={formatPerKg(calc.state.transformation.exportCarcassPricePerKg ?? 0)}
            />
            <SummaryRow
              label="Valor da carcaça exportação"
              value={formatBRL(transformation.exportCarcassValueBRL)}
            />
            <Divider />
            <SummaryRow
              label="Indicador econômico"
              detail="Aplicado na Estimativa"
              value={formatPct(commercialAdjustmentPct / 100)}
            />
            <SummaryRow
              label="Padrão histórico"
              value={formatPct(DEFAULT_COMMERCIAL_ADJUSTMENT_PCT / 100)}
            />
            <SummaryRow label="Diferença" value={formatPoints(differencePoints)} />
          </Stack>
        </Surface>
      </Section>
    </Stack>
  );
}
