// Tela principal — Custo da Carcaça. Hierarquia: resultado dominante no topo
// (decisão nos primeiros 30% da tela), entradas em duas colunas para caber
// um lote numa rolagem curta, resumo em linhas "razão" ao final. A tela só
// apresenta: todo cálculo vem do domínio via controller. Na estimativa a
// cadeia é visível: peso médio → total → após abate → carcaça final → custo
// base → ajuste comercial → equivalente → custos adicionais → CUSTO FINAL.
// A compacidade vem do LAYOUT (2 colunas, explicações em "?", gaps menores):
// a altura dos controles é a do DS (glove-first, size-control-min) e não é
// reduzida aqui.

import { cssVar } from '@tauros/tokens';
import {
  Badge,
  Button,
  CurrencyInput,
  Divider,
  Flex,
  Grid,
  NumberInput,
  PageHeader,
  Section,
  SegmentedControl,
  Stack,
  StickyRegion,
  Surface,
  Text,
} from '@tauros/ui-primitives';
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';

import {
  CENAR_TAX_PER_KG,
  OPPORTUNITY_COST_PER_KG,
  calculateFinalYield,
  calculateTotalLiveWeight,
  calculateYieldAfterSlaughter,
} from '../domain/carcass-cost.js';
import type { ValidationIssue } from '../domain/validation.js';
import type { CalculatorController } from '../state/use-calculator.js';
import { CostFormation, type FormationStep } from './cost-formation.js';
import { errorProp } from './field-messages.js';
import {
  formatBRL,
  formatKg,
  formatPct,
  formatPerKg,
  fromMinorUnits,
  toMinorUnits,
} from './format.js';
import { GridField } from './grid-field.js';
import { HelpSection } from './help.js';
import { LedgerRow } from './ledger.js';

export interface CalculatorScreenProps {
  readonly calc: CalculatorController;
  readonly onOpenSettings: () => void;
  readonly onOpenHistory: () => void;
  readonly onOpenTransformation: () => void;
  readonly onOpenDeboning: () => void;
  /** Entrada da tela Conta; null quando o app não tem nuvem configurada. */
  readonly account: { readonly label: string; readonly onOpen: () => void } | null;
}

/** Números compartilhados do resultado dominante nos dois modos. */
interface HeadlineView {
  readonly costPerKg: number;
  readonly costPerAnimal: number;
  readonly totalCost: number;
  readonly additionalPerKg: number;
}

// Contorno na cor de destaque: ação que altera o indicador, ligada ao card dele.
const ACCENT_OUTLINE: CSSProperties = {
  color: cssVar('color-accent-default'),
  borderColor: cssVar('color-accent-default'),
};

function hasIssue(issues: readonly ValidationIssue[], field: string): boolean {
  return issues.some((issue) => issue.field === field);
}

// Explicações que saíram da interface principal (abrem pelo "?").
const HELP = {
  rendimento:
    'Quebra de abate incide sobre o peso vivo; quebra de frio, sobre o peso que restou após o abate (nunca sobre o vivo). Rendimento final = (1 − abate) × (1 − frio).',
  ajuste:
    'Indicador da aba Transformação: perda econômica dos subprodutos sobre o valor da carcaça de exportação. Incide só sobre o custo da matéria-prima — não é quebra física.',
  custos:
    'Abate e serviço são por suíno; diária do motorista e combustível valem para a viagem inteira. Tudo é diluído pelo peso final da carcaça.',
} as const;

