// Tela de configurações — premissas padrão usadas por lotes novos. A tela
// edita um RASCUNHO local: cada valor é validado pelas regras exportadas do
// domínio (nunca recriadas aqui); valor válido persiste na hora, valor
// inválido fica no campo COM a mensagem de erro e não sobrescreve o padrão
// vigente.

import {
  Button,
  CurrencyInput,
  Field,
  NumberInput,
  PageHeader,
  Section,
  Stack,
  Text,
} from '@tauros/ui-primitives';
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
    <Stack gap={300}>
      <PageHeader
        title="Configurações"
        eyebrow="Premissas padrão"
        description="Valores usados ao iniciar um lote novo. O lote atual não muda sozinho."
        actions={
          <Button variant="ghost" size="sm" onClick={onBack}>
            Voltar
          </Button>
        }
      />

      <Section title="Premissas padrão">
        <Stack gap={200}>
          <Field label="Nº de suínos padrão" {...errorProp('animals')}>
            <NumberInput
              size="lg"
              value={draft.animals}
              onValueChange={(change) => {
                edit('animals', change.value);
              }}
            />
          </Field>
          <Field label="Preço do suíno vivo (R$/kg)" {...errorProp('livePricePerKg')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(draft.livePricePerKg)}
              onValueChange={(change) => {
                edit('livePricePerKg', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </Field>
          <Field
            label="Quebra de abate (%)"
            description="Perda física sobre o peso vivo."
            {...errorProp('slaughterLossPct')}
          >
            <NumberInput
              size="lg"
              endAdornment="%"
              value={draft.slaughterLossPct}
              onValueChange={(change) => {
                edit('slaughterLossPct', change.value);
              }}
            />
          </Field>
          <Field
            label="Quebra de frio (%)"
            description="Perda física sobre o peso que restou APÓS o abate — nunca sobre o vivo."
            {...errorProp('coolingLossPct')}
          >
            <NumberInput
              size="lg"
              endAdornment="%"
              value={draft.coolingLossPct}
              onValueChange={(change) => {
                edit('coolingLossPct', change.value);
              }}
            />
          </Field>
        </Stack>
      </Section>

      <Section
        title="Custos padrão"
        description="Abate e serviço são por suíno; diária e combustível valem para a viagem inteira."
      >
        <Stack gap={200}>
          <Field label="Taxa de abate (R$/cabeça)" {...errorProp('slaughterFeePerHead')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(draft.slaughterFeePerHead)}
              onValueChange={(change) => {
                edit('slaughterFeePerHead', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </Field>
          <Field label="Taxa de serviço (R$/suíno)" {...errorProp('servicePerHead')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(draft.servicePerHead)}
              onValueChange={(change) => {
                edit('servicePerHead', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </Field>
          <Field label="Diária do motorista (R$/viagem)" {...errorProp('driverDailyRate')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(draft.driverDailyRate)}
              onValueChange={(change) => {
                edit('driverDailyRate', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </Field>
          <Field label="Combustível (R$/viagem)" {...errorProp('fuelCost')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(draft.fuelCost)}
              onValueChange={(change) => {
                edit('fuelCost', fromMinorUnits(change.valueInMinorUnits));
              }}
            />
          </Field>
        </Stack>
      </Section>

      <Stack gap={100}>
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
