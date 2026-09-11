// Tela principal — Custo da Carcaça. Hierarquia: resultado dominante no topo
// (decisão nos primeiros 30% da tela), resumo executivo, comparação de preço,
// entradas grandes para edição com uma mão. A tela só apresenta: todo cálculo
// vem do domínio via controller. Na estimativa a cadeia é visível: peso médio
// → total → após abate → carcaça final → custo base → ajuste comercial →
// equivalente → custos adicionais → CUSTO FINAL EQUIVALENTE.

import { cssVar } from '@tauros/tokens';
import {
  Badge,
  Button,
  Card,
  Chip,
  CurrencyInput,
  Divider,
  Field,
  Flex,
  NumberInput,
  PageHeader,
  ResponsiveGrid,
  Section,
  SegmentedControl,
  Stack,
  StickyRegion,
  Surface,
  Text,
} from '@tauros/ui-primitives';
import { useState, type ReactElement } from 'react';

import {
  calculateFinalYield,
  calculateTotalLiveWeight,
  calculateYieldAfterSlaughter,
} from '../domain/carcass-cost.js';
import type { ValidationIssue } from '../domain/validation.js';
import type { CalculatorController } from '../state/use-calculator.js';
import { errorProp } from './field-messages.js';
import {
  formatBRL,
  formatKg,
  formatPct,
  formatPerKg,
  fromMinorUnits,
  toMinorUnits,
} from './format.js';

export interface CalculatorScreenProps {
  readonly calc: CalculatorController;
  readonly onOpenSettings: () => void;
  readonly onOpenHistory: () => void;
}

/** Números compartilhados do resultado dominante nos dois modos. */
interface HeadlineView {
  readonly costPerKg: number;
  readonly costPerAnimal: number;
  readonly totalCost: number;
  readonly additionalPerKg: number;
}

interface SummaryTileProps {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}

function SummaryTile({ label, value, detail }: SummaryTileProps): ReactElement {
  return (
    <Surface elevation="flat" style={{ padding: cssVar('space-inset-md') }}>
      <Stack gap={25}>
        <Text role="caption" tone="secondary">
          {label}
        </Text>
        <Text role="data">{value}</Text>
        {detail !== undefined && (
          <Text role="caption" tone="tertiary">
            {detail}
          </Text>
        )}
      </Stack>
    </Surface>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Flex justify="between" gap={100}>
      <Text role="caption" tone="secondary">
        {label}
      </Text>
      <Text role="data">{value}</Text>
    </Flex>
  );
}

function hasIssue(issues: readonly ValidationIssue[], field: string): boolean {
  return issues.some((issue) => issue.field === field);
}

