// Tela Transformação — INDICADOR ECONÔMICO DE TRANSFORMAÇÃO. O usuário edita
// pesos/preços dos subprodutos e o preço da carcaça de exportação; a perda
// econômica (valor teórico pelo preço da carcaça − valor recuperado) sobre o
// valor da carcaça recalcula em tempo real e vira o ajuste comercial da
// Estimativa. A tela só apresenta.

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

import { SUBPRODUCT_KEYS, type SubproductKey } from '../domain/transformation.js';
import type { CalculatorController } from '../state/use-calculator.js';
import {
  formatBRL,
  formatKg,
  formatPct,
  formatPerKg,
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
  const { transformation } = calc;
  const { patchSubproduct, setExportCarcassPrice } = calc.actions;
  const recoveredByKey = Object.fromEntries(
    transformation.items.map((item) => [item.key, item.recoveredBRL]),
  );

  return (
    <Stack gap={300}>
      <PageHeader
        title="Transformação"
        eyebrow="Subprodutos"
        description="Impacto econômico dos subprodutos que vêm no suíno mineiro mas não na carcaça de exportação: quanto se perde por vendê-los abaixo do preço da carcaça."
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
                    <Text role="data">{formatBRL(recoveredByKey[key] ?? 0)}</Text>
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
              label="Valor recuperado dos subprodutos"
              value={formatBRL(transformation.totalRecoveredBRL)}
            />
            <SummaryRow
              label="Preço da carcaça de exportação"
              value={formatPerKg(calc.state.transformation.exportCarcassPricePerKg ?? 0)}
            />
            <SummaryRow
              label="Valor teórico pelo preço da carcaça"
              value={formatBRL(transformation.theoreticalValueBRL)}
            />
            <SummaryRow
              label="Valor da carcaça de exportação"
              value={formatBRL(transformation.exportCarcassValueBRL)}
            />
            <SummaryRow
              label="Perda econômica da transformação"
              value={formatBRL(transformation.economicLossBRL)}
            />
            <Divider />
            <SummaryRow
              label="Indicador econômico de transformação"
              detail="Aplicado como ajuste comercial na Estimativa"
              value={
                transformation.indicatorPct === null
                  ? '—'
                  : formatPct(transformation.indicatorPct / 100)
              }
            />
          </Stack>
        </Surface>
      </Section>
    </Stack>
  );
}
