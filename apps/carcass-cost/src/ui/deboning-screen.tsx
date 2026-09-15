// Tela Desossa — INDICADOR COMERCIAL DA DESOSSA, independente da
// Transformação (nada daqui alimenta a Estimativa). Resultado no topo (mesma
// regra das outras telas): margem comercial em destaque com a divisão que a
// gera, a formação do valor (carcaça → + acréscimo → valor comercial) e os
// pesos. Depois a carcaça (peso e custo do kg; valor inicial derivado, só
// leitura) e os produtos em linhas
// compactas — nome + total na mesma linha, peso e R$/kg lado a lado,
// percentual derivado como informação secundária. A lista muda sem tela
// nova: "Editar" mostra o nome editável e "Remover" por linha;
// "Adicionar produto" acrescenta uma linha em branco. Barra fixa com a
// margem para acompanhar enquanto se edita as últimas linhas. A tela só
// apresenta: todo número vem do domínio via controller.

import { cssVar } from '@tauros/tokens';
import {
  Button,
  CurrencyInput,
  Divider,
  Flex,
  Grid,
  Input,
  Label,
  NumberInput,
  Section,
  Stack,
  StickyRegion,
  Surface,
  Text,
} from '@tauros/ui-primitives';
import { useId, useState, type CSSProperties, type ReactElement } from 'react';

import {
  deboningProductField,
  type DeboningProductForm,
  type DeboningProductValue,
} from '../domain/deboning.js';
import type { ValidationIssue } from '../domain/validation.js';
import type { CalculatorController, DeboningProductPatch } from '../state/use-calculator.js';
import { CostFormation, type FormationStep } from './cost-formation.js';
import { ISSUE_MESSAGES, errorProp } from './field-messages.js';
import {
  formatBRL,
  formatKg,
  formatPct,
  formatPerKg,
  formatSignedBRL,
  fromMinorUnits,
  toMinorUnits,
} from './format.js';
import { GridField } from './grid-field.js';
import { HelpButton, HelpNote, HelpSection, useHelp } from './help.js';
import { LedgerRow } from './ledger.js';
import { ScreenHeader } from './screen-header.js';

export interface DeboningScreenProps {
  readonly calc: CalculatorController;
  readonly onBack: () => void;
}

const HELP_MARGIN =
  'Valor inicial = peso da carcaça × custo do kg. Valor comercial = soma de peso × R$/kg dos produtos. Acréscimo = valor comercial − valor inicial. Margem = acréscimo ÷ valor comercial. Análise independente da Transformação: não altera a Estimativa.';
const HELP_PRODUCTS =
  'Informe o peso e o preço de venda de cada produto; o total e o percentual do peso da carcaça são calculados. Campo vazio conta como zero. “Editar” permite renomear e remover produtos.';

const CAPTION: CSSProperties = { fontSize: cssVar('emphasis-level4-size') };
const HEADLINE: CSSProperties = {
  fontSize: cssVar('emphasis-level1-size'),
  fontWeight: cssVar('emphasis-level1-weight'),
};
const STICKY_VALUE: CSSProperties = {
  fontSize: cssVar('emphasis-level3-size'),
  fontWeight: cssVar('emphasis-level3-weight'),
};

function issueMessage(issues: readonly ValidationIssue[], field: string): string | null {
  const issue = issues.find((candidate) => candidate.field === field);
  return issue === undefined ? null : ISSUE_MESSAGES[issue.code];
}

interface ProductRowProps {
  readonly index: number;
  readonly form: DeboningProductForm;
  /** Valores calculados; undefined enquanto a análise estiver pendente. */
  readonly value: DeboningProductValue | undefined;
  readonly issues: readonly ValidationIssue[];
  readonly editing: boolean;
  readonly onPatch: (patch: DeboningProductPatch) => void;
  readonly onRemove: () => void;
}