export function CalculatorScreen({
  calc,
  onOpenSettings,
  onOpenHistory,
}: CalculatorScreenProps): ReactElement {
  const { state, quickIssues, realIssues, quickResult, realResult, whatIf, actions } = calc;
  // Feedback do salvar: o mesmo snapshot não é salvo duas vezes por engano —
  // o botão confirma visivelmente e só reabilita quando algo muda no lote.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const lotKey = JSON.stringify([state.mode, state.quick, state.real, state.costs]);
  const alreadySaved = savedKey === lotKey;
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

  return (
    <Stack gap={300}>
      <PageHeader
        title="Custo da Carcaça"
        eyebrow="Lote atual"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={onOpenHistory}>
              Histórico
            </Button>
            <Button variant="ghost" size="sm" onClick={onOpenSettings}>
              Configurações
            </Button>
          </>
        }
      />

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
        <Section
          title="Ajuste rápido"
          description="Atalho: altera só o preço do suíno vivo da estimativa atual — todo o resto permanece igual."
        >
          {/* Mesmo estado do campo de preço das Entradas (patchQuick) — o
              resultado recalcula pelo mesmo motor V2, sem lógica duplicada. */}
          <Field label="Preço do suíno vivo (R$/kg)" {...errorProp(issues, 'livePricePerKg')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(state.quick.livePricePerKg)}
              onValueChange={(change) => {
                actions.patchQuick({
                  livePricePerKg: fromMinorUnits(change.valueInMinorUnits),
                });
              }}
            />
          </Field>
        </Section>
      )}

      <Card as="section" aria-label="Resultado">
        <Stack gap={200}>
          <Flex justify="between" gap={100}>
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
              <Stack gap={50} role="group" aria-label="Composição do custo por kg">
                {!isReal && quickResult !== null ? (
                  <>
                    <BreakdownRow
                      label="Carcaça antes do ajuste"
                      value={formatPerKg(quickResult.baseCarcassPerKg)}
                    />
                    <BreakdownRow
                      label={`Ajuste comercial (+${formatPct(
                        (state.quick.commercialAdjustmentPct ?? 0) / 100,
                      )})`}
                      value={`+ ${formatPerKg(quickResult.commercialAdjustmentPerKg)}`}
                    />
                    <BreakdownRow
                      label="Custo equivalente"
                      value={formatPerKg(quickResult.equivalentPerKg)}
                    />
                    <BreakdownRow
                      label="Custos adicionais da operação"
                      value={formatBRL(quickResult.additionalCostsTotal)}
                    />
                    <BreakdownRow
                      label="Impacto dos custos adicionais"
                      value={`+ ${formatPerKg(quickResult.additionalPerKg)}`}
                    />
                  </>
                ) : realResult !== null ? (
                  <>
                    <BreakdownRow
                      label="Animal (vivo → carcaça)"
                      value={formatPerKg(realResult.basePerKg)}
                    />
                    <BreakdownRow
                      label="Custos adicionais da operação"
                      value={formatBRL(realResult.additionalCostsTotal)}
                    />
                    <BreakdownRow
                      label="Impacto dos custos adicionais"
                      value={`+ ${formatPerKg(realResult.additionalPerKg)}`}
                    />
                  </>
                ) : null}
              </Stack>
            </>
          )}
        </Stack>
      </Card>

      {headline !== null && (
        <Section title="Resumo do lote">
          <ResponsiveGrid itemSize="sm" gap={100}>
            {isReal && realResult !== null ? (
              <>
                <SummaryTile label="Peso pago" value={formatKg(realResult.paidWeightKg)} />
                <SummaryTile
                  label="Quebra no abate"
                  value={formatKg(realResult.slaughterLossKg)}
                  detail={formatPct(realResult.slaughterLossPct)}
                />
                <SummaryTile
                  label="Quebra no frio"
                  value={formatKg(realResult.coolingLossKg)}
                  detail={formatPct(realResult.coolingLossPct)}
                />
                <SummaryTile
                  label="Quebra total"
                  value={formatKg(realResult.totalLossKg)}
                  detail={formatPct(realResult.totalLossPct)}
                />
                <SummaryTile label="Rendimento final" value={formatPct(realResult.finalYield)} />
                <SummaryTile label="Peso final" value={formatKg(realResult.finalWeightKg)} />
              </>
            ) : quickResult !== null ? (
              <>
                <SummaryTile
                  label="Peso vivo total"
                  value={formatKg(quickResult.totalLiveWeightKg)}
                />
                <SummaryTile
                  label="Peso após abate"
                  value={formatKg(quickResult.weightAfterSlaughterKg)}
                  detail={formatPct(quickResult.yieldAfterSlaughter)}
                />
                <SummaryTile
                  label="Carcaça estimada"
                  value={formatKg(quickResult.estimatedCarcassKg)}
                  detail={formatPct(quickResult.finalYield)}
                />
                <SummaryTile label="Quebra total" value={formatPct(quickResult.totalLossPct)} />
                <SummaryTile
                  label="Custo equivalente"
                  value={formatPerKg(quickResult.equivalentPerKg)}
                  detail="Matéria-prima + ajuste comercial"
                />
              </>
            ) : null}
            <SummaryTile
              label="Custos adicionais"
              value={`+ ${formatPerKg(headline.additionalPerKg)}`}
              detail="Abate + serviço + viagem"
            />
          </ResponsiveGrid>
        </Section>
      )}

      {whatIf.length > 0 && (
        <Section
          title="E se eu pagar…"
          description="Toque em um preço do vivo para aplicá-lo ao lote."
        >
          <Flex gap={100} wrap>
            {whatIf.map((entry) => (
              <Chip
                key={entry.price}
                selected={entry.current}
                onClick={() => {
                  actions.applyPrice(entry.price);
                }}
              >
                {`${formatBRL(entry.price)} → ${
                  entry.costPerKg === null ? '—' : formatPerKg(entry.costPerKg)
                }`}
              </Chip>
            ))}
          </Flex>
        </Section>
      )}

      {isReal ? (
        <Section title="Pesos do lote real">
          <Stack gap={200}>
            <Field label="Nº de suínos" {...errorProp(issues, 'animals')}>
              <NumberInput
                size="lg"
                value={state.real.animals}
                onValueChange={(change) => {
                  actions.patchReal({ animals: change.value });
                }}
              />
            </Field>
            <Field label="Peso na balança (kg)" {...errorProp(issues, 'scaleWeightKg')}>
              <NumberInput
                size="lg"
                endAdornment="kg"
                value={state.real.scaleWeightKg}
                onValueChange={(change) => {
                  actions.patchReal({ scaleWeightKg: change.value });
                }}
              />
            </Field>
            <Field
              label="Descontos / graxaria (kg)"
              {...(realResult !== null
                ? { description: `Peso pago: ${formatKg(realResult.paidWeightKg)}` }
                : {})}
              {...errorProp(issues, 'discountsKg')}
            >
              <NumberInput
                size="lg"
                endAdornment="kg"
                value={state.real.discountsKg}
                onValueChange={(change) => {
                  actions.patchReal({ discountsKg: change.value });
                }}
              />
            </Field>
            <Field label="Peso abatido (kg)" {...errorProp(issues, 'slaughteredWeightKg')}>
              <NumberInput
                size="lg"
                endAdornment="kg"
                value={state.real.slaughteredWeightKg}
                onValueChange={(change) => {
                  actions.patchReal({ slaughteredWeightKg: change.value });
                }}
              />
            </Field>
            <Field label="Peso após frio (kg)" {...errorProp(issues, 'chilledWeightKg')}>
              <NumberInput
                size="lg"
                endAdornment="kg"
                value={state.real.chilledWeightKg}
                onValueChange={(change) => {
                  actions.patchReal({ chilledWeightKg: change.value });
                }}
              />
            </Field>
            <Field label="Preço do suíno vivo (R$/kg)" {...errorProp(issues, 'livePricePerKg')}>
              <CurrencyInput
                size="lg"
                valueInMinorUnits={toMinorUnits(state.real.livePricePerKg)}
                onValueChange={(change) => {
                  actions.patchReal({ livePricePerKg: fromMinorUnits(change.valueInMinorUnits) });
                }}
              />
            </Field>
          </Stack>
        </Section>
      ) : (
        <>
          <Section title="Entradas do lote">
            <Stack gap={200}>
              <Field label="Nº de suínos" {...errorProp(issues, 'animals')}>
                <NumberInput
                  size="lg"
                  value={state.quick.animals}
                  onValueChange={(change) => {
                    actions.patchQuick({ animals: change.value });
                  }}
                />
              </Field>
              <Field
                label="Peso vivo médio por suíno (kg)"
                {...(totalLivePreview !== null
                  ? { description: `Peso vivo total: ${formatKg(totalLivePreview)}` }
                  : {})}
                {...errorProp(issues, 'avgLiveWeightKg')}
              >
                <NumberInput
                  size="lg"
                  endAdornment="kg"
                  value={state.quick.avgLiveWeightKg}
                  onValueChange={(change) => {
                    actions.patchQuick({ avgLiveWeightKg: change.value });
                  }}
                />
              </Field>
              <Field label="Preço do suíno vivo (R$/kg)" {...errorProp(issues, 'livePricePerKg')}>
                <CurrencyInput
                  size="lg"
                  valueInMinorUnits={toMinorUnits(state.quick.livePricePerKg)}
                  onValueChange={(change) => {
                    actions.patchQuick({
                      livePricePerKg: fromMinorUnits(change.valueInMinorUnits),
                    });
                  }}
                />
              </Field>
            </Stack>
          </Section>

          <Section title="Rendimento">
            <Stack gap={200}>
              <Field
                label="Quebra de abate (%)"
                description="Sobre o peso vivo."
                {...errorProp(issues, 'slaughterLossPct')}
              >
                <NumberInput
                  size="lg"
                  endAdornment="%"
                  value={state.quick.slaughterLossPct}
                  onValueChange={(change) => {
                    actions.patchQuick({ slaughterLossPct: change.value });
                  }}
                />
              </Field>
              <Field
                label="Quebra de frio (%)"
                description="Sobre o peso que restou após o abate — nunca sobre o vivo."
                {...errorProp(issues, 'coolingLossPct')}
              >
                <NumberInput
                  size="lg"
                  endAdornment="%"
                  value={state.quick.coolingLossPct}
                  onValueChange={(change) => {
                    actions.patchQuick({ coolingLossPct: change.value });
                  }}
                />
              </Field>
              <ResponsiveGrid itemSize="sm" gap={100}>
                <SummaryTile
                  label="Rendimento após abate"
                  value={yieldAfterSlaughter === null ? '—' : formatPct(yieldAfterSlaughter)}
                />
                <SummaryTile
                  label="Rendimento final"
                  value={finalYieldPreview === null ? '—' : formatPct(finalYieldPreview)}
                />
              </ResponsiveGrid>
            </Stack>
          </Section>

          <Section
            title="Ajuste comercial"
            description="Compara a carcaça recebida com a referência de exportação (mãozinha, rabinho, banha etc.). Não é quebra física: incide só sobre o custo da matéria-prima."
          >
            <Field
              label="Ajuste comercial / exportação (%)"
              {...errorProp(issues, 'commercialAdjustmentPct')}
            >
              <NumberInput
                size="lg"
                endAdornment="%"
                value={state.quick.commercialAdjustmentPct}
                onValueChange={(change) => {
                  actions.patchQuick({ commercialAdjustmentPct: change.value });
                }}
              />
            </Field>
          </Section>
        </>
      )}

      <Section
        title="Custos"
        description="Abate e serviço são por suíno; diária e combustível valem para a viagem inteira. Tudo é diluído pelo peso final da carcaça."
      >
        <Stack gap={200}>
          <Field label="Taxa de abate (R$/cabeça)" {...errorProp(issues, 'slaughterFeePerHead')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(state.costs.slaughterFeePerHead)}
              onValueChange={(change) => {
                actions.patchCosts({
                  slaughterFeePerHead: fromMinorUnits(change.valueInMinorUnits),
                });
              }}
            />
          </Field>
          <Field label="Taxa de serviço (R$/suíno)" {...errorProp(issues, 'servicePerHead')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(state.costs.servicePerHead)}
              onValueChange={(change) => {
                actions.patchCosts({ servicePerHead: fromMinorUnits(change.valueInMinorUnits) });
              }}
            />
          </Field>
          <Field label="Diária do motorista (R$/viagem)" {...errorProp(issues, 'driverDailyRate')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(state.costs.driverDailyRate)}
              onValueChange={(change) => {
                actions.patchCosts({ driverDailyRate: fromMinorUnits(change.valueInMinorUnits) });
              }}
            />
          </Field>
          <Field label="Combustível (R$/viagem)" {...errorProp(issues, 'fuelCost')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(state.costs.fuelCost)}
              onValueChange={(change) => {
                actions.patchCosts({ fuelCost: fromMinorUnits(change.valueInMinorUnits) });
              }}
            />
          </Field>
        </Stack>
      </Section>

      <Stack gap={50}>
        <Button
          variant="secondary"
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
          gap={100}
          style={{ padding: cssVar('space-inset-md') }}
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
