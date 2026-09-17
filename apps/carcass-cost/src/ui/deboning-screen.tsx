// Tela Desossa — INDICADOR COMERCIAL DA DESOSSA, independente da
// Transformação (nada daqui alimenta a Estimativa). Ferramenta de ENTRADA e
// leitura rápida, não um relatório aberto: durante o preenchimento a
// hierarquia é Produto → Preço; o peso é referência secundária (vem da
// estatística de pesos e continua editável); a MARGEM é a leitura principal.
// Tudo o mais (memória de cálculo, formação do valor, pesos e rendimento,
// total e percentual de cada produto) fica disponível sob demanda:
// "Ver detalhes" no resultado e o botão de detalhes de cada produto.
// "Editar" mostra o nome editável e "Remover" por linha; "Adicionar produto"
// acrescenta uma linha em branco. Salvar abre um diálogo com nome da análise e
// data automática. Barra fixa com a margem. A tela só apresenta: todo número
// vem do domínio via controller.

import { cssVar } from '@tauros/tokens';
import {
  Button,
  ConfirmDialog,
  CurrencyInput,
  Divider,
  Field,
  Flex,
  Grid,
  IconButton,
  Input,
  Label,
  NumberInput,
  Section,
  Select,
  Stack,
  StickyRegion,
  Surface,
  Text,
} from '@tauros/ui-primitives';
import { useId, useState, type CSSProperties, type ReactElement } from 'react';

import {
  DEBONING_STATISTIC_KINDS,
  DEBONING_STATISTIC_KIND_LABELS,
  deboningProductField,
  deboningStatisticLabel,
  type DeboningProductForm,
  type DeboningProductValue,
  type DeboningStatisticKind,
} from '../domain/deboning.js';
import type { ValidationIssue } from '../domain/validation.js';
import type { CalculatorController, DeboningProductPatch } from '../state/use-calculator.js';
import { CostFormation, type FormationStep } from './cost-formation.js';
import { ISSUE_MESSAGES, errorProp } from './field-messages.js';
import {
  formatBRL,
  formatDate,
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
  'A estatística de pesos preenche o peso de cada produto (fornecedor e tipo); você informa o preço de venda. Peso continua editável. Campo vazio conta como zero. O botão de detalhes mostra peso, participação, preço e total do produto. “Editar” permite renomear e remover produtos.';

const CAPTION: CSSProperties = { fontSize: cssVar('emphasis-level4-size') };
const HEADLINE: CSSProperties = {
  fontSize: cssVar('emphasis-level1-size'),
  fontWeight: cssVar('emphasis-level1-weight'),
};
const STICKY_VALUE: CSSProperties = {
  fontSize: cssVar('emphasis-level3-size'),
  fontWeight: cssVar('emphasis-level3-weight'),
};
const GLYPH: CSSProperties = {
  fontSize: cssVar('emphasis-level5-size'),
  fontWeight: cssVar('type-role-label-weight'),
};
// Peso como referência secundária (estatística selecionada): texto menor e
// em tom secundário dentro do campo — continua visível e editável.
const WEIGHT_SECONDARY: CSSProperties = {
  fontSize: cssVar('emphasis-level4-size'),
  color: cssVar('color-text-secondary'),
};
// Uma linha por produto: nome flexível, peso estreito, preço em destaque e o
// botão de detalhes. Com estatística selecionada o peso encolhe mais ainda.
const ROW_COLUMNS_MANUAL = 'minmax(0, 1fr) 6.25rem 8rem auto';
const ROW_COLUMNS_STATISTIC = 'minmax(0, 1fr) 5rem 8rem auto';
const ROW: CSSProperties = {
  display: 'grid',
  columnGap: cssVar('space-gap-50'),
  alignItems: 'center',
  paddingBlock: cssVar('space-inset-xs'),
};

type WeightEmphasis = 'primary' | 'secondary';

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
  readonly weightEmphasis: WeightEmphasis;
  readonly onPatch: (patch: DeboningProductPatch) => void;
  readonly onRemove: () => void;
}

