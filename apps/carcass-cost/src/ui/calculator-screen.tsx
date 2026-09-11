// Tela principal — Custo da Carcaça. Hierarquia: resultado dominante no topo
// (decisão nos primeiros 30% da tela), resumo executivo, comparação de preço,
// entradas grandes para edição com uma mão. A tela só apresenta: todo cálculo
// vem do domínio via controller.

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
  calculateYieldAfterSlaughter,
  type QuickEstimateResult,
  type RealLotResult,
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

/** Visão comum do resultado dominante — mesmos campos nos dois modos. */
interface HeadlineView {
  readonly costPerKg: number;
  readonly costPerAnimal: number;
  readonly totalCost: number;
  readonly finalWeightKg: number;
  readonly basePerKg: number;
  readonly slaughterPerKg: number;
  readonly servicePerKg: number;
  readonly freightPerKg: number;
  readonly additionalPerKg: number;
}

function headlineFromQuick(result: QuickEstimateResult): HeadlineView {
  return { ...result, finalWeightKg: result.estimatedCarcassKg };
}

function headlineFromReal(result: RealLotResult): HeadlineView {
  return result;
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
  const headline = isReal
    ? realResult === null
      ? null
      : headlineFromReal(realResult)
    : quickResult === null
      ? null
      : headlineFromQuick(quickResult);

  // Rendimentos do modo estimativa dependem só dos percentuais — visíveis
  // mesmo com o peso ainda em branco (funções do domínio, nunca refeitas aqui).
  const { slaughterLossPct, coolingTransformPct } = state.quick;
  const yieldsAvailable =
    slaughterLossPct !== null &&
    coolingTransformPct !== null &&
    !hasIssue(quickIssues, 'slaughterLossPct') &&
    !hasIssue(quickIssues, 'coolingTransformPct');
  const yieldAfterSlaughter = yieldsAvailable
    ? calculateYieldAfterSlaughter(slaughterLossPct)
    : null;
  const finalYieldPreview = yieldsAvailable
    ? calculateFinalYield(slaughterLossPct, coolingTransformPct)
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

      <Card as="section" aria-label="Resultado">
        <Stack gap={200}>
          <Flex justify="between" gap={100}>
            <Text role="label" tone="secondary">
              Custo final
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
                <BreakdownRow
                  label="Animal (vivo → carcaça)"
                  value={formatPerKg(headline.basePerKg)}
                />
                <BreakdownRow
                  label="Taxa de abate"
                  value={`+ ${formatPerKg(headline.slaughterPerKg)}`}
                />
                <BreakdownRow label="Serviço" value={`+ ${formatPerKg(headline.servicePerKg)}`} />
                <BreakdownRow
                  label="Frete / diária"
                  value={`+ ${formatPerKg(headline.freightPerKg)}`}
                />
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
                <SummaryTile label="Peso vivo" value={formatKg(quickResult.liveWeightKg)} />
                <SummaryTile
                  label="Carcaça estimada"
                  value={formatKg(quickResult.estimatedCarcassKg)}
                />
                <SummaryTile label="Rendimento final" value={formatPct(quickResult.finalYield)} />
                <SummaryTile label="Quebra total" value={formatPct(quickResult.totalLossPct)} />
              </>
            ) : null}
            <SummaryTile
              label="Custos adicionais"
              value={`+ ${formatPerKg(headline.additionalPerKg)}`}
              detail="Abate + serviço + frete"
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
              <Field label="Peso vivo total (kg)" {...errorProp(issues, 'liveWeightKg')}>
                <NumberInput
                  size="lg"
                  endAdornment="kg"
                  value={state.quick.liveWeightKg}
                  onValueChange={(change) => {
                    actions.patchQuick({ liveWeightKg: change.value });
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
              <Field label="Quebra de abate (%)" {...errorProp(issues, 'slaughterLossPct')}>
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
                label="Quebra de frio / transformação (%)"
                description="Perda física no resfriamento; na estimativa também entra como acréscimo econômico sobre o preço."
                {...errorProp(issues, 'coolingTransformPct')}
              >
                <NumberInput
                  size="lg"
                  endAdornment="%"
                  value={state.quick.coolingTransformPct}
                  onValueChange={(change) => {
                    actions.patchQuick({ coolingTransformPct: change.value });
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
        </>
      )}

      <Section title="Custos">
        <Stack gap={200}>
          <div style={{ position: 'relative' }}>
            <SegmentedControl
              aria-label="Modelo da taxa de abate"
              options={[
                { value: 'perKg', label: 'Por kg' },
                { value: 'perHead', label: 'Por cabeça' },
              ]}
              value={state.costs.slaughterFeeKind}
              onValueChange={(value) => {
                actions.patchCosts({ slaughterFeeKind: value === 'perHead' ? 'perHead' : 'perKg' });
              }}
            />
          </div>
          {state.costs.slaughterFeeKind === 'perKg' ? (
            <Field label="Taxa de abate (R$/kg)" {...errorProp(issues, 'slaughterFeePerKg')}>
              <CurrencyInput
                size="lg"
                valueInMinorUnits={toMinorUnits(state.costs.slaughterFeePerKg)}
                onValueChange={(change) => {
                  actions.patchCosts({
                    slaughterFeePerKg: fromMinorUnits(change.valueInMinorUnits),
                  });
                }}
              />
            </Field>
          ) : (
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
          )}
          <Field label="Taxa de serviço (R$/suíno)" {...errorProp(issues, 'servicePerHead')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(state.costs.servicePerHead)}
              onValueChange={(change) => {
                actions.patchCosts({ servicePerHead: fromMinorUnits(change.valueInMinorUnits) });
              }}
            />
          </Field>
          <Field label="Frete / diária do motorista (R$)" {...errorProp(issues, 'freight')}>
            <CurrencyInput
              size="lg"
              valueInMinorUnits={toMinorUnits(state.costs.freight)}
              onValueChange={(change) => {
                actions.patchCosts({ freight: fromMinorUnits(change.valueInMinorUnits) });
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
