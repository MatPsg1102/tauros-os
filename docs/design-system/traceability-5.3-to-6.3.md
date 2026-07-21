# Matriz de Rastreabilidade — Catálogo Congelado 5.3 → Subetapas 6.3

Objetivo: comprovar no encerramento da milestone que nenhum componente
congelado foi omitido ou implementado duas vezes. Atualizada a cada subetapa.

## Primitivos do catálogo 5.3 (26)

| Componente 5.3   | Subetapa 6.3 | Status                                                                                                |
| ---------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Button           | 6.3.3        | Implementado (`@tauros/ui-primitives`)                                                                |
| IconButton       | 6.3.3        | Implementado                                                                                          |
| FAB              | 6.3.6        | Implementado (composição sobre Button)                                                                |
| Input            | 6.3.4        | Implementado                                                                                          |
| Select           | 6.3.4        | Implementado (nativo; variante composta = extensão futura explícita)                                  |
| Checkbox         | 6.3.4        | Implementado                                                                                          |
| Radio            | 6.3.4        | Implementado (+ RadioGroup)                                                                           |
| Switch           | 6.3.4        | Implementado                                                                                          |
| SegmentedControl | 6.3.6        | Implementado (radios nativos estilizados)                                                             |
| Tabs             | 6.3.6        | Implementado (padrão ARIA completo)                                                                   |
| NavigationBar    | 6.3.6        | Implementado (barra inferior móvel; compõe NavigationItem)                                            |
| Card             | 6.3.3        | Implementado                                                                                          |
| Dialog           | 6.3.5        | Implementado (fundação de overlays própria; Modal = variante modal)                                   |
| Drawer           | 6.3.6        | Implementado (= Dialog lateral; fundação 6.3.5)                                                       |
| BottomSheet      | 6.3.6        | Implementado (= Dialog bottom; sem gesto de arrastar — não congelado)                                 |
| Badge            | 6.3.3        | Implementado                                                                                          |
| Chip             | 6.3.3        | Implementado                                                                                          |
| Avatar           | 6.3.3        | Implementado                                                                                          |
| Tooltip          | 6.3.5        | Implementado (posicionamento compartilhado com Popover)                                               |
| Progress         | 6.3.5        | Implementado (linear det./indet.; circular indet. = Spinner 6.3.3; circular determinado não previsto) |
| Skeleton         | 6.3.3        | Implementado                                                                                          |
| Snackbar         | 6.3.5        | Implementado como Toast urgente/persistente (mesma fila — sem duplicação)                             |
| Toast            | 6.3.5        | Implementado (ToastProvider + useToast)                                                               |
| EmptyState       | 6.3.5        | Implementado (compõe Heading/Text)                                                                    |
| ErrorState       | 6.3.5        | Implementado (compõe Heading/Text; conteúdo seguro por contrato)                                      |
| LoadingState     | 6.3.5        | Implementado (compõe Spinner/Skeleton — sem duplicação)                                               |

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

## Componentes 6.3.5 adicionais (contratos da milestone 6.3)

| Componente    | Base congelada                                                         | Status               |
| ------------- | ---------------------------------------------------------------------- | -------------------- |
| Alert         | Família feedback 5.3 (persistente no fluxo)                            | Implementado (6.3.5) |
| Banner        | Família feedback 5.3 (comunicação global de alta visibilidade)         | Implementado (6.3.5) |
| Modal         | Variante modal de Dialog (decisão formal — composição, sem duplicação) | Implementado (6.3.5) |
| ConfirmDialog | Contrato especializado sobre Dialog (Confidence Before Speed)          | Implementado (6.3.5) |
| Popover       | Overlay contextual não modal (base futura de padrões compostos)        | Implementado (6.3.5) |

Fundação compartilhada (interna, não exportada): Portal, OverlayStack,
FocusScope, ScrollLock, PositioningAdapter (@floating-ui/dom isolado) —
usada por Dialog/Modal/ConfirmDialog/Tooltip/Popover.

## Componentes 6.3.6 adicionais (estruturais autorizados na ordem da 6.3)

| Componente      | Base                                                        | Status               |
| --------------- | ----------------------------------------------------------- | -------------------- |
| NavigationItem  | Unidade de navegação (Etapa 4 — telas/BottomNav)            | Implementado (6.3.6) |
| NavigationGroup | Agrupamento (Progressive Disclosure, profundidade ≤ 2)      | Implementado (6.3.6) |
| Sidebar         | Composição estrutural desktop (compõe NavigationItem)       | Implementado (6.3.6) |
| TopBar          | App bar superior por slots (≠ NavigationBar 5.3)            | Implementado (6.3.6) |
| Breadcrumb      | Trilha de localização (nav>ol, aria-current)                | Implementado (6.3.6) |
| Stepper         | Etapas conhecidas (≠ Progress/Breadcrumb/Tabs)              | Implementado (6.3.6) |
| Pagination      | Navegação paginada (links neutros OU callbacks)             | Implementado (6.3.6) |
| Menu            | Padrão semântico de menu (fundação própria + overlay 6.3.5) | Implementado (6.3.6) |
| ContextMenu     | Trigger contextual sobre a fundação de Menu                 | Implementado (6.3.6) |

## Pendências e dependências futuras registradas (não concluídas por consequência)

- Select/MultiSelect compostos: extensão explícita futura — a existência de
  Popover NÃO os conclui nem autoriza conversão (decisão formal da 6.3.4).
- Calendário visual de DatePicker/TimePicker: pendente; não incorporado na
  6.3.5 por determinação expressa.
- Progress circular determinado: não previsto no congelamento.
- Token de "measure" (largura máxima de leitura de Dialog/Popover/Toast):
  hoje medidas estruturais em ch (65ch/40ch); candidato a token futuro.
- Atraso de exibição do LoadingState: não previsto; implementado sem timers.
- Submenu (MenuSub): fora do catálogo congelado — extensão futura com contrato próprio.
- Gesto de arrastar do BottomSheet: não congelado — sem dependência de gesture.
- Colapso de itens intermediários do Breadcrumb (via Menu): registrado; caminho completo permanece acessível sem colapso.
- Long press para ContextMenu em toque: não congelado.

Regra de fechamento: ao final da 6.3, todo componente da 5.3 deve constar como
Implementado em exatamente uma subetapa.
