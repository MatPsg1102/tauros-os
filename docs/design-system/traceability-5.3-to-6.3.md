# Matriz de Rastreabilidade — Catálogo Congelado 5.3 → Subetapas 6.3

Objetivo: comprovar no encerramento da milestone que nenhum componente
congelado foi omitido ou implementado duas vezes. Atualizada a cada subetapa.

## Primitivos do catálogo 5.3 (26)

| Componente 5.3   | Subetapa 6.3 | Status                                                           |
| ---------------- | ------------ | ---------------------------------------------------------------- |
| Button           | 6.3.3        | Implementado (`@tauros/ui-primitives`)                           |
| IconButton       | 6.3.3        | Implementado                                                     |
| FAB              | 6.3.6        | Pendente (navegação/ação flutuante)                              |
| Input            | 6.3.4        | Em implementação                                                 |
| Select           | 6.3.4        | Em implementação                                                 |
| Checkbox         | 6.3.4        | Em implementação                                                 |
| Radio            | 6.3.4        | Em implementação                                                 |
| Switch           | 6.3.4        | Em implementação                                                 |
| SegmentedControl | 6.3.6        | Pendente (padrão de navegação/filtro)                            |
| Tabs             | 6.3.6        | Pendente                                                         |
| NavigationBar    | 6.3.6        | Pendente                                                         |
| Card             | 6.3.3        | Implementado                                                     |
| Dialog           | 6.3.5        | Pendente (feedback/overlay)                                      |
| Drawer           | 6.3.5        | Pendente                                                         |
| BottomSheet      | 6.3.5        | Pendente                                                         |
| Badge            | 6.3.3        | Implementado                                                     |
| Chip             | 6.3.3        | Implementado                                                     |
| Avatar           | 6.3.3        | Implementado                                                     |
| Tooltip          | 6.3.5        | Pendente (overlay)                                               |
| Progress         | 6.3.5        | Pendente (Spinner 6.3.3 cobre a variante indeterminada circular) |
| Skeleton         | 6.3.3        | Implementado                                                     |
| Snackbar         | 6.3.5        | Pendente                                                         |
| Toast            | 6.3.5        | Pendente                                                         |
| EmptyState       | 6.3.5        | Pendente                                                         |
| ErrorState       | 6.3.5        | Pendente                                                         |
| LoadingState     | 6.3.5        | Pendente (compõe Spinner/Skeleton 6.3.3)                         |

## Primitivos estruturais/tipográficos autorizados na ordem da 6.3 (sem correspondente nomeado na 5.3)

| Componente | Subetapa | Justificativa                                             |
| ---------- | -------- | --------------------------------------------------------- |
| Box        | 6.3.3    | Base estrutural autorizada explicitamente na ordem da 6.3 |
| Stack      | 6.3.3    | idem                                                      |
| Flex       | 6.3.3    | idem                                                      |
| Grid       | 6.3.3    | idem                                                      |
| Spacer     | 6.3.3    | idem                                                      |
| Divider    | 6.3.3    | idem                                                      |
| Text       | 6.3.3    | Materializa `type.role` dos tokens congelados             |
| Heading    | 6.3.3    | Materializa hierarquia de informação (emphasis 1–5)       |
| Label      | 6.3.3    | Rótulo de controle (base dos Form Components 6.3.4)       |
| Icon       | 6.3.3    | Contrato tipado (sem biblioteca embutida)                 |
| Surface    | 6.3.3    | Materializa elevation tokens                              |
| Spinner    | 6.3.3    | Indicador indeterminado (ver Progress/LoadingState 6.3.5) |

## Form Components autorizados na 6.3.4 (extensões da família Input/Select da 5.3)

| Componente 6.3.4 | Origem no congelamento                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| Input            | 5.3 Input                                                                 |
| TextArea         | Família Input (entrada de texto multilinha)                               |
| NumberInput      | Família Input (entrada numérica — telas operacionais de pesagem/contagem) |
| CurrencyInput    | Família Input (valores financeiros — SAS: precificação)                   |
| SearchInput      | Família Input (busca de catálogo/telas de listagem)                       |
| Select           | 5.3 Select                                                                |
| MultiSelect      | Família Select (filtros multivalor das telas da Etapa 4)                  |
| Checkbox         | 5.3 Checkbox                                                              |
| Radio            | 5.3 Radio                                                                 |
| RadioGroup       | 5.3 Radio (contrato de agrupamento)                                       |
| Switch           | 5.3 Switch                                                                |
| DatePicker       | Família Input (datas civis — vigência, validade, agenda)                  |
| TimePicker       | Família Input (horários — turnos, agenda)                                 |
| PinInput         | Sessões de operador com PIN (SAS/RA-QUEUE-01, ADR de sessão)              |

Regra de fechamento: ao final da 6.3, todo componente da 5.3 deve constar como
Implementado em exatamente uma subetapa.