function ProductRow({
  index,
  form,
  value,
  issues,
  editing,
  weightEmphasis,
  onPatch,
  onRemove,
}: ProductRowProps): ReactElement {
  const baseId = useId();
  const weightId = `${baseId}-weight`;
  const priceId = `${baseId}-price`;
  const detailsId = `${baseId}-details`;
  const [showDetails, setShowDetails] = useState(false);
  const displayName = form.name.trim().length > 0 ? form.name : `Produto ${index + 1}`;
  const totalText = value === undefined ? '—' : formatBRL(value.totalBRL);
  const shareText =
    value === undefined || value.sharePct === null ? '—' : formatPct(value.sharePct / 100);
  const weightText = form.weightKg === null ? '—' : formatKg(form.weightKg);
  const priceText = form.pricePerKg === null ? '—' : formatPerKg(form.pricePerKg);
  const weightError = issueMessage(issues, deboningProductField(form.id, 'weightKg'));
  const priceError = issueMessage(issues, deboningProductField(form.id, 'pricePerKg'));
  const errorText = weightError ?? priceError;

  if (editing) {
    // Modo de lista (raro): nome editável + Remover, campos com rótulo visível.
    return (
      <Surface
        role="group"
        aria-label={displayName}
        elevation="flat"
        style={{ padding: cssVar('space-inset-sm') }}
      >
        <Stack gap={50}>
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
          {errorText !== null && (
            <Text role="caption" tone="secondary" style={CAPTION}>
              {errorText}
            </Text>
          )}
          <LedgerRow label="Total" value={totalText} detail={shareText} />
        </Stack>
      </Surface>
    );
  }

  return (
    <div role="group" aria-label={displayName} data-weight-emphasis={weightEmphasis}>
      <div
        style={{
          ...ROW,
          gridTemplateColumns:
            weightEmphasis === 'secondary' ? ROW_COLUMNS_STATISTIC : ROW_COLUMNS_MANUAL,
        }}
      >
        <Text as="p" role="label" style={{ minWidth: 0 }}>
          {displayName}
        </Text>
        <NumberInput
          id={weightId}
          aria-label="Peso"
          size="sm"
          endAdornment="kg"
          invalid={weightError !== null}
          value={form.weightKg}
          {...(weightEmphasis === 'secondary' ? { style: WEIGHT_SECONDARY } : {})}
          onValueChange={(change) => {
            onPatch({ weightKg: change.value });
          }}
        />
        <CurrencyInput
          id={priceId}
          aria-label="R$/Kg"
          size="md"
          invalid={priceError !== null}
          valueInMinorUnits={toMinorUnits(form.pricePerKg)}
          onValueChange={(change) => {
            onPatch({ pricePerKg: fromMinorUnits(change.valueInMinorUnits) });
          }}
        />
        <IconButton
          variant="ghost"
          aria-label={`Detalhes de ${displayName}`}
          aria-expanded={showDetails}
          {...(showDetails ? { 'aria-controls': detailsId } : {})}
          onClick={() => {
            setShowDetails((current) => !current);
          }}
        >
          <span aria-hidden="true" style={GLYPH}>
            i
          </span>
        </IconButton>
      </div>
      {showDetails && (
        <div
          id={detailsId}
          style={{
            paddingBlock: cssVar('space-inset-xs'),
            paddingInlineStart: cssVar('space-inset-sm'),
          }}
        >
          <Stack gap={50}>
            <LedgerRow label="Peso" value={weightText} />
            <LedgerRow label="Participação no peso" value={shareText} note="Peso ÷ carcaça" />
            <LedgerRow label="Preço" value={priceText} />
            <LedgerRow label="Total" value={totalText} />
          </Stack>
        </div>
      )}
      {errorText !== null && (
        <Text as="p" role="caption" tone="secondary" style={CAPTION}>
          {errorText}
        </Text>
      )}
      <Divider />
    </div>
  );
}

interface StatisticDraft {
  /** null = nova estatística; id = edição de fornecedor/tipo (pesos intactos). */
  readonly id: string | null;
  readonly supplier: string;
  readonly kind: DeboningStatisticKind;
}

interface SaveDraft {
  readonly name: string;
  /** Instante em que o diálogo abriu; a data exibida vem daqui. */
  readonly at: string;
}

