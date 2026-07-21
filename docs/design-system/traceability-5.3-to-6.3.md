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

## Layout Components (6.3.7) — reconciliação formal do catálogo

| Candidato      | Decisão           | Justificativa                                                         |
| -------------- | ----------------- | --------------------------------------------------------------------- |
| AppShell       | Implementado      | Estrutura por slots; 1 região de scroll; safe areas; skip link        |
| Page           | Implementado      | Landmark main/section/div + guarda MultipleMainLandmarksError         |
| PageHeader     | Implementado      | Contexto de página (≠ TopBar); slots; heading configurável            |
| PageContent    | NÃO criado        | Atendido por Page (fluxo) + Container (largura) — sem resp. própria   |
| Container      | Implementado      | narrow=65ch (leitura), standard/wide = breakpoint tokens, full        |
| Section        | Implementado      | Região temática nomeada (aria-labelledby) ≠ Panel (superfície)        |
| Panel(+H/B/F)  | Implementado      | Contrato operacional: corpo rolável independente, fill — ≠ Card       |
| ResponsiveGrid | Implementado      | auto-fit por medida mínima (CSS puro) — ≠ Grid (colunas explícitas)   |
| DashboardGrid  | NÃO criado        | Layout System não define widgets/spans — atendido por ResponsiveGrid  |
| SplitView      | Implementado      | Split estático responsivo; sem resize (não congelado)                 |
| MasterDetail   | NÃO criado        | = SplitView; alternância lista/detalhe pertence à aplicação/rota      |
| StackedLayout  | NÃO criado        | = Stack (primitive 6.3.3)                                             |
| StickyRegion   | Implementado      | Sticky tokenizado (z-sticky), safe area bottom, contrato de ancestral |
| ScrollArea     | NÃO criado        | = overflow por CSS/PanelBody; sem scrollbar customizada               |
| Inset          | NÃO criado        | = Box padding (primitive 6.3.3)                                       |
| Cluster        | NÃO criado        | = Flex wrap (primitive 6.3.3)                                         |
| SkipLink       | Parte do AppShell | Necessário com navegação antes do main; âncora pura, sem roteador     |

Divergência registrada: família implementada em `ui-primitives/src/layouts/`
(folha única + precedente aprovado 6.3.4–6.3.6); o pacote `@tauros/ui-layouts`
permanece scaffold reservado para composições de nível de aplicação que
hospedam componentes operacionais/infra via slots (regra layouts-organize-only).

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
- Token de "measure" (formalizado na 6.3.7): narrow/standard/wide do Container
  usam 65ch + breakpoint tokens; medidas de item do ResponsiveGrid (20/30/40ch)
  e larguras de Sidebar/Drawer/Menu (24–40ch) na mesma família — proposta de
  token semântico preparada para a auditoria final (6.3.9), sem alterar tokens
  congelados agora.
- maxColumns do ResponsiveGrid: fora do contrato (auto-fit puro não expressa
  cap sem hacks) — extensão futura se o Layout System exigir.

Regra de fechamento: ao final da 6.3, todo componente da 5.3 deve constar como
Implementado em exatamente uma subetapa.

## Cobertura de Storybook (6.3.8)

Contrato executável em `apps/storybook` (Storybook 8.6, react-vite): stories
consomem exclusivamente a API pública (regras depcruise storybook-no-backend e
storybook-public-imports-only; `exports` do pacote bloqueia deep import).
Toolbar de modos usa o ThemeProvider real (storage noop, sistema estático);
folha oficial injetada explicitamente no preview. Teste vitest compõe TODAS as
stories com as anotações reais (smoke render + play + axe por story).

| Família    | Módulos de stories                            | Cobertura                                                      |
| ---------- | --------------------------------------------- | -------------------------------------------------------------- |
| Foundation | tokens, theme                                 | Rampas/tipos/espaço/z + amostra de runtime modes               |
| Primitives | actions, typography, surfaces-status, loading | 19 componentes (estruturais demonstrados em composição)        |
| Forms      | text-inputs, numeric, selection, datetime-pin | 14 componentes + Field (nativos preservados; PIN fictício)     |
| Feedback   | messages, toast, overlays, tooltip-popover    | 13 componentes (colisão de bordas; falha segura do Confirm)    |
| Navigation | items-structures, wayfinding, overlays        | 15 componentes (teclado via play; ContextMenu nas bordas)      |
| Layouts    | appshell, structure                           | 9 componentes (scroll único, larguras, sticky, mestre–detalhe) |
| Patterns   | patterns                                      | 6 composições demonstrativas sem domínio                       |

Achado corrigido pelo contrato executável: Button em loading perdia o nome
acessível (visibility:hidden no conteúdo) — corrigido para opacity na folha.

## Auditoria final (6.3.9) — classificação das pendências e congelamento

### Pendências acumuladas — decisão formal