export function CalculatorScreen({
  calc,
  onOpenSettings,
  onOpenHistory,
  onOpenTransformation,
  onOpenDeboning,
  account,
}: CalculatorScreenProps): ReactElement {
  const {
    state,
    quickIssues,
    realIssues,
    quickResult,
    realResult,
    commercialAdjustmentPct,
    actions,
    cloudError,
  } = calc;
  // Feedback do salvar: o mesmo snapshot não é salvo duas vezes por engano —
  // o botão confirma visivelmente e só reabilita quando algo muda no lote.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const lotKey = JSON.stringify([state.mode, state.quick, state.real, state.costs]);
  const alreadySaved = savedKey === lotKey;
  // Falha ao salvar na nuvem reabilita o botão para tentar de novo.
  useEffect(() => {
    if (cloudError !== null) setSavedKey(null);
  }, [cloudError]);
  const isReal = state.mode === 'real';
  const issues = isReal ? realIssues : quickIssues;
  const headline: HeadlineView | null = isReal ? realResult : quickResult;

  // Rendimentos da estimativa dependem só dos percentuais — visíveis mesmo
  // com o peso ainda em branco (funções do domínio, nunca refeitas aqui).
  const { animals, avgLiveWeightKg, slaughterLossPct, coolingLossPct } = state.quick;
  const yieldsAvailable =
    slaughterLossPct !== null &&
    coolingLossPct !== null &&
    !hasIssue(quickIssues, 'slaughterLossPct') &&
    !hasIssue(quickIssues, 'coolingLossPct');
  const yieldAfterSlaughter = yieldsAvailable
    ? calculateYieldAfterSlaughter(slaughterLossPct)
    : null;
  const finalYieldPreview = yieldsAvailable
    ? calculateFinalYield(slaughterLossPct, coolingLossPct)
    : null;
  // Peso vivo total derivado (animais × peso médio) — nunca digitado.
  const totalLivePreview =
    animals !== null &&
    avgLiveWeightKg !== null &&
    !hasIssue(quickIssues, 'animals') &&
    !hasIssue(quickIssues, 'avgLiveWeightKg')
      ? calculateTotalLiveWeight(animals, avgLiveWeightKg)
      : null;

  const modeBadge = isReal ? (
    <Badge status="info">LOTE REAL</Badge>
  ) : (
    <Badge status="neutral">ESTIMATIVA</Badge>
  );
  const indicatorText =
    commercialAdjustmentPct === null ? '—' : formatPct(commercialAdjustmentPct / 100);

  // Formação do custo por kg — só valores já calculados pelo domínio (as
  // notas dizem a origem de cada parcela; nenhuma conta é refeita aqui).
  const formationSteps: readonly FormationStep[] =
    !isReal && quickResult !== null
      ? [
          {
            kind: 'start',
            label: 'Carcaça antes do ajuste',
            value: formatPerKg(quickResult.baseCarcassPerKg),
            note: `${formatPerKg(state.quick.livePricePerKg ?? 0)} vivo ÷ ${formatPct(quickResult.finalYield)} de rendimento`,
          },
          {
            kind: 'add',
            label: 'Ajuste transformação',
            value: `+ ${formatPerKg(quickResult.commercialAdjustmentPerKg)}`,
            note: `Indicador ${indicatorText} dos subprodutos`,
          },
          {
            kind: 'subtotal',
            label: 'Carcaça equivalente',
            value: formatPerKg(quickResult.equivalentPerKg),
          },
          {
            kind: 'add',
            label: 'Abate + serviço + frete',
            value: `+ ${formatPerKg(quickResult.additionalPerKg)}`,
            note: `${formatBRL(quickResult.additionalCostsTotal)} ÷ ${formatKg(quickResult.estimatedCarcassKg)}`,
          },
          {
            kind: 'add',
            label: 'Custo de oportunidade',
            value: `+ ${formatPerKg(OPPORTUNITY_COST_PER_KG)}`,
            note: 'Descarga não realizada',
          },
          { kind: 'add', label: 'CENAR', value: `+ ${formatPerKg(CENAR_TAX_PER_KG)}` },
          { kind: 'total', label: 'Custo final', value: formatPerKg(quickResult.costPerKg) },
        ]
      : isReal && realResult !== null
        ? [
            {
              kind: 'start',
              label: 'Animal (vivo → carcaça)',
              value: formatPerKg(realResult.basePerKg),
              note: `${formatPerKg(state.real.livePricePerKg ?? 0)} vivo ÷ ${formatPct(realResult.finalYield)} de rendimento`,
            },
            {
              kind: 'add',
              label: 'Abate + serviço + frete',
              value: `+ ${formatPerKg(realResult.additionalPerKg)}`,
              note: `${formatBRL(realResult.additionalCostsTotal)} ÷ ${formatKg(realResult.finalWeightKg)}`,
            },
            { kind: 'total', label: 'Custo final', value: formatPerKg(realResult.costPerKg) },
          ]
        : [];

  return (
    <Stack gap={200}>
      <PageHeader title="Custo da Carcaça" />
      {/* Quatro telas em 2×2: quatro botões lado a lado não cabem em 390 px
          ("Transformação"/"Configurações" quebrariam); duas colunas mantêm
          o rótulo inteiro e o alvo de toque do DS. */}
      <Grid columns={2} gap={50} role="navigation" aria-label="Telas">
        <Button variant="secondary" size="sm" fullWidth onClick={onOpenTransformation}>
          Transformação
        </Button>
        <Button variant="secondary" size="sm" fullWidth onClick={onOpenDeboning}>
          Desossa
        </Button>
        <Button variant="secondary" size="sm" fullWidth onClick={onOpenHistory}>
          Histórico
        </Button>
        <Button variant="secondary" size="sm" fullWidth onClick={onOpenSettings}>
          Configurações
        </Button>
      </Grid>
      {account !== null && (
        <Button variant="secondary" size="sm" fullWidth onClick={account.onOpen}>
          {account.label}
        </Button>
      )}

      {/* position:relative ancora os radios visually-hidden (absolutos) do
          SegmentedControl — sem âncora eles esticam o html e criam scroll
          fantasma da página (pendência do DS registrada na traceability). */}
      <div style={{ position: 'relative' }}>
        <SegmentedControl
          aria-label="Modo de cálculo"
          options={[
            { value: 'quick', label: 'Estimativa' },
            { value: 'real', label: 'Lote Real' },
          ]}
          value={state.mode}
          onValueChange={(value) => {
            actions.setMode(value === 'real' ? 'real' : 'quick');
          }}
        />
      </div>

      {!isReal && (
        <Section title="Ajuste rápido">
          {/* Mesmo estado do campo de preço das Entradas (patchQuick) — o
              resultado recalcula pelo mesmo motor V2, sem lógica duplicada. */}
          <GridField label="Preço do suíno vivo (R$/kg)" {...errorProp(issues, 'livePricePerKg')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(state.quick.livePricePerKg)}
              onValueChange={(change) => {
                actions.patchQuick({
                  livePricePerKg: fromMinorUnits(change.valueInMinorUnits),
                });
              }}
            />
          </GridField>
        </Section>
      )}

      <Surface
        as="section"
        aria-label="Resultado"
        elevation="card"
        style={{ padding: cssVar('space-inset-md') }}
      >
        <Stack gap={100}>
          <Flex justify="between" align="center" gap={100}>
            <Text role="label" tone="secondary">
              {isReal ? 'Custo final' : 'Custo final equivalente'}
            </Text>
            {modeBadge}
          </Flex>
          {headline === null ? (
            <Text as="p" tone="secondary">
              Preencha os campos destacados abaixo para ver o custo da carcaça.
            </Text>
          ) : (
            <>
              <Text
                as="p"
                role="data"
                style={{
                  fontSize: cssVar('emphasis-level1-size'),
                  fontWeight: cssVar('emphasis-level1-weight'),
                }}
              >
                {formatPerKg(headline.costPerKg)}
              </Text>
              <Flex gap={300} wrap>
                <Stack gap={25}>
                  <Text role="caption" tone="secondary">
                    Custo por suíno
                  </Text>
                  <Text role="data">{formatBRL(headline.costPerAnimal)}</Text>
                </Stack>
                <Stack gap={25}>
                  <Text role="caption" tone="secondary">
                    Custo total do lote
                  </Text>
                  <Text role="data">{formatBRL(headline.totalCost)}</Text>
                </Stack>
              </Flex>
              <Divider />
              <CostFormation label="Formação do custo por kg" steps={formationSteps} />
            </>
          )}
        </Stack>
      </Surface>

      {isReal ? (
        <Section title="Pesos do lote real">
          <Grid columns={2} gap={100}>
            <GridField label="Nº de suínos" {...errorProp(issues, 'animals')}>
              <NumberInput
                size="md"
                value={state.real.animals}
                onValueChange={(change) => {
                  actions.patchReal({ animals: change.value });
                }}
              />
            </GridField>
            <GridField label="Preço do suíno vivo (R$/kg)" {...errorProp(issues, 'livePricePerKg')}>
              <CurrencyInput
                size="md"
                valueInMinorUnits={toMinorUnits(state.real.livePricePerKg)}
                onValueChange={(change) => {
                  actions.patchReal({ livePricePerKg: fromMinorUnits(change.valueInMinorUnits) });
                }}
              />
            </GridField>
            <GridField label="Peso na balança" {...errorProp(issues, 'scaleWeightKg')}>
              <NumberInput
                size="md"
                endAdornment="kg"
                value={state.real.scaleWeightKg}
                onValueChange={(change) => {
                  actions.patchReal({ scaleWeightKg: change.value });
                }}
              />
            </GridField>
            <GridField
              label="Descontos / graxaria"
              {...(realResult !== null
                ? { description: `Peso pago: ${formatKg(realResult.paidWeightKg)}` }
                : {})}
              {...errorProp(issues, 'discountsKg')}
            >
              <NumberInput
                size="md"
                endAdornment="kg"
                value={state.real.discountsKg}
                onValueChange={(change) => {
                  actions.patchReal({ discountsKg: change.value });
                }}
              />
            </GridField>
            <GridField label="Peso abatido" {...errorProp(issues, 'slaughteredWeightKg')}>
              <NumberInput
                size="md"
                endAdornment="kg"
                value={state.real.slaughteredWeightKg}
                onValueChange={(change) => {
                  actions.patchReal({ slaughteredWeightKg: change.value });
                }}
              />
            </GridField>
            <GridField label="Peso após frio" {...errorProp(issues, 'chilledWeightKg')}>
              <NumberInput
                size="md"
                endAdornment="kg"
                value={state.real.chilledWeightKg}
                onValueChange={(change) => {
                  actions.patchReal({ chilledWeightKg: change.value });
                }}
              />
            </GridField>
          </Grid>
        </Section>
      ) : (
        <>
          <Section title="Entradas do lote">
            <Grid columns={2} gap={100}>
              <GridField label="Nº de suínos" {...errorProp(issues, 'animals')}>
                <NumberInput
                  size="md"
                  value={state.quick.animals}
                  onValueChange={(change) => {
                    actions.patchQuick({ animals: change.value });
                  }}
                />
              </GridField>
              <GridField
                label="Peso vivo médio"
                {...(totalLivePreview !== null
                  ? { description: `Peso vivo total: ${formatKg(totalLivePreview)}` }
                  : {})}
                {...errorProp(issues, 'avgLiveWeightKg')}
              >
                <NumberInput
                  size="md"
                  endAdornment="kg"
                  value={state.quick.avgLiveWeightKg}
                  onValueChange={(change) => {
                    actions.patchQuick({ avgLiveWeightKg: change.value });
                  }}
                />
              </GridField>
            </Grid>
            <GridField label="Preço do suíno vivo (R$/kg)" {...errorProp(issues, 'livePricePerKg')}>
              <CurrencyInput
                size="md"
                valueInMinorUnits={toMinorUnits(state.quick.livePricePerKg)}
                onValueChange={(change) => {
                  actions.patchQuick({
                    livePricePerKg: fromMinorUnits(change.valueInMinorUnits),
                  });
                }}
              />
            </GridField>
          </Section>

          <HelpSection title="Rendimento" help={HELP.rendimento}>
            <Grid columns={2} gap={100}>
              <GridField label="Quebra de abate" {...errorProp(issues, 'slaughterLossPct')}>
                <NumberInput
                  size="md"
                  endAdornment="%"
                  value={state.quick.slaughterLossPct}
                  onValueChange={(change) => {
                    actions.patchQuick({ slaughterLossPct: change.value });
                  }}
                />
              </GridField>
              <GridField label="Quebra de frio" {...errorProp(issues, 'coolingLossPct')}>
                <NumberInput
                  size="md"
                  endAdornment="%"
                  value={state.quick.coolingLossPct}
                  onValueChange={(change) => {
                    actions.patchQuick({ coolingLossPct: change.value });
                  }}
                />
              </GridField>
            </Grid>
            <Stack gap={50} role="group" aria-label="Rendimento físico">
              <LedgerRow
                label="Após abate"
                value={yieldAfterSlaughter === null ? '—' : formatPct(yieldAfterSlaughter)}
              />
              <LedgerRow
                label="Rendimento final"
                value={finalYieldPreview === null ? '—' : formatPct(finalYieldPreview)}
              />
            </Stack>
          </HelpSection>

          <HelpSection title="Ajuste comercial" help={HELP.ajuste}>
            <Surface elevation="flat" style={{ padding: cssVar('space-inset-md') }}>
              <Stack gap={100}>
                <LedgerRow label="Indicador de transformação" value={indicatorText} />
                {/* Abre os dados que geram o indicador acima (aba Transformação). */}
                <Button
                  variant="secondary"
                  fullWidth
                  style={ACCENT_OUTLINE}
                  onClick={onOpenTransformation}
                >
                  Ajustar subprodutos
                </Button>
              </Stack>
            </Surface>
          </HelpSection>
        </>
      )}

      <HelpSection title="Custos" help={HELP.custos}>
        <Grid columns={2} gap={100}>
          <GridField label="Abate (R$/cabeça)" {...errorProp(issues, 'slaughterFeePerHead')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(state.costs.slaughterFeePerHead)}
              onValueChange={(change) => {
                actions.patchCosts({
                  slaughterFeePerHead: fromMinorUnits(change.valueInMinorUnits),
                });
              }}
            />
          </GridField>
          <GridField label="Serviço (R$/suíno)" {...errorProp(issues, 'servicePerHead')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(state.costs.servicePerHead)}
              onValueChange={(change) => {
                actions.patchCosts({ servicePerHead: fromMinorUnits(change.valueInMinorUnits) });
              }}
            />
          </GridField>
          <GridField label="Diária (R$/viagem)" {...errorProp(issues, 'driverDailyRate')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(state.costs.driverDailyRate)}
              onValueChange={(change) => {
                actions.patchCosts({ driverDailyRate: fromMinorUnits(change.valueInMinorUnits) });
              }}
            />
          </GridField>
          <GridField label="Combustível (R$/viagem)" {...errorProp(issues, 'fuelCost')}>
            <CurrencyInput
              size="md"
              valueInMinorUnits={toMinorUnits(state.costs.fuelCost)}
              onValueChange={(change) => {
                actions.patchCosts({ fuelCost: fromMinorUnits(change.valueInMinorUnits) });
              }}
            />
          </GridField>
        </Grid>
      </HelpSection>

      {headline !== null && (
        <Section title="Resumo do lote">
          <Stack gap={50}>
            {isReal && realResult !== null ? (
              <>
                <LedgerRow label="Peso pago" value={formatKg(realResult.paidWeightKg)} />
                <LedgerRow
                  label="Quebra no abate"
                  value={formatKg(realResult.slaughterLossKg)}
                  detail={formatPct(realResult.slaughterLossPct)}
                />
                <LedgerRow
                  label="Quebra no frio"
                  value={formatKg(realResult.coolingLossKg)}
                  detail={formatPct(realResult.coolingLossPct)}
                />
                <LedgerRow
                  label="Quebra total"
                  value={formatKg(realResult.totalLossKg)}
                  detail={formatPct(realResult.totalLossPct)}
                />
                <LedgerRow label="Rendimento final" value={formatPct(realResult.finalYield)} />
                <LedgerRow label="Peso final" value={formatKg(realResult.finalWeightKg)} />
              </>
            ) : quickResult !== null ? (
              <>
                <LedgerRow
                  label="Peso vivo total"
                  value={formatKg(quickResult.totalLiveWeightKg)}
                />
                <LedgerRow
                  label="Peso após abate"
                  value={formatKg(quickResult.weightAfterSlaughterKg)}
                  detail={formatPct(quickResult.yieldAfterSlaughter)}
                />
                <LedgerRow
                  label="Carcaça estimada"
                  value={formatKg(quickResult.estimatedCarcassKg)}
                  detail={formatPct(quickResult.finalYield)}
                />
                <LedgerRow label="Quebra total" value={formatPct(quickResult.totalLossPct)} />
                <LedgerRow
                  label="Custo equivalente"
                  value={formatPerKg(quickResult.equivalentPerKg)}
                />
              </>
            ) : null}
            <LedgerRow
              label="Custos adicionais"
              value={`+ ${formatPerKg(headline.additionalPerKg)}`}
            />
          </Stack>
        </Section>
      )}

      <Stack gap={50}>
        <Button
          variant="primary"
          fullWidth
          disabled={headline === null || alreadySaved}
          onClick={() => {
            actions.saveToHistory();
            setSavedKey(lotKey);
          }}
        >
          {alreadySaved ? 'Lote salvo no histórico' : 'Salvar lote no histórico'}
        </Button>
        <div aria-live="polite">
          {cloudError !== null && <Text role="caption">{cloudError}</Text>}
          {alreadySaved && (
            <Text role="caption" tone="secondary">
              Lote salvo. Altere algum valor para salvar de novo.
            </Text>
          )}
        </div>
      </Stack>

      <StickyRegion position="bottom">
        <Flex
          justify="between"
          align="center"
          gap={100}
          style={{ padding: cssVar('space-inset-sm') }}
          role="group"
          aria-label="Custo final atual"
        >
          {modeBadge}
          <Text
            role="data"
            style={{
              fontSize: cssVar('emphasis-level3-size'),
              fontWeight: cssVar('emphasis-level3-weight'),
            }}
          >
            {headline === null ? '—' : formatPerKg(headline.costPerKg)}
          </Text>
        </Flex>
      </StickyRegion>
    </Stack>
  );
}