export function DeboningScreen({ calc, onBack }: DeboningScreenProps): ReactElement {
  const {
    deboning: result,
    deboningIssues: issues,
    deboningStatistics: statistics,
    actions,
  } = calc;
  const form = calc.state.deboning;
  const help = useHelp();
  const summaryDetailsId = useId();
  const [editing, setEditing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [statisticDraft, setStatisticDraft] = useState<StatisticDraft | null>(null);
  const [saveDraft, setSaveDraft] = useState<SaveDraft | null>(null);
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
  const selectedLabel = form.statistic === null ? null : deboningStatisticLabel(form.statistic);
  const selectedStatistic =
    form.statistic === null
      ? undefined
      : statistics.find((candidate) => candidate.id === form.statistic?.id);
  // A referência pode apontar para uma estatística que já não existe na lista
  // (análise antiga reaberta): o seletor ainda mostra o rótulo guardado.
  const selectedMissing = form.statistic !== null && selectedStatistic === undefined;
  const weightEmphasis: WeightEmphasis = form.statistic === null ? 'primary' : 'secondary';
  const defaultAnalysisName = (at: string): string =>
    selectedLabel === null ? `Desossa ${formatDate(at)}` : selectedLabel;

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

      {/* Resultado: só a margem em destaque; composição e pesos sob demanda. */}
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
              {result.marginPct === null && (
                <Text role="caption" tone="tertiary">
                  Sem valor comercial: informe peso e preço dos produtos.
                </Text>
              )}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={showSummary}
                  {...(showSummary ? { 'aria-controls': summaryDetailsId } : {})}
                  onClick={() => {
                    setShowSummary((current) => !current);
                  }}
                >
                  {showSummary ? 'Ocultar detalhes' : 'Ver detalhes'}
                </Button>
              </div>
              {showSummary && (
                <Stack gap={100} id={summaryDetailsId}>
                  {result.marginPct !== null && (
                    <Text role="caption" tone="tertiary">
                      {`${formatBRL(result.commercialGainBRL)} ÷ ${formatBRL(result.commercialValueBRL)}`}
                    </Text>
                  )}
                  <Divider />
                  <CostFormation label="Formação do valor comercial" steps={formationSteps} />
                  <Divider />
                  <Stack gap={50} role="group" aria-label="Pesos da desossa">
                    <LedgerRow label="Peso da carcaça" value={formatKg(result.carcassWeightKg)} />
                    <LedgerRow
                      label="Peso dos produtos"
                      value={formatKg(result.productsWeightKg)}
                    />
                    <LedgerRow
                      label="Rendimento de peso"
                      value={yieldText}
                      note="Produtos ÷ carcaça"
                    />
                  </Stack>
                </Stack>
              )}
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
          {/* Estatística de pesos: seleciona pesos-padrão (fornecedor · tipo)
              para esta análise; "Pesos manuais" mantém os pesos como estão. */}
          <Stack gap={50} role="group" aria-label="Estatística de pesos">
            <Field
              label="Selecionar estatística"
              description={
                selectedLabel === null
                  ? 'Pesos manuais. Escolha uma estatística para preencher os pesos.'
                  : `Pesos de ${selectedLabel}. Ajuste o preço de cada produto.`
              }
            >
              <Select
                frameSize="sm"
                value={form.statistic?.id ?? ''}
                onChange={(event) => {
                  actions.applyDeboningStatistic(
                    event.target.value === '' ? null : event.target.value,
                  );
                }}
              >
                <option value="">Pesos manuais</option>
                {selectedMissing && form.statistic !== null && (
                  <option value={form.statistic.id}>{selectedLabel} (não disponível)</option>
                )}
                {statistics.map((statistic) => (
                  <option key={statistic.id} value={statistic.id}>
                    {deboningStatisticLabel(statistic)}
                  </option>
                ))}
              </Select>
            </Field>
            {statisticDraft === null ? (
              <Flex gap={100} wrap>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatisticDraft({ id: null, supplier: '', kind: 'porco-mineiro' });
                  }}
                >
                  Salvar pesos atuais como estatística
                </Button>
                {selectedStatistic !== undefined && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatisticDraft({
                        id: selectedStatistic.id,
                        supplier: selectedStatistic.supplier,
                        kind: selectedStatistic.kind,
                      });
                    }}
                  >
                    Editar estatística
                  </Button>
                )}
              </Flex>
            ) : (
              <Surface
                as="form"
                aria-label={
                  statisticDraft.id === null
                    ? 'Nova estatística de pesos'
                    : 'Editar estatística de pesos'
                }
                elevation="flat"
                style={{ padding: cssVar('space-inset-sm') }}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (statisticDraft.supplier.trim() === '') return;
                  if (statisticDraft.id === null) {
                    actions.saveDeboningStatistic(statisticDraft.supplier, statisticDraft.kind);
                  } else {
                    actions.updateDeboningStatistic(
                      statisticDraft.id,
                      statisticDraft.supplier,
                      statisticDraft.kind,
                    );
                  }
                  setStatisticDraft(null);
                }}
              >
                <Stack gap={100}>
                  <Field label="Fornecedor" required>
                    <Input
                      size="sm"
                      value={statisticDraft.supplier}
                      onChange={(event) => {
                        setStatisticDraft({ ...statisticDraft, supplier: event.target.value });
                      }}
                    />
                  </Field>
                  <Field label="Tipo/origem">
                    <Select
                      frameSize="sm"
                      value={statisticDraft.kind}
                      onChange={(event) => {
                        const kind = event.target.value;
                        if (kind === 'porco-mineiro' || kind === 'carcaca') {
                          setStatisticDraft({ ...statisticDraft, kind });
                        }
                      }}
                    >
                      {DEBONING_STATISTIC_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {DEBONING_STATISTIC_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Flex justify="end" gap={100} wrap>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setStatisticDraft(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={statisticDraft.supplier.trim() === ''}
                    >
                      {statisticDraft.id === null ? 'Salvar estatística' : 'Salvar alterações'}
                    </Button>
                  </Flex>
                </Stack>
              </Surface>
            )}
          </Stack>

          {form.products.length === 0 && (
            <Text as="p" tone="secondary">
              Nenhum produto na lista. Toque em “Adicionar produto”.
            </Text>
          )}
          {!editing && form.products.length > 0 && (
            <div
              style={{
                ...ROW,
                paddingBlock: 0,
                gridTemplateColumns:
                  weightEmphasis === 'secondary' ? ROW_COLUMNS_STATISTIC : ROW_COLUMNS_MANUAL,
              }}
              aria-hidden="true"
            >
              <Text role="caption" tone="tertiary" style={CAPTION}>
                Produto
              </Text>
              <Text role="caption" tone="tertiary" style={CAPTION}>
                Peso
              </Text>
              <Text role="caption" tone="tertiary" style={CAPTION}>
                Preço (R$/kg)
              </Text>
              <span />
            </div>
          )}
          <Stack gap={editing ? 100 : 0}>
            {form.products.map((product, index) => (
              <ProductRow
                key={product.id}
                index={index}
                form={product}
                value={valueById.get(product.id)}
                issues={issues}
                editing={editing}
                weightEmphasis={weightEmphasis}
                onPatch={(patch) => {
                  actions.patchDeboningProduct(product.id, patch);
                }}
                onRemove={() => {
                  actions.removeDeboningProduct(product.id);
                }}
              />
            ))}
          </Stack>
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
            const at = new Date().toISOString();
            setSaveDraft({ name: defaultAnalysisName(at), at });
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

      {/* Identificação antes de persistir: nome livre e data de hoje (automática). */}
      <ConfirmDialog
        open={saveDraft !== null}
        onOpenChange={(open) => {
          if (!open) setSaveDraft(null);
        }}
        title="Salvar análise"
        description="Dê um nome para encontrar esta análise no histórico."
        confirmLabel="Salvar análise"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (saveDraft === null) return;
          const name = saveDraft.name.trim();
          actions.saveDeboningToHistory(name === '' ? defaultAnalysisName(saveDraft.at) : name);
          setSavedKey(analysisKey);
        }}
      >
        {saveDraft !== null && (
          <Stack gap={100}>
            <Field label="Nome da análise">
              <Input
                value={saveDraft.name}
                onChange={(event) => {
                  setSaveDraft({ ...saveDraft, name: event.target.value });
                }}
              />
            </Field>
            <LedgerRow label="Data" value={formatDate(saveDraft.at)} />
          </Stack>
        )}
      </ConfirmDialog>

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