// Linha compacta: nome (+ percentual) e total em cima; "Peso [ ] R$/Kg [ ]"
// embaixo, rótulos ao lado dos campos (Label + id explícito, sem Field —
// mesma composição da Transformação). Em edição de lista o nome vira campo
// e a linha ganha "Remover"; o total desce para uma linha própria.
function ProductRow({
  index,
  form,
  value,
  issues,
  editing,
  onPatch,
  onRemove,
}: ProductRowProps): ReactElement {
  const baseId = useId();
  const weightId = `${baseId}-weight`;
  const priceId = `${baseId}-price`;
  const displayName = form.name.trim().length > 0 ? form.name : `Produto ${index + 1}`;
  const totalText = value === undefined ? '—' : formatBRL(value.totalBRL);
  const shareText =
    value === undefined || value.sharePct === null ? null : formatPct(value.sharePct / 100);
  const weightError = issueMessage(issues, deboningProductField(form.id, 'weightKg'));
  const priceError = issueMessage(issues, deboningProductField(form.id, 'pricePerKg'));

  return (
    <Surface
      role="group"
      aria-label={displayName}
      elevation="flat"
      style={{ padding: cssVar('space-inset-sm') }}
    >
      <Stack gap={50}>
        {editing ? (
          <Flex align="center" gap={100}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Input
                size="sm"
                aria-label={`Nome do produto ${index + 1}`}
                placeholder="Nome do produto"
                value={form.name}
                onChange={(event) => {
                  onPatch({ name: event.target.value });
                }}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Remover
            </Button>
          </Flex>
        ) : (
          <Flex justify="between" align="baseline" gap={100}>
            <Flex align="baseline" gap={50} style={{ minWidth: 0 }}>
              <Text role="label">{displayName}</Text>
              {shareText !== null && (
                <Text role="caption" tone="tertiary" style={CAPTION}>
                  {shareText}
                </Text>
              )}
            </Flex>
            <Text role="data" style={{ flexShrink: 0 }}>
              {totalText}
            </Text>
          </Flex>
        )}
        {/* Colunas iguais (1fr/1fr), não 2fr/3fr como na Transformação: aqui
            os pesos têm até 6 caracteres ("295,86") e o campo precisa da
            mesma largura do preço para não cortar o valor em 390 px. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto minmax(0, 1fr)',
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
            invalid={weightError !== null}
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
            invalid={priceError !== null}
            valueInMinorUnits={toMinorUnits(form.pricePerKg)}
            onValueChange={(change) => {
              onPatch({ pricePerKg: fromMinorUnits(change.valueInMinorUnits) });
            }}
          />
        </div>
        {(weightError !== null || priceError !== null) && (
          <Text role="caption" tone="secondary" style={CAPTION}>
            {weightError ?? priceError}
          </Text>
        )}
        {editing && (
          <LedgerRow
            label="Total"
            value={totalText}
            {...(shareText === null ? {} : { detail: shareText })}
          />
        )}
      </Stack>
    </Surface>
  );
}

export function DeboningScreen({ calc, onBack }: DeboningScreenProps): ReactElement {
  const { deboning: result, deboningIssues: issues, actions } = calc;
  const form = calc.state.deboning;
  const help = useHelp();
  const [editing, setEditing] = useState(false);
  // Feedback do salvar (mesmo padrão da calculadora): o mesmo snapshot não é
  // salvo duas vezes por engano; reabilita quando algo muda na análise.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const analysisKey = JSON.stringify(form);
  const alreadySaved = savedKey === analysisKey;

  const valueById = new Map(result === null ? [] : result.items.map((item) => [item.id, item]));
  const marginText =
    result === null || result.marginPct === null ? '—' : formatPct(result.marginPct / 100);
  const yieldText =
    result === null || result.weightYieldPct === null
      ? '—'
      : formatPct(result.weightYieldPct / 100);

  // Formação do valor comercial — só valores já calculados pelo domínio.
  const formationSteps: readonly FormationStep[] =
    result === null
      ? []
      : [
          {
            kind: 'start',
            label: 'Carcaça',
            value: formatBRL(result.carcassValueBRL),
            note: 'Valor inicial',
          },
          {
            kind: result.commercialGainBRL < 0 ? 'subtract' : 'add',
            label: 'Acréscimo comercial',
            value: formatSignedBRL(result.commercialGainBRL),
            note: 'Comercial − carcaça',
          },
          {
            kind: 'total',
            label: 'Valor comercial da desossa',
            value: formatBRL(result.commercialValueBRL),
            note: `${result.items.length} produtos`,
          },
        ];

  return (
    <Stack gap={200}>
      <ScreenHeader title="Desossa" onBack={onBack} />

      <Surface
        as="section"
        aria-label="Resultado comercial"
        elevation="card"
        style={{ padding: cssVar('space-inset-md') }}
      >
        <Stack gap={100}>
          <Flex justify="between" align="center" gap={100}>
            <Text role="label" tone="secondary">
              Margem comercial
            </Text>
            <HelpButton topic="margem comercial" help={help} />
          </Flex>
          <HelpNote help={help}>{HELP_MARGIN}</HelpNote>
          {result === null ? (
            <Text as="p" tone="secondary">
              Informe o peso e o custo do kg da carcaça para ver o resultado.
            </Text>
          ) : (
            <>
              <Text as="p" role="data" style={HEADLINE}>
                {marginText}
              </Text>
              <Text role="caption" tone="tertiary">
                {result.marginPct === null
                  ? 'Sem valor comercial: informe peso e preço dos produtos.'
                  : `${formatBRL(result.commercialGainBRL)} ÷ ${formatBRL(result.commercialValueBRL)}`}
              </Text>
              <Divider />
              <CostFormation label="Formação do valor comercial" steps={formationSteps} />
              <Divider />
              <Stack gap={50} role="group" aria-label="Pesos da desossa">
                <LedgerRow label="Peso da carcaça" value={formatKg(result.carcassWeightKg)} />
                <LedgerRow label="Peso dos produtos" value={formatKg(result.productsWeightKg)} />
                <LedgerRow label="Rendimento de peso" value={yieldText} note="Produtos ÷ carcaça" />
              </Stack>
            </>
          )}
        </Stack>
      </Surface>

      <Section title="Carcaça">
        <Stack gap={100}>
          <Grid columns={2} gap={100}>
            <GridField label="Peso da carcaça" {...errorProp(issues, 'carcassWeightKg')}>
              <NumberInput
                size="md"
                endAdornment="kg"
                value={form.carcassWeightKg}
                onValueChange={(change) => {
                  actions.patchDeboning({ carcassWeightKg: change.value });
                }}
              />
            </GridField>
            <GridField label="Custo do kg" {...errorProp(issues, 'carcassCostPerKg')}>
              <CurrencyInput
                size="md"
                valueInMinorUnits={toMinorUnits(form.carcassCostPerKg)}
                onValueChange={(change) => {
                  actions.patchDeboning({
                    carcassCostPerKg: fromMinorUnits(change.valueInMinorUnits),
                  });
                }}
              />
            </GridField>
          </Grid>
          {/* Valor inicial é DERIVADO (peso × custo do kg) — só leitura, nunca
              digitado; a nota mostra a conta com os números do domínio. */}
          <Stack gap={50} role="group" aria-label="Valor inicial da carcaça">
            <LedgerRow
              label="Valor inicial"
              value={result === null ? '—' : formatBRL(result.carcassValueBRL)}
              {...(result === null
                ? {}
                : {
                    note: `${formatKg(result.carcassWeightKg)} × ${formatPerKg(result.carcassCostPerKg)}`,
                  })}
            />
          </Stack>
        </Stack>
      </Section>

      <HelpSection
        title="Produtos"
        help={HELP_PRODUCTS}
        actions={
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={editing}
            onClick={() => {
              setEditing((current) => !current);
            }}
          >
            {editing ? 'Concluir' : 'Editar'}
          </Button>
        }
      >
        <Stack gap={100}>
          {form.products.length === 0 && (
            <Text as="p" tone="secondary">
              Nenhum produto na lista. Toque em “Adicionar produto”.
            </Text>
          )}
          {form.products.map((product, index) => (
            <ProductRow
              key={product.id}
              index={index}
              form={product}
              value={valueById.get(product.id)}
              issues={issues}
              editing={editing}
              onPatch={(patch) => {
                actions.patchDeboningProduct(product.id, patch);
              }}
              onRemove={() => {
                actions.removeDeboningProduct(product.id);
              }}
            />
          ))}
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              actions.addDeboningProduct();
              // A linha nova precisa de nome: entra já em modo de edição.
              setEditing(true);
            }}
          >
            Adicionar produto
          </Button>
        </Stack>
      </HelpSection>

      <Stack gap={50}>
        <Button
          variant="primary"
          fullWidth
          disabled={result === null || alreadySaved}
          onClick={() => {
            actions.saveDeboningToHistory();
            setSavedKey(analysisKey);
          }}
        >
          {alreadySaved ? 'Análise salva no histórico' : 'Salvar análise no histórico'}
        </Button>
        <div aria-live="polite">
          {alreadySaved && (
            <Text role="caption" tone="secondary">
              Análise salva. Altere algum valor para salvar de novo.
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
          aria-label="Margem atual"
        >
          <Text role="label" tone="secondary">
            Margem comercial
          </Text>
          <Text role="data" style={STICKY_VALUE}>
            {marginText}
          </Text>
        </Flex>
      </StickyRegion>
    </Stack>
  );
}
