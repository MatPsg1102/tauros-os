// Tela de configurações — premissas padrão usadas por lotes novos. A tela
// edita um RASCUNHO local: cada valor é validado pelas regras exportadas do
// domínio (nunca recriadas aqui); valor válido persiste na hora, valor
// inválido fica no campo COM a mensagem de erro e não sobrescreve o padrão
// vigente. Campos em duas colunas; explicações no "?".

import { Button, CurrencyInput, Grid, NumberInput, Stack, Text } from '@tauros/ui-primitives';
import { useState, type ReactElement } from 'react';

import {
  headCountIssue,
  nonNegativeIssue,
  percentageIssue,
  type IssueCode,
} from '../domain/validation.js';
import type { DefaultSettings } from '../state/model.js';
import type { CalculatorController } from '../state/use-calculator.js';
import { ISSUE_MESSAGES } from './field-messages.js';
import { fromMinorUnits, toMinorUnits } from './format.js';
import { GridField } from './grid-field.js';
import { HelpSection } from './help.js';
import { ScreenHeader } from './screen-header.js';

export interface SettingsScreenProps {
  readonly calc: CalculatorController;
  readonly onBack: () => void;
}

type NumericSettingKey = keyof DefaultSettings;
type SettingsDraft = { readonly [K in NumericSettingKey]: number | null };

const RULES: { readonly [K in NumericSettingKey]: (value: number) => IssueCode | null } = {
  animals: headCountIssue,
  livePricePerKg: nonNegativeIssue,
  slaughterLossPct: percentageIssue,
  coolingLossPct: percentageIssue,
  slaughterFeePerHead: nonNegativeIssue,
  servicePerHead: nonNegativeIssue,
  driverDailyRate: nonNegativeIssue,
  fuelCost: nonNegativeIssue,
};

const HELP = {
  premissas:
    'Quebra de abate incide sobre o peso vivo; quebra de frio, sobre o peso que restou após o abate (nunca sobre o vivo).',
  custos:
    'Abate e serviço são por suíno; diária do motorista e combustível valem para a viagem inteira.',
} as const;

function issueOf(key: NumericSettingKey, value: number | null): IssueCode | null {
  return value === null ? 'REQUIRED' : RULES[key](value);
}

function draftFromSettings(settings: DefaultSettings): SettingsDraft {
  return {
    animals: settings.animals,
    livePricePerKg: settings.livePricePerKg,
    slaughterLossPct: settings.slaughterLossPct,
    coolingLossPct: settings.coolingLossPct,
    slaughterFeePerHead: settings.slaughterFeePerHead,
    servicePerHead: settings.servicePerHead,
    driverDailyRate: settings.driverDailyRate,
    fuelCost: settings.fuelCost,
  };
}

export function SettingsScreen({ calc, onBack }: SettingsScreenProps): ReactElement {
  const { settings } = calc.state;
  const { patchSettings, startNewLot } = calc.actions;
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromSettings(settings));

  const edit = (key: NumericSettingKey, value: number | null): void => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (issueOf(key, value) === null && value !== null) {
      patchSettings({ [key]: value } as Partial<DefaultSettings>);
    }
  };

  const errorProp = (key: NumericSettingKey): { readonly error?: string } => {
    const code = issueOf(key, draft[key]);
    return code === null ? {} : { error: ISSUE_MESSAGES[code] };
  };

  return (
    <Stack gap={200}>
      <ScreenHeader
        title="Configurações"
        description="Valores usados ao iniciar um lote novo. O lote atual não muda sozinho."
        onBack={onBack}
      />

      <HelpSection title="Premissas padrão" help={HELP.premissas}>
        <Grid columns={2} gap={100}>
          <GridField label="Nº de suínos" {...errorProp('animals')}>
            <NumberInput
              size="md"
              value={draft.animals}
              onValueChange={(change) => {
                edit('animals', change.value);
              }}
            />
          </GridField>
          <GridField label="Preço do suíno vivo (R$/kg)" {...errorProp('livePricePerKg')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(draft.livePricePerKg)}
              onValueChange={(change) => {
                edit('livePricePerKg', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </GridField>
          <GridField label="Quebra de abate" {...errorProp('slaughterLossPct')}>
            <NumberInput
              size="md"
              endAdornment="%"
              value={draft.slaughterLossPct}
              onValueChange={(change) => {
                edit('slaughterLossPct', change.value);
              }}
            />
          </GridField>
          <GridField label="Quebra de frio" {...errorProp('coolingLossPct')}>
            <NumberInput
              size="md"
              endAdornment="%"
              value={draft.coolingLossPct}
              onValueChange={(change) => {
                edit('coolingLossPct', change.value);
              }}
            />
          </GridField>
        </Grid>
      </HelpSection>

      <HelpSection title="Custos padrão" help={HELP.custos}>
        <Grid columns={2} gap={100}>
          <GridField label="Abate (R$/cabeça)" {...errorProp('slaughterFeePerHead')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(draft.slaughterFeePerHead)}
              onValueChange={(change) => {
                edit('slaughterFeePerHead', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </GridField>
          <GridField label="Serviço (R$/suíno)" {...errorProp('servicePerHead')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(draft.servicePerHead)}
              onValueChange={(change) => {
                edit('servicePerHead', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </GridField>
          <GridField label="Diária (R$/viagem)" {...errorProp('driverDailyRate')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(draft.driverDailyRate)}
              onValueChange={(change) => {
                edit('driverDailyRate', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </GridField>
          <GridField label="Combustível (R$/viagem)" {...errorProp('fuelCost')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(draft.fuelCost)}
              onValueChange={(change) => {
                edit('fuelCost', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </GridField>
        </Grid>
      </HelpSection>

      <Stack gap={50}>
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            startNewLot();
            onBack();
          }}
        >
          Iniciar novo lote com estes padrões
        </Button>
        <Text role="caption" tone="tertiary">
          Substitui os valores do lote atual pelas premissas acima (os pesos voltam a ficar em
          branco).
        </Text>
      </Stack>
    </Stack>
  );
}
