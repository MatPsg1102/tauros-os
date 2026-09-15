// Tela Transformação — INDICADOR ECONÔMICO DE TRANSFORMAÇÃO. Resultado no
// topo (mesma regra da calculadora), depois os 7 subprodutos em linhas
// compactas (nome + valor recuperado; peso e preço lado a lado), o preço da
// carcaça e uma barra fixa com o indicador para acompanhar enquanto se edita
// as últimas linhas. A tela só apresenta: perda econômica e indicador vêm do
// domínio via controller e viram o ajuste comercial da Estimativa.

import { cssVar } from '@tauros/tokens';
import {
  CurrencyInput,
  Divider,
  Field,
  Flex,
  Label,
  NumberInput,
  Section,
  Stack,
  StickyRegion,
  Surface,
  Text,
} from '@tauros/ui-primitives';
import { useId, type ReactElement } from 'react';

import { SUBPRODUCT_KEYS, type SubproductKey } from '../domain/transformation.js';
import type { SubproductForm } from '../state/model.js';
import type { CalculatorController } from '../state/use-calculator.js';
import {
  formatBRL,
  formatKg,
  formatPct,
  formatPerKg,
  fromMinorUnits,
  toMinorUnits,
} from './format.js';
import { HelpButton, HelpNote, useHelp } from './help.js';
import { LedgerRow } from './ledger.js';
import { ScreenHeader } from './screen-header.js';

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

const HELP_INDICATOR =
  'Valor teórico = peso dos subprodutos × preço da carcaça. Perda = teórico − recuperado. Indicador = perda ÷ valor da carcaça de exportação; entra na Estimativa como ajuste comercial. Quanto mais você recupera, menor o indicador.';

interface SubproductRowProps {
  readonly label: string;
  readonly form: SubproductForm;
  readonly recoveredBRL: number;
  readonly onPatch: (patch: Partial<SubproductForm>) => void;
}

// Linha compacta: nome + valor recuperado em cima; "Peso [ ] R$/Kg [ ]"
// embaixo, rótulos ao lado dos campos (Label + id explícito, sem Field).
function SubproductRow({ label, form, recoveredBRL, onPatch }: SubproductRowProps): ReactElement {
  const baseId = useId();
  const weightId = `${baseId}-weight`;
  const priceId = `${baseId}-price`;
  return (
    <Surface
      role="group"
      aria-label={label}
      elevation="flat"
      style={{ padding: cssVar('space-inset-sm') }}
    >
      <Stack gap={50}>
        <Flex justify="between" align="baseline" gap={100}>
          <Text role="label">{label}</Text>
          <Text role="data">{formatBRL(recoveredBRL)}</Text>
        </Flex>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 2fr) auto minmax(0, 3fr)',
            alignItems: 'center',
            gap: cssVar('space-gap-100'),
          }}
        >
          <Label htmlFor={weightId} tone="secondary">
            Peso
          </Label>
          <NumberInput
            id={weightId}
            size="sm"
            endAdornment="kg"
            value={form.weightKg}
            onValueChange={(change) => {
              onPatch({ weightKg: change.value });
            }}
          />
          <Label htmlFor={priceId} tone="secondary">
            R$/Kg
          </Label>
          <CurrencyInput
            id={priceId}
            size="sm"
            valueInMinorUnits={toMinorUnits(form.pricePerKg)}
            onValueChange={(change) => {
              onPatch({ pricePerKg: fromMinorUnits(change.valueInMinorUnits) });
            }}
          />
        </div>
      </Stack>
    </Surface>
  );
}

export function TransformationScreen({ calc, onBack }: TransformationScreenProps): ReactElement {
  const { transformation } = calc;
  const { patchSubproduct, setExportCarcassPrice } = calc.actions;
  const help = useHelp();
  const recoveredByKey = Object.fromEntries(
    transformation.items.map((item) => [item.key, item.recoveredBRL]),
  );
  const indicatorText =
    transformation.indicatorPct === null ? '—' : formatPct(transformation.indicatorPct / 100);

  return (
    <Stack gap={200}>
      <ScreenHeader title="Transformação" onBack={onBack} />

      <Surface
        as="section"
        aria-label="Indicador econômico"
        elevation="card"
        style={{ padding: cssVar('space-inset-md') }}
      >
        <Stack gap={100}>
          <Flex justify="between" align="center" gap={100}>
            <Text role="label" tone="secondary">
              Indicador de transformação
            </Text>
            <HelpButton topic="indicador de transformação" help={help} />
          </Flex>
          <HelpNote help={help}>{HELP_INDICATOR}</HelpNote>
          <Text
            as="p"
            role="data"
            style={{
              fontSize: cssVar('emphasis-level1-size'),
              fontWeight: cssVar('emphasis-level1-weight'),
            }}
          >
            {indicatorText}
          </Text>
          <Text role="caption" tone="tertiary">
            Ajuste comercial da Estimativa
          </Text>
          <Divider />
          <Stack gap={50} role="group" aria-label="Composição do indicador">
            <LedgerRow label="Perda econômica" value={formatBRL(transformation.economicLossBRL)} />
            <LedgerRow
              label="Valor recuperado"
              value={formatBRL(transformation.totalRecoveredBRL)}
            />
            <LedgerRow
              label="Valor teórico"
              value={formatBRL(transformation.theoreticalValueBRL)}
            />
            <LedgerRow
              label="Carcaça de exportação"
              value={formatBRL(transformation.exportCarcassValueBRL)}
            />
            <LedgerRow
              label="Peso dos subprodutos"
              value={formatKg(transformation.totalWeightKg)}
            />
            <LedgerRow
              label="Preço da carcaça"
              value={formatPerKg(calc.state.transformation.exportCarcassPricePerKg ?? 0)}
            />
          </Stack>
        </Stack>
      </Surface>

      <Section title="Subprodutos">
        <Stack gap={100}>
          {SUBPRODUCT_KEYS.map((key) => (
            <SubproductRow
              key={key}
              label={SUBPRODUCT_LABELS[key]}
              form={calc.state.transformation.subproducts[key]}
              recoveredBRL={recoveredByKey[key] ?? 0}
              onPatch={(patch) => {
                patchSubproduct(key, patch);
              }}
            />
          ))}
        </Stack>
      </Section>

      <Section title="Carcaça de exportação">
        <Field label="Preço da carcaça de exportação (R$/kg)">
          <CurrencyInput
            size="md"
            valueInMinorUnits={toMinorUnits(calc.state.transformation.exportCarcassPricePerKg)}
            onValueChange={(change) => {
              setExportCarcassPrice(fromMinorUnits(change.valueInMinorUnits));
            }}
          />
        </Field>
      </Section>

      <StickyRegion position="bottom">
        <Flex
          justify="between"
          align="center"
          gap={100}
          style={{ padding: cssVar('space-inset-sm') }}
          role="group"
          aria-label="Indicador atual"
        >
          <Text role="label" tone="secondary">
            Indicador de transformação
          </Text>
          <Text
            role="data"
            style={{
              fontSize: cssVar('emphasis-level3-size'),
              fontWeight: cssVar('emphasis-level3-weight'),
            }}
          >
            {indicatorText}
          </Text>
        </Flex>
      </StickyRegion>
    </Stack>
  );
}