| Pendência                               | Classificação                  | Justificativa                                                                                                                             |
| --------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Token "measure" (20/24/30/40/65ch)      | adiada (candidata à próxima)   | Materializar exige grupo novo em ResolvedTheme (mudança estrutural em tokens congelados); valores permanecem centralizados na folha única |
| letter-spacing de títulos de grupo      | adiada (candidata à próxima)   | Mesmo motivo; hoje usa token de espaço documentado                                                                                        |
| Snackbar como configuração de Toast     | resolvida (aprovada 6.3.5)     | Uma fila, sem infraestrutura concorrente                                                                                                  |
| Drawer/BottomSheet remanejados p/ 6.3.6 | resolvida                      | Implementados sobre a fundação de Dialog                                                                                                  |
| TopBar ≠ NavigationBar                  | resolvida (documentada)        | App bar superior ≠ navegação inferior móvel (5.3)                                                                                         |
| Componentes de layout não criados       | não necessária                 | Equivalências mecânicas registradas (PageContent, DashboardGrid, etc.)                                                                    |
| MenuSub                                 | fora de escopo (catálogo)      | Extensão futura com contrato próprio                                                                                                      |
| Breadcrumb collapse (via Menu)          | adiada                         | Caminho completo permanece acessível sem colapso                                                                                          |
| BottomSheet drag                        | fora de escopo (não congelado) | Sem dependência de gesture                                                                                                                |
| Long press (ContextMenu)                | fora de escopo (não congelado) | Clique secundário + Shift+F10 + tecla contextual cobrem o contrato                                                                        |
| Toast visibilitychange                  | adiada                         | Não congelado; robustez opcional sem evidência de necessidade                                                                             |
| inert em ancestrais                     | não necessária (documentada)   | Contenção de foco + aria-modal + backdrop cumprem o contrato; reavaliar com testes de leitor de tela reais                                |
| maxColumns do ResponsiveGrid            | adiada                         | auto-fit puro não expressa cap sem hacks                                                                                                  |
| SplitView resize                        | fora de escopo (não congelado) | Split estático responsivo é o contrato                                                                                                    |
| Zoom 200/400% automatizado              | adiada (protocolo manual)      | Registrado abaixo; sem automação confiável local                                                                                          |

Nenhuma pendência é bloqueante.

### Allowlist do scanner — auditoria entrada a entrada

| Entrada | Razão                                                  | Removível?                     |
| ------- | ------------------------------------------------------ | ------------------------------ |
| 1px     | Espessura de borda/divider (sem token de border-width) | Não (candidata a token futuro) |
| 2px     | Focus ring congelado (alias 2px/2px) + glifos de check | Não                            |
| -1px    | Técnica visually-hidden + ajuste de glifo              | Não                            |
| 0s      | Parada de animação sob prefers-reduced-motion          | Não                            |
| 0px     | Fallback estrutural de getComputedStyle (scroll lock)  | Não                            |

Nenhuma entrada ampla; nenhuma ampliação na auditoria.

### Correções da auditoria

1. **box-sizing: border-box universal na folha oficial** — achado REAL de
   navegador: Drawer (100% + inset) estourava a viewport em 48px sob
   content-box. Verificado ao vivo antes (860>812) e depois (812=812).
2. **Story de Spacer** — único componente sem story (lacuna de cobertura).
3. **Segurança de devDependencies** — vitest 2→3.2.7 e vite ≥6.4.3 + override
   de uuid: pnpm audit passou de 6 avisos (1 crítico, 1 alto — todos
   dev-servers, produção limpa) para ZERO. Suíte completa verde após upgrade.
4. Testes permanentes novos: inventário exato da API pública (88+10+2+7),
   donos de safe-area por seletor, regressão do nome acessível em loading,
   cobertura story-por-componente mecânica.

### Protocolo de navegador real executado (Chromium via Storybook dev)

Verificado por geometria (getBoundingClientRect/getComputedStyle):
Button loading (nome/altura 64px/largura preservada) · modos combinados
dark+industrial+glove (controlMin 64→72px real) · Tooltip flip no topo +
aria-describedby + hover com atraso tokenizado · Popover na borda (viewport,
foco entra/restaura, Escape) · ContextMenu na borda inferior (flip para cima,
typeahead, nativo prevenido só na área) · Drawer direito (ancoragem, scroll
lock liga/solta, altura exata pós-fix) · AppShell desktop 1280 e mobile 375
(scroll único, sidebar↔navbar, alvos 64px, sem scroll horizontal).
NÃO executado (protocolo manual registrado): zoom 200/400%, leitores de tela,
dispositivo físico com notch — itens de verificação humana pré-produção.

### Governança — estabilidade

Famílias tokens/theme/primitives/forms/feedback/navigation/layouts/storybook:
critérios de congelamento atendidos (API auditada por teste de inventário,
a11y automatizada verde, SSR/hidratação testados, cobertura de stories
mecânica, fronteiras mecânicas). Estabilidade: **stable (design-system-v1.0)**.
