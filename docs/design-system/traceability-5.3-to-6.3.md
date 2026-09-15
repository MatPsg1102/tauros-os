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

## Etapa 7.1 — Vertical Slice: Abertura de Turno (fundação funcional)

Reconciliação: "Abertura de Turno" = abertura de **OperatorSession** (modelo
congelado operator_sessions; ShiftOccurrence é a escala). Framework: Next 15
App Router em apps/web (scaffold oficial). Capability oficial única:
`session.open` (constante em @tauros/contracts + migration aditiva
20260721160000 — aplicação junto do deploy do backend real).

| Camada       | Entrega                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| domain       | decideOpenSession puro (invariante 1 ACTIVE por loja+funcionário; idempotência por chave; data operacional canônica) |
| contracts    | ports (clock/id/policy/repo/queue/audit), record serializável, capability                                            |
| application  | OpenOperatorSessionUseCase (ADR-018 revalida; ADR-019 via port; enqueue→save→audit com recuperação)                  |
| wiring (web) | adapters sobre a infra congelada; DB local próprio tauros-app-state v1; transporte fake contratual                   |
| UI (web)     | /turno com AppShell/PageHeader/PinInput/estados operacionais; view model único                                       |

Decisão ADR-020 registrada: confirmação simples ⇒ composição React explícita
(sem UI Metadata Engine neste slice — sem campos parametrizáveis).

Regras mecânicas novas: web-ui-no-infrastructure (UI só fala com contratos;
wiring é o composition root) e core-no-react (domain/application/contracts
nunca importam React/Next).

Pendências 7.1: backend/transport real (Edge Function) substituindo o fake;
aplicação do seed session.open no banco; identidade real (fixtures dev
bloqueadas em produção); fechamento de turno (próximo slice).

## Etapa 7.2 — Fechamento de Turno + Quadro de Tarefas do Dia

Reconciliação: o schema congelado JÁ expressa o fechamento (`closed_at`,
`client_closed_at`, `closed_offline`, `session_status`, `session_end_reason`) —
nenhuma migration estrutural foi necessária. Tarefas usam a cadeia oficial
`task_templates → daily_tasks → task_executions`.

**Divergência resolvida com decisão do responsável:** o escopo pedia "iniciar
tarefa" e "tarefa bloqueada", que NÃO existem no modelo congelado
(`daily_task_status` = PENDING|DONE|OVERDUE|SKIPPED; execução é append-only).
Decisão: **ficar no modelo oficial** — sem estado intermediário, sem BLOCKED,
sem ADR de ampliação. "Adiar" usa SKIPPED; OVERDUE é derivado de `due_at`.

| Camada       | Entrega                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| contracts    | `CAPABILITY_SESSION_CLOSE`; `LocalSyncStatus` único; registro de sessão ampliado (fechamento); `daily-task/` (record+ports) |
| domain       | `decideCloseSession` (só ACTIVE fecha; replay idempotente) e `decideTaskOutcome` + `isOverdue` (transições oficiais)        |
| application  | `CloseOperatorSessionUseCase`, `LoadDailyTasksUseCase` (materialização idempotente), `RecordTaskOutcomeUseCase`             |
| wiring (web) | app-state v1→v2 ADITIVO; `LocalDailyTaskRepository` (append-only); enfileiramento de fechamento e execução com DAG          |
| UI (web)     | `/turno` com fechamento por ConfirmDialog + acesso ao quadro; `/turno/tarefas` (novo) com estados explícitos                |
| view models  | `useShiftClosing`, `useDailyTasks`; operador ativo elevado a contexto de cliente (ADR-018A §4)                              |

Chaves de idempotência determinísticas (sem timestamp):
`session-close:{store}:{session}:{device}` e
`task-complete|task-skip:{store}:{dailyTask}:{operator}`.

Configuração: o catálogo congelado NÃO possui chaves de tarefa. A política de
tarefa vem das colunas oficiais (`requires_photo`, `expected_min/max`,
`due_at`); o fechamento usa `session.absoluteMaxMs` e `session.reauthOnAbsolute`.
Nenhuma chave nova foi criada.

Auditoria: fechamento usa o tipo oficial `auth.session.ended` (negação =
`access.denied`); execuções de tarefa são auditadas pelo outbox durável via
ponte da fila (`offline.operation.*`) — nenhum tipo de evento inventado.
PIN, evidência e segredos nunca entram no registro.

Migrations/seeds: `20260721170000_seed_session_close_permission.sql` (aditiva,
idempotente, forward-only). Não aplicada em banco remoto nesta etapa; entra no
MESMO plano de deploy do seed pendente de `session.open` (20260721160000).

Testes: 36 de domínio, 37 de aplicação, 10 verticais (fechamento offline→fila→
reload→reconexão→synced; conflitos que preservam o local; replay sem
duplicação; DAG), 1 de upgrade do banco local em IndexedDB real
(fake-indexeddb) e 15 de UI (fechamento, quadro, offline, conflito, permissão
negada, axe). Achados REAIS corrigidos pelos testes: (1) a aplicação alimentava
o domínio com `workDate` vazio quando a tarefa não existia, mascarando
TASK_NOT_FOUND; (2) o `onOpenChange` do ConfirmDialog apagava a fase de
"fechado" ao emitir o fechamento do diálogo após a confirmação.

Pendências 7.2 (registradas, não bloqueantes):

- Reconciliação do id local de `daily_tasks` com o id gerado no servidor —
  hoje a materialização é local e determinística.
- Evidência: `hasEvidence` é projeção local; a linha em `attachments` e o
  upload do binário chegam com o backend real.
- Fechamento automático por `session.absoluteMaxMs`/EXPIRED: a política é
  resolvida e carregada, mas o disparo automático não é deste slice.
- `resolvedShiftId` (ShiftOccurrence) não é preenchido pelo cliente — projeção
  do servidor.
- Transporte real (Edge Function) e identidade real seguem pendentes da 7.1.

## Área do Encarregado — Supervisor Dashboard (gestão e acompanhamento de tarefas)

Reconciliação: o schema congelado NÃO atribui tarefa a funcionário — a
unidade oficial é a POSIÇÃO (`task_templates.target_position_id` →
`operational_positions`; funcionários ocupam posições via
`employee_assignments`). Decisão do responsável: **atribuição por posição**,
com a UI mostrando os funcionários que a ocupam hoje. `description` e
`priority` não existem na cadeia congelada — campos derrubados do formulário.

Capabilities: **nenhuma string nova**. A RLS congelada já governa a escrita de
`task_templates` com `config.write` (TaskTemplate é dado configurável,
ADR-019) — decisão do responsável. `CAPABILITY_CONFIG_WRITE` exportada de
@tauros/contracts como fonte única; o transporte fake revalida o snapshot como
o servidor faria (defesa em profundidade comprovada por teste).

| Camada       | Entrega                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| contracts    | `task-template/` (record + ports), `TeamDirectoryPort` (posições + atribuições vigentes), `CAPABILITY_CONFIG_WRITE` |
| domain       | `decideCreateTemplate` puro (título, atribuição por posição, horário no dia, faixa coerente; replay idempotente)    |
| application  | `CreateTaskTemplateUseCase` (ADR-018 revalida; enqueue→save→audit) + `storeDayStartFor` (base única de vencimento)  |
| wiring (web) | app-state v2→v3 ADITIVO (`task_templates`); `CompositeTaskTemplateSource` (fixtures + criadas localmente)           |
| UI (web)     | `/encarregado`: PIN → painel (resumo, filtros por situação e funcionário, lista) → Drawer "+ Nova tarefa"           |
| view model   | `useSupervisorDashboard` (fases discriminadas: painel + criação)                                                    |

Base de vencimento unificada: `dueOffsetMinutes` passa a contar da MEIA-NOITE
civil da loja (`storeDayStartFor`) nos DOIS quadros (operador e encarregado) —
antes contava da abertura do turno; fixtures ajustadas para horários do dia.

Idempotência determinística:
`task-template-create:{store}:{data}:{criador}:{posição}:{slug-do-título}` —
duplo clique, retry e resposta perdida convergem para UMA criação.

Auditoria: `config.changed` (tipo oficial) na criação; `access.denied` na
negação; ciclo de sync pelo outbox via ponte da fila. PIN da fixture (Elber,
dev-only) comparado só em memória e descartado — teste comprova que não entra
em fila, auditoria, IndexedDB nem localStorage.

Fixtures (dev, bloqueadas em produção): Elber (session.open + session.close +
config.write + audit.read — encarregado TAMBÉM é operador: abre e fecha o
próprio turno; correções pós-merge: a fixture original omitia session.open e
depois session.close, e as telas negavam corretamente por permissões efetivas,
ADR-018 — nenhuma exceção por nome/cargo foi criada, as capabilities vieram da
fixture e o domínio permaneceu intacto), posições Atendimento/Produção/Apoio e
atribuições vigentes da equipe; Elber não ocupa posição atribuível. Tarefa
criada pelo encarregado aparece no quadro do OPERADOR no mesmo aparelho (fonte
composta — comprovado por teste).

Conexão do painel ao fluxo de entrada (pós-merge): a Área do Encarregado
existia e funcionava, mas NENHUMA navegação levava até ela (`/` → `/turno`,
tela idêntica para todos os perfis — o encarregado só chegava digitando a
URL). Correção mínima: o view model de `/turno` passou a entregar a decisão
pronta `canManageTeam` (capability oficial da área, ADR-018) e a tela expõe a
entrada "Ir para a Área do Encarregado" via adapter de navegação — o
componente de navegação não contém regra de permissão e nada depende de
nome/cargo. Operador comum não ganhou a entrada (comprovado por teste).
Complementos do review adversarial: painel ganhou "Voltar ao turno" (mesma
convenção do quadro), o boot de `/turno` restaura a identificação do CONTEXTO
(ida e volta /turno ↔ /encarregado sem repetir PIN — regra que o quadro já
seguia) e o estado expirado do painel ganhou a ação "Identificar novamente"
(antes era beco sem saída em PWA instalado).

Correção funcional do perfil do encarregado (pós-merge): o painel
`/encarregado` passou a expor o TURNO do próprio encarregado — status
(nenhum/aberto/fechado, local × servidor), "Abrir turno" e "Fechar turno" com
confirmação e progressive disclosure (nunca as duas ações juntas) — reusando
os MESMOS `OpenOperatorSessionUseCase`/`CloseOperatorSessionUseCase` da rota
`/turno` (nenhum use case novo, nenhuma regra duplicada). O view model agora
entrega DECISÕES prontas (`permissions.canOpenShift/canCloseShift/
canCreateTask/canViewTeamTasks`) derivadas das permissões efetivas — a UI não
recalcula capability. Jornada vertical coberta por teste (PIN → abrir →
criar/atribuir a outra posição com horário → quadro → fechar) atravessando
UI→controller→application→domain→persistência→auditoria→fila, com o snapshot
enfileirado provando o perfil completo.

Testes: 11 domínio + 16 aplicação + 7 verticais + 13 UI + 1 upgrade v2→v3.

Pendências (registradas, não bloqueantes):

- Detalhe da tarefa em overlay próprio (visualização hoje é inline no card;
  "criada por" vive só na auditoria — o schema não tem created_by).
- Diretório real de equipe (employees/assignments do backend) substituindo a
  fixture; multi-encarregado real via PermissionResolver.
- Edição/cancelamento de definição criada (fora do escopo: acompanhar+criar).

## Gestão de Equipe V1 — colaboradores, funções/posições e Equipes A/B

Vertical slice sobre o schema congelado SEM nenhuma migration: `employees`,
`employee_assignments`, `teams` e `operational_positions` já existiam desde a
init — o trabalho foi ligá-los ao app. Reconciliação formal de linguagem:
"Açougueiro 1/2/3, Auxiliar de açougue, Operador de caixa, Faxineira" SÃO
posições operacionais (`operational_positions`, o mesmo conceito de
`target_position_id` das tarefas) — nenhum conceito paralelo (JobRole) foi
criado. Equipe A/B são LINHAS de `teams` (ids fixos `team-a`/`team-b`), nunca
enum nem sufixo no nome da posição; o vínculo temporal
(`employee_assignments.validFrom`, equipe + posição em campos separados) é o
que a Escala Operacional V1 consumirá — equipe ≠ presença, nenhuma presença
foi inventada.

Permissões (ADR-018): cadastrar colaborador é RH operacional, NÃO
configuração — nova capability oficial `workforce.write` (mesmo mecanismo,
nenhuma mudança estrutural no modelo; PERMISSION_MODEL_VERSION inalterada).
Criar posição É configuração (comentário ADR-019 do próprio schema congelado)
— reutiliza `config.write`, mesma capability de task_templates. Auditoria com
tipos OFICIAIS do catálogo: `admin.action` (colaborador), `config.changed`
(posição), `access.denied` (negações). A UI recebe decisões prontas
(`canRegisterEmployee`, `canCreatePosition`); fixture do encarregado ganhou
`workforce.write` na fronteira existente.

Implementação: contracts (records espelhando o schema + WorkforceRepository/
Enqueue/Audit ports) → domínio puro (`decideRegisterEmployee`,
`decideCreatePosition`) → use cases (`RegisterEmployeeUseCase`,
`CreateOperationalPositionUseCase`) com idempotência determinística
(pessoa+dia+criador; posição = chave natural `storeId:key` do unique
congelado — nome repetido CONVERGE) e ordem fila→local→auditoria com
recuperação de boot pela fila. IndexedDB `tauros-app-state` v4 (aditiva, 4
stores novos; upgrade v3→v4 coberto por teste). Cadastro atômico
pessoa+vínculo na mesma transação local. `registration` (unique congelado)
recebe placeholder = id até o vertical administrativo. Baseline idempotente
no boot (Equipes A/B + 6 posições reais) vive em `workforce-baseline.ts` —
catálogo inicial da loja, NÃO fixture de identidade; migra para os seeds
oficiais quando o backend real chegar.

Integração com tarefas SEM ampliar escopo: `CompositeTeamDirectory` (mesmo
padrão do CompositeTaskTemplateSource) compõe fixtures de demonstração + o
cadastro real — colaborador e posição novos aparecem imediatamente nos
seletores de "+ Nova tarefa"/atribuição. `LocalTeamDirectory.members()` expõe
posição VIGENTE por data (vigência de vínculo, não escala). UI: seção
"Equipe" na MESMA rota `/encarregado` (abas Colaboradores | Posições |
Equipes, drawers no padrão existente, mobile-first). Correção de DS na raiz:
`.t-segmented` não quebrava linha e estourava a viewport em 390px (defeito
pré-existente do filtro de 5 opções) — `flex-wrap` no stylesheet oficial,
sem mudança de API. Drawers novos NÃO apagam o formulário em erro de
validação (reset só na abertura); o padrão antigo do CreateTaskDrawer foi
mantido intocado.

Validação: 8 domínio + 13 aplicação + 11 verticais de UI (capability
negativa, double-submit, reload, offline→sincronização convergente, PIN fora
de fila/auditoria/storage, axe) + upgrade v3→v4; jornada completa em Chrome
real via CDP (cadastro, composição, nova posição refletida na nova tarefa,
reload com IndexedDB real, 390px sem overflow — delta 0px).

Pendências (registradas, não bloqueantes):

- Escala Operacional V1 (próxima vertical): padrão 12x36 A/B, ocorrências/
  exceções, presença oficial do dia via ShiftOccurrence, tarefas "quando
  estiver escalado" consultando presença — substitui a FixtureShiftSchedule
  e o rótulo "Equipe de hoje" por dados reais.
- Colaborador cadastrado ainda NÃO é identidade autenticável (sem profile/
  membership/PIN) — chega com identidade real + backend; fixtures de
  identidade continuam centralizadas em fixtures.ts.
- Matrícula real (`registration`), edição/desativação de colaborador e de
  posição (schema não tem `active` em operational_positions — desativação
  pedirá decisão formal), remoção das fixtures de demonstração do diretório
  composto quando o diretório real assumir.
- Baseline de equipes/posições migra para seeds oficiais do banco junto do
  backend real (Equipe A/B precisam existir no servidor antes do primeiro
  sync de employee_assignments).

## Escala Operacional V1 — jornadas, padrões por loja e presença planejada

Reconciliação: o schema congelado de shifts JÁ modelava quase tudo —
`ShiftDefinition` É a jornada (janela HH:MM), `ShiftPattern`+`ShiftPatternDay`
É o padrão de escala como DADO cíclico genérico (`works` por `dayIndex` —
nunca enum fechado), `stores.shift_anchor_date` É a âncora da rotação, e
`ShiftOccurrence`/`ShiftOverride` ficam reservados para exceções/trocas
(extensão futura registrada; nenhum workaround em task assignment). Nenhuma
entidade paralela foi criada (sem WorkPeriod/WorkSchedule novos).

Migration ADITIVA mínima (20260813210000, 4 colunas, zero tabela nova):
`employee_assignments.shift_definition_id` (JORNADA pertence ao VÍNCULO —
equipe nunca define horário; pessoas da mesma equipe têm janelas diferentes),
`teams.rotation_offset` (posição da equipe no ciclo do padrão da loja) e
`shift_patterns.effective_from/effective_until` (vigência — troca de escala
sem reescrever histórico). Lacunas comprovadas antes de migrar; forward-only.

Separação obrigatória de conceitos mantida em contrato: colaborador ≠
posição ≠ equipe ≠ jornada ≠ padrão ≠ vigência ≠ presença planejada. O read
model chama-se `Planned*` em TODOS os contratos — presença PLANEJADA
("deveria trabalhar") nunca se confunde com presença REAL (comparecimento/
falta/atestado são vertical futura; nenhum falso sistema de ponto).

Fonte oficial ÚNICA: `resolvePlannedDay` (domínio puro) resolve por
loja + data operacional + configuração DA LOJA (padrão vigente por vigência,
âncora, offsets das equipes, vínculos vigentes) — 12x36 é apenas o PRIMEIRO
DADO desta operação (`pattern-12x36` = ciclo [trabalha, folga] no baseline);
semanal/dias fixos são outros registros, comprovados por teste com o MESMO
resolver em loja diferente (anti-acoplamento multiloja). Nenhum `% 2`
espalhado: módulo do ciclo vive só no resolver; UI e tarefas nunca calculam
escala. `currentAssignmentFor` é a regra única de vigência de vínculo
(compartilhada por resolver, troca de jornada e diretório de equipe).
`LoadPlannedScheduleUseCase` projeta nomes/janelas; a aba Escala consome só
o use case.

Jornadas: seeds EDITÁVEIS 07:30–19:30 e 08:30–20:30 (dados no baseline,
nunca hardcode em UI); "+ Novo horário" cria janelas novas
(`CreateShiftDefinitionUseCase`, chave natural loja+janela converge,
config.write por ADR-019 — mesmo racional de posições; auditoria
config.changed). Troca de jornada do colaborador =
`ChangeEmployeeWorkPeriodUseCase` (workforce.write; fecha vínculo na véspera
e abre novo — histórico por vigência; auditoria admin.action; DAG depende de
jornada/cadastro pendentes offline). Cadastro de colaborador ganhou o select
"Horário de trabalho" (default = primeira jornada cadastrada — dado).
NENHUMA capability nova: config.write e workforce.write cobrem semanticamente
(sem lacuna RBAC; modelo intacto).

Local-first: app-state v5 ADITIVA (stores shift_definitions/shift_patterns;
upgrade v4→v5 testado); fila/auditoria/snapshot/reconciliação reutilizadas
(nenhuma fila nova); transporte fake ganhou os cenários contratuais das
entidades novas. FixtureShiftSchedule NÃO foi removida: segue exclusiva da
materialização legada de templates (WHEN_SCHEDULED) até a vertical de
recorrência trocar o adapter pelo resolver real — substituição gradual
registrada, sem big-bang; a UI/read model novos usam SÓ a fonte oficial.

Validação: 27 domínio (rotação, âncora retroativa, vigência, semanal, dias
fixos, multiloja, troca de jornada) + 9 aplicação + 9 verticais de UI
(mesma equipe/jornadas distintas, novo horário reutilizável+convergente,
aba Escala hoje+rotação, offline→sync, upgrade, axe) + jornada em Chrome
real (5 cenários + reload + 390px delta 0px).

Pendências (registradas, não bloqueantes):

- Recorrência "quando estiver escalado" consumindo o resolver real (troca da
  FixtureShiftSchedule) + seletor de atribuição mostrando só escalados do
  dia — próxima vertical de tarefas.
- Editor de padrão de escala na UI (criar/trocar padrão, alterar vigência/
  offsets/âncora) — hoje o padrão vigente é exibido; configuração chega por
  dados. Exceções/trocas/folgas via ShiftOccurrence/ShiftOverride.
- Edição de jornada de colaborador na UI (use case pronto e testado;
  ChangeEmployeeWorkPeriodUseCase exposto no container).
- Múltiplas equipes escaladas no MESMO dia esbarram no unique
  (storeId, workDate) de shift_occurrences quando a materialização chegar —
  decisão formal futura se a operação exigir.
- Sync real das entidades novas (Edge Function) + shift_anchor_date vindo do
  cadastro real da loja (hoje: dado da loja fixture).

## Recorrência de Tarefas V1 — WHEN_SCHEDULED real + atribuição a escalados

Reconciliação: o planejamento recorrente JÁ existia do PR #25 (ONCE |
WEEKDAYS | WHEN_SCHEDULED em `shouldMaterialize`, effectiveFrom, início/fim
planejados com fim > início, responsável opcional exceto em WHEN_SCHEDULED,
materialização idempotente por id determinístico
`daily-task:store:date:template`, atribuição situacional que nunca toca o
template, bug do foco corrigido na raiz com teste de regressão). Esta
vertical fechou o que faltava — SEM pipeline nova, SEM engine, SEM migration,
SEM capability nova:

1. `PlannedScheduleAdapter` (wiring) implementa o `ShiftSchedulePort` da
   materialização delegando ao ÚNICO resolver de escala
   (`resolvePlannedDay`, Escala V1): posição escalada = algum colaborador
   vigente nela pertence a equipe que trabalha na data. A
   **FixtureShiftSchedule ("dia ímpar") foi APOSENTADA e removida** — teste
   de integração prova por contraste que ela não é a fonte (dia PAR
   materializa quando a equipe do dia cobre a posição; a fixture diria não).
   WEEKDAYS segue calendário puro (decisão de produto: dia configurado
   materializa mesmo sem a posição escalada — sinaliza redistribuição;
   WHEN_SCHEDULED é a opção explicitamente dependente de presença).
2. Candidatos da ATRIBUIÇÃO situacional agora vêm da presença PLANEJADA de
   hoje (`assignablePositions` no view model, via LoadPlannedSchedule) —
   nunca o cadastro inteiro; sem ninguém escalado a UI orienta ("Confira a
   aba Escala") em vez de listar todo mundo. Criação de template e filtro
   "Por funcionário" seguem usando o CATÁLOGO (template é regra futura).
3. Contratos provados por integração real (container default): materializa
   no dia escalado → não materializa na folga → volta no dia seguinte;
   troca de OCUPANTE preserva a ocorrência (recorrência é da POSIÇÃO);
   escala esvaziada NÃO apaga ocorrência já materializada (decisão desta V1:
   ocorrência operacional tem histórico — reconciliação/exclusão é futura);
   atribuição não contamina o template e a ocorrência seguinte nasce
   novamente SEM responsável.

Validação: 105 testes web (12 arquivos) incl. novo `task-recurrence.test.tsx`
(4 integrações multi-data sobre o MESMO banco local) e ui-task-planning
atualizado para candidatos escalados; Chrome real com fluxos A (WEEKDAYS sem
responsável → atribuir a escalado → reload), B (WHEN_SCHEDULED + rotação
visível na aba Escala), C (todos os dias) e D (mobile 390px com drawer
aberto, delta 0px).

Pendências (antes de TaskExecution V1):

- Ocupante ESPECÍFICO na atribuição quando houver mais de um escalado na
  mesma posição (hoje atribui-se a posição; o nome exibido são os escalados).
- Exceções de escala (ShiftOccurrence/Override) e reconciliação de
  ocorrências quando a escala muda após materializar.
- Sync real (Edge Function) das entidades de tarefa; reconciliação de id
  server-side de daily_tasks (pendência antiga).

## Operação Compartilhada V1 — Home operacional + PIN just-in-time + execução + conferência

Decisão de produto: a experiência principal deixa de ser o dashboard
individual e passa a ser a OPERAÇÃO DE HOJE (/operacao) — quadro
compartilhado da loja para tablet no chão de operação. VISUALIZAR é do
dispositivo; cada AÇÃO CRÍTICA (assumir, iniciar, finalizar/enviar,
conferir, devolver) exige identificação por PIN just-in-time que resolve
identidade + permissões efetivas, executa com autoria real e DESCARTA a
credencial — o tablet nunca vira "login" de ninguém (ADR-018/ADR-014
intactos; a sessão operacional do ator é resolvida/aberta pelo fluxo oficial
quando a execução exige autoria). Interfaces individuais (/turno,
/turno/tarefas) preservadas como experiência secundária; a raiz redireciona
para /operacao.

Classificação formal das lacunas (registrada ANTES do código; NENHUMA ADR —
nenhuma decisão estrutural mudou):

- Estados intermediários IN_PROGRESS / AWAITING_REVIEW / NEEDS_CORRECTION:
  a decisão "sem estado intermediário" era ESCOPO da 7.2 — enum
  daily_task_status evoluiu ADITIVAMENTE; transições antigas (PENDING/
  OVERDUE → DONE|SKIPPED) permanecem válidas e DONE segue sendo o ÚNICO
  terminal de aprovação (CONCLUIR ≠ APROVAR).
- requires_review: novo DADO na definição, mesmo padrão congelado de
  requires_photo (default false — review nunca é obrigatório para tudo).
- Evidência: Attachment JÁ estava modelado no schema (storage_path +
  execution_id; binário fora da linha) — implementada a extensão prevista:
  EvidenceRecord local espelha attachments; BINÁRIO em blob store próprio
  (IndexedDB structured clone, DB tauros-evidence-blobs) — nunca base64 na
  tarefa nem na fila (metadado na fila; upload real ao Storage segue
  pendência declarada, sem mentir "confirmado").
- Conferência: colunas ADITIVAS em task_executions (started_at,
  reviewed_by_*, reviewed_at, review_outcome APPROVED|RETURNED,
  review_note) — a cadeia superseded_by_id JÁ EXISTENTE carrega o
  retrabalho: devolução NUNCA apaga execução/evidência; reenvio nasce como
  NOVA execução encadeada (idempotência do reenvio ancorada na execução
  devolvida). review_reason (sync/autoria) intocado — conceito distinto.
- Capability task.review pelo mecanismo oficial ADR-018 (identifier novo;
  PERMISSION_MODEL_VERSION intacta). Executor NUNCA aprova o próprio
  trabalho (invariante de domínio, além da capability) — UI hiding ≠
  authorization, provado por teste chamando o use case diretamente.

Ciclo implementado (domínio puro → use cases → wiring → UI):
decideClaimDailyTask (assumir = elegibilidade por posição vigente + presença
planejada oficial — NUNCA capability gerencial; template intacto; próxima
ocorrência nasce sem responsável) → decideStartDailyTask (horário REAL +
ator na ocorrência; duplo início do mesmo ator converge; de outro, rejeita —
substituição de responsável NÃO existe: lacuna registrada, redistribuição é
a atribuição situacional do encarregado) → decideTaskOutcome estendido
(IN_PROGRESS/NEEDS_CORRECTION acionáveis; AWAITING_REVIEW bloqueia operador;
requiresReview → AWAITING_REVIEW; skip nunca passa por review; trabalho
entregue não conta atraso) → decideReviewExecution (aprovar→DONE /
devolver→NEEDS_CORRECTION com motivo obrigatório; reconferência idêntica
converge, divergente rejeita). Novas migrações: SQL aditiva
20260814020000; IndexedDB app-state v6 (metadados de evidência; upgrade
v5→v6 testado). Fila oficial reutilizada (start/review/evidence como
operações novas; claim REUTILIZA a fila da atribuição situacional);
transporte fake ganhou os cenários contratuais — incluindo o conflito de
"assumir" concorrente entre aparelhos (idempotency_divergence, dados
preservados p/ revisão) e a correção de um bug pré-existente (update de
daily_tasks caía no branch de sessão). Auditoria: transições de negócio via
outbox oficial + conferência com admin.action/access.denied diretos.

Validação: 113 domínio + 111 aplicação + 110 web (fluxos A–D verticais,
upgrade v6, axe corrigindo heading-order real) + Chrome real (cenários A–E:
tarefa simples com reload; foto obrigatória bloqueando envio; conferência
com evidência visível; devolução→correção→reenvio→aprovação; operador comum
negado; mobile 390px delta 0 com drawer de conferência aberto). PIN provado
fora de fila/auditoria/storage/localStorage após a jornada completa. Os
quadros legados (/turno/tarefas, /encarregado) exibem os estados novos com
rótulo correto e sem ações do operador em AGUARDANDO CONFERÊNCIA (o domínio
já rejeitava; o alinhamento é de UX).

DADOS OBJETIVOS agora preservados para métricas futuras (SEM score/gamificação):
planned_start/due (planejado) × started_at/event_time (real) × reviewed_at;
review_outcome por execução; cadeia supersedes (retrabalho); contagem de
execuções/aprovações/devoluções por ator/posição — tudo derivável da trilha
factual; NENHUM campo de pontuação foi criado.

Pendências para o piloto:

- IDENTIDADE ↔ CADASTRO: o PIN identifica fixtures de desenvolvimento; o
  vínculo operacional (posição/equipe) vive no cadastro real. Testes/jornada
  semeiam a ponte explicitamente — ANTES do piloto é preciso unificar
  (identidade real do backend OU vínculo de PIN no cadastro da Gestão de
  Equipe). Esta é a pendência número 1.
- Upload real da evidência ao Storage (binário local até lá) e remoção de
  evidência capturada por engano.
- TaskExecution V1 restante: observações estruturadas além da nota,
  solicitações (subvertical já prevista), substituição formal de responsável.

### Review adversarial (gate adicional pré-PR) — achados e resolução

Quatro lentes independentes (RBAC/segurança, offline/idempotência,
domínio/estados, UI/regressão) + verificação. 23 achados brutos → 6 BUGS
REAIS e 2 RISCOS corrigidos ANTES do PR:

1. Autorização JIT vazava após ações de um passo (assumir/iniciar/abrir o
   dia) e em falhas — o tablet retinha a credencial do último ator.
   CORRIGIDO: descarte no finally; só os drawers (finalizar/conferir) retêm
   o ator até fechar; leitura do quadro NUNCA reutiliza autorização residual
   (nomes dos cards agora vêm do diretório local de ocupantes). Teste prova
   que enfileirar após uma ação falha sem nova identificação.
2. reconcileFromQueue reprocessava itens JÁ TERMINAIS (SYNCED/CONFLICT) em
   ordem aleatória — regressão de atribuição e syncStatus falso. CORRIGIDO:
   recuperação só para estados não-terminais (defeito latente desde a 7.1,
   mecanismo geral corrigido).
3. Falha entre gravar a execução/conferência e atualizar a ocorrência
   deixava a tarefa presa (replay convergia sem reparar). CORRIGIDO:
   auto-reparo nos replays com guarda de elo (nunca regride desfecho
   posterior) — testes de tarefa presa em NEEDS_CORRECTION e
   AWAITING_REVIEW.
4. Evidência órfã de tentativa abandonada de OUTRO ator satisfazia o
   requiresPhoto do submissor. CORRIGIDO: só evidências pendentes capturadas
   pelo próprio ator entram no envio.
5. Motivo de devolução vazava de uma conferência para a seguinte (reset por
   tarefa) e o drawer de finalização apagava medição/observação em erro de
   validação (reset agora só no fechamento). CORRIGIDOS.
6. Object URLs de evidência nunca revogadas (crescimento de memória em
   tablet ligado o dia todo). CORRIGIDO: revogação ao recriar/fechar.
7. Chave de idempotência do INÍCIO não distinguia a rodada pós-devolução (o
   novo started_at real seria deduplicado no servidor). CORRIGIDO: chave
   ancorada na execução devolvida.
8. Terceiro podia ADIAR (skip) trabalho em curso de outro ator. CORRIGIDO no
   domínio: skip de IN_PROGRESS só por quem iniciou (concluir por colega
   segue válido, com autoria real registrada).

FALSO POSITIVO (refutado na verificação): "PIN de fixture explorável em
produção" — sem backend, flag demo é build deliberado e documentado; a
validação real de PIN chega com o servidor (pendência já registrada).
RISCOS ACEITOS/pendências: conflito de conferências/inícios concorrentes
entre aparelhos no transporte FAKE (modelagem chega com o transporte real);
counts dos quadros legados não somam os estados novos (telas secundárias);
"dia sem tarefas" indistinguível de "dia não aberto" no vazio da Home; GC de
evidências órfãs.

## Identidade Operacional V1 — decisão de arquitetura (ADR-021)

Ataca a **pendência número 1** do piloto (IDENTIDADE ↔ CADASTRO): eliminar a
ponte/fixture entre PIN e `employeeId` para que o colaborador cadastrado na
Gestão de Equipe seja a mesma identidade que informa PIN, executa e (quando
autorizado) confere — com autoria e auditoria reais, sem sistema paralelo de
autenticação.

DECISÃO congelada em [ADR-021](../adr/ADR-021-operational-identity.md):

- **Employee é a identidade operacional**; `employeeId` é a autoria
  obrigatória. `profileId`/`membershipId` (plataforma) são OPCIONAIS até
  provisionamento real — proibido UUID fictício (`platform:<fakeProfileId>`).
- **UX:** ação → selecionar colaborador → PIN → verificar aquele `employeeId`.
  `employeeId` identifica; PIN verifica. PIN NÃO precisa ser único na loja.
- **Credencial separada de Employee** (`OperationalCredential`, relação
  1:0..1): salt + verifier + algo/params + status + lastOnlineConfirmedAt.
  Proibido `employee.pin`; nunca PIN em texto puro.
- **Política 100% do Configuration Baseline §3** (nenhum número na ADR):
  `auth.pin.length/hashAlgo/kdfIterations/offlineValidityMs/maxAttempts/`
  `lockoutStepsMs/hardReauthAfter`. A UI lê o comprimento do Config Engine.
- **Servidor é autoridade final:** online é PIN via TLS → RPC verifica contra
  o hash. Cliente NUNCA envia verifier/hash; hash NÃO é bearer credential.
- **Offline** verifica local sob janela + snapshot + permission_model_version
  - lockout; `origin = offline-snapshot`; servidor revalida no sync.
- **Credencial offline** nasce `LOCAL_PENDING_PROVISIONING` (só no dispositivo
  de origem); provisionamento oficial no sync. Sem peer-to-peer.
- **Canal próprio** `OperationalCredentialPort` / `CredentialProvisioningPort`
  (adapter local/fake agora): credencial NÃO trafega na fila operacional
  genérica, nem em snapshot/audit/log/URL.
- **Lockout** local por `employeeId × deviceId`, persistente, sem PIN,
  auditado sanitizado; não substitui rate-limit server-side.
- **PIN autentica, não autoriza:** capabilities seguem do PermissionResolver /
  snapshot (ADR-018 permanece autoridade). Fixtures (`1234`) continuam DEV e
  passarão a implementar o MESMO `OperatorIdentityPort`.

Consequência de SCHEMA (autorizada conceitualmente; migration só na Fase 4):
tabela aditiva `employee_pin_credentials` (1:0..1; `employees` inalterada) e
relaxamento de `operator_sessions.actor_profile_id` para NULL (forward-only).
OperatorSession passa a `actorEmployeeId` obrigatório + `actorProfileId`
opcional. Auditoria: autoria por `actorEmployeeId` (+ `actorProfileId` quando
existir). Threat model honesto: PIN curto protege contra uso oportunista, NÃO
contra forense de dispositivo comprometido — sem promessa de senha forte.

Fase 4 (implementação) tocará: `@tauros/contracts` (ports de identidade e
credencial; `profileId`/`actorProfileId` opcionais; `actorEmployeeId` nos
audit inputs), wiring/controllers (`OperatorIdentityPort` no lugar dos imports
diretos de `fixtures.ts`), `RegisterEmployeeUseCase` (PIN opcional no
cadastro), OperatorSession/schema e adapters de credencial local/fake.

### Fase 4A — contratos + schema + domínio/adapters (SEM UI)

Materializada a infraestrutura mínima da ADR-021; os fluxos `/operacao`,
`/turno` e `/encarregado` NÃO foram tocados (UI é a Fase 4B).

- **Contracts** (`@tauros/contracts`): novo módulo `identity/` —
  `OperatorIdentityPort` (verify por `employeeId`+PIN), `OperationalCredentialPort`,
  `PinLockoutStorePort`, `CredentialProvisioningPort` (fronteira futura),
  `PinPolicy(Port)` e os records `OperationalCredentialRecord`/`PinLockoutState`
  (+ `ENTITY_OPERATIONAL_CREDENTIAL`/`ENTITY_PIN_LOCKOUT`).
- **Nullable chain**: `EffectiveAuthorization.operatorProfileId` e
  `.membershipId` opcionais/null; `actorProfileId` nullable em
  `OperatorSessionRecord`, execução (`performedByProfileId`/`reviewedByProfileId`),
  comando de domínio de sessão e snapshot (codec Zod). `actorEmployeeId`
  passou a autoria OBRIGATÓRIA nos audit inputs; adapters mapeiam
  `actorId = profileId ?? employeeId` (autoria nunca se perde). Sem UUID fictício.
- **KDF**: `Pbkdf2PinHasher` (WebCrypto PBKDF2-SHA256) em `@tauros/infrastructure`
  — implementação do FALLBACK autorizado pelo Baseline (sem dependência WASM
  nova); `algorithm`/`params` gravados por credencial permitem argon2id futuro.
- **Adapters locais** (wiring): `LocalOperationalCredentialStore` (verifier +
  salt, nunca PIN), `LocalPinLockoutStore` (por `employee × device`, persistente),
  `LocalCredentialIdentity` (orquestra lockout → credencial → janela offline →
  autorização `offline-snapshot`, sessionId próprio, NUNCA `platform:<profileId>`),
  `ConfigPinPolicy` (7 chaves `auth.pin.*` do Baseline), `NullCredentialProvisioning`.
  `FixtureOperatorIdentity` (DEV) implementa o MESMO `OperatorIdentityPort`.
- **Store local**: `APP_STATE_SCHEMA` v6→v7 ADITIVA com stores DEDICADOS
  `operational_credentials` e `pin_lockouts` (nunca a fila/evidência).
- **Schema**: migration Prisma forward-only `20260815120000_add_pin_credentials`
  (tabela `employee_pin_credentials` 1:0..1 + enum `credential_status` +
  `operator_sessions.actor_profile_id` DROP NOT NULL); RLS Supabase
  `20260815120500` (RLS+FORCE, sem policy para `authenticated` — verifier só
  server-side, nunca bearer). `employees` intacta.
- **Segurança endurecida**: `FORBIDDEN_FIELD_PATTERN` do snapshot passou a
  barrar `verifier|salt|hash` além de `pin|credential` (ADR-021 §8).
- **Testes**: hasher (5), adapters de identidade/segurança (10) e upgrade/reload
  IndexedDB (2 novos) — pipeline local verde (format, lint, typecheck,
  boundaries, check:hardcoded, 903 testes, db:validate). Sem PR (4A+4B juntos).

### Fase 4B — wiring + cadastro de PIN + fluxos reais (com UI)

Conecta a infraestrutura da 4A aos fluxos reais. A **pendência número 1**
(IDENTIDADE ↔ CADASTRO) está fechada: o colaborador cadastrado é a MESMA
identidade que se identifica e opera.

- **Wiring** (`container.ts`): `container.identity` = `CompositeOperatorIdentity`
  (credencial local REAL vence fixture DEV por precedência determinística) +
  `container.credentials`/`pinPolicy`/`credentialProvisioning`/`identityRoster`.
  Fonte de autorização = `UnprovisionedAuthorizationSource` (HONESTA): sem
  backend, colaborador real é IDENTIFICADO mas permissions = [] — nada derivado
  de posição/equipe/cargo/nome. `platform:<profileId>` eliminado (sessionId
  próprio da identidade local).
- **UX unificada** (ADR-021): ação → **selecionar colaborador** → PIN →
  `verify(employeeId, pin)`. Migrados `/operacao` (diálogo com seleção),
  `/turno` e `/encarregado` (o antigo `supervisorFixture()` por capability foi
  removido — ninguém é encarregado por nome; o painel só abre se a AUTORIZAÇÃO
  trouxer config.write). Comprimento do PIN vem do `PinPolicy` (nunca hardcoded).
- **Controllers desacoplados**: NENHUM controller importa `identifyByPin`/
  `identifyOperator`/`FIXTURE_OPERATORS` (removidos de fixtures.ts). Fixtures DEV
  entram só via `FixtureOperatorIdentity` (mesmo `OperatorIdentityPort`). PINs
  DEV migrados para 6 dígitos = comprimento do Baseline.
- **Cadastro + PIN**: `/encarregado` ganha seção "Identidade operacional" (PIN +
  confirmar, comprimento da política). `RegisterEmployeeUseCase` cria o
  Employee; o controller cria a `OperationalCredential` SEPARADA (offline ⇒
  `LOCAL_PENDING_PROVISIONING`). PIN validado (confirmação + comprimento),
  derivado em verifier e descartado — nunca no `EmployeeRecord`. PIN é OPCIONAL:
  o colaborador existe sem credencial (cadastro administrativo).
- **IDENTIDADE ≠ AUTORIZAÇÃO** (o teste mais importante): João cadastrado +
  PIN é identificado, mas SEM `task.review`/`session.open` — conferir/abrir
  turno negados pelos use cases; assumir/iniciar (elegibilidade operacional)
  seguem. Elber DEV (provisionado via fixture) mantém `task.review`.
- **Lockout** conectado (`LocalPinLockoutStore`): erros consecutivos →
  mensagem neutra → lockout do Baseline; sobrevive à recriação do container
  (reload). **Autoria**: execução/evidência/review/sessão/auditoria usam
  `employeeId` real; `profileId` null não quebra nada.
- **Testes**: +5 de integração de container (`operational-identity-4b`:
  cadastro→credencial separada, identidade+autoria real, identidade≠autorização,
  lockout persistente, PIN/verifier fora da fila) + suíte UI existente migrada
  para seleção+PIN de 6 dígitos. Pipeline completo VERDE: format, lint,
  typecheck (16/16), boundaries, check:hardcoded, **908 testes**, build,
  db:validate, pnpm audit (0 vulnerabilidades).
- **Pendências para o piloto**: (a) sem backend, autorização real de
  colaborador novo depende de provisionamento (hoje identificado-sem-permissão);
  (b) "Alterar PIN" — o port já suporta (upsert sobrescreve); UI dedicada é a
  próxima etapa; (c) validação Chromium manual dos cenários A–F recomendada
  antes do piloto (cobertos hoje pela suíte jsdom de UI).

## Pilot Readiness V1 — validação operacional (sem nova feature)

Preparação para o primeiro piloto controlado no açougue. Nenhuma feature/engine
/ADR nova; um único ajuste de código (PILOT BRIDGE) para desbloquear o ciclo.

**BLOCKER encontrado e corrigido — operador real não finalizava.** Um
colaborador real identificado tinha `permissions: []` (honesto, ADR-021), mas
FINALIZAR uma tarefa abre uma sessão de autoria que exige `session.open` →
ciclo do dia travado para operadores reais. Correção: `PilotBridgeAuthorizationSource`
(marcado ⚠️ PILOT BRIDGE, removível sem quebrar arquitetura) concede a QUALQUER
colaborador identificado SÓ as capacidades OPERACIONAIS do próprio turno
(`session.open`/`session.close`). Invariantes preservadas: NUNCA `task.review`/
`config.write`/`workforce.write` (conferência/gestão seguem só do encarregado);
grant CHAPADO por identidade (não deriva de posição/equipe/cargo);
profileId/membershipId permanecem null (sem plataforma fake). Substituído pela
resolução real de permissões efetivas quando o backend existir.

**Classificação de ações (piloto):** elegibilidade/identidade (visualizar,
assumir, iniciar, anexar foto) funcionam para operador real; operacionais do
turno (finalizar/enviar, abrir/fechar turno) exigem `session.open`/`close` —
providas pelo PILOT BRIDGE; gestão (criar/atribuir tarefa, conferir, devolver,
aprovar, cadastrar colaborador, alterar escala) exigem capability e seguem só do
encarregado (hoje Elber DEV provisionado por fixture — documentado).

**Validação Chromium real (CDP puro):** /operacao renderiza sem overflow
horizontal em desktop, 390px e 834px; diálogo de identificação com seleção de
colaborador (roster real ∪ DEV: Marina/Carlos/Rita/Elber) + PIN de 6 células;
fluxo completo identidade→autorização→painel provado no navegador com IndexedDB
real (Elber seleciona → PIN 123456 → "Boa noite, Elber" + "+ Nova tarefa").
Mobile/tablet legíveis e glove-first. Cenários A–F funcionais cobertos pela
suíte jsdom (127 testes web, componentes React reais) + teste de integração de
container do PILOT BRIDGE.

Pipeline completo VERDE (format, lint, typecheck 16/16, boundaries,
check:hardcoded, 908 testes, build, db:validate, audit). **Pronto para piloto
controlado** com o encarregado usando identidade DEV provisionada (bridge
documentado) até o backend de identidade real.

## UI Operacional V1.1 — sidebar de triagem, filtros por posição/colaborador e alertas de prazo

Evolução de READ MODEL + controller + UI da `/operacao` (nenhuma mudança em
identidade, PIN, TaskExecution, recurrence, escala, RBAC, offline, auditoria,
materialização ou review).

- **"Área" — lacuna registrada**: NÃO existe conceito de área/setor/categoria em
  domínio/contratos/schema. A dimensão real de agrupamento é a POSIÇÃO
  operacional responsável (`assignedPositionId ?? template.targetPositionId`);
  a sidebar agrupa por "Posições" (rótulo honesto — posição ≠ área) + "Sem
  responsável". Se "área" virar conceito de negócio, exige modelagem própria
  (novo ADR) — nenhuma entidade inventada para a UI.
- **Equipe de hoje**: fonte EXCLUSIVA = presença planejada (Escala V1). O
  enriquecimento (nomes/posição/jornada) foi extraído do
  `LoadPlannedScheduleUseCase` para `buildPlannedScheduleDay` (função pura em
  application) e reutilizado pela leitura device-local `container.plannedDay`
  do quadro compartilhado — resolver único (`resolvePlannedDay`) intacto.
  Sidebar segue a `operationalDate` da loja (não o "hoje do dispositivo").
- **Prazo derivado (apresentação)**: `dueState NORMAL→DUE_SOON→OVERDUE` só no
  view model — nada persistido, state machine intacta. VENCIDA reutiliza
  `isOverdue` do domínio (DONE/SKIPPED/AWAITING_REVIEW nunca atrasam — decisão
  preservada; entregue ≠ atrasado do operador). DUE_SOON usa o MESMO conjunto
  de exclusões (pergunta "ainda poderia vencer?" ao próprio `isOverdue`).
- **Business parameter novo — `tasks.dueSoonWindowMs`** (30 min default, scope
  store, hotReload): ADIÇÃO ADITIVA ao catálogo do Configuration Engine
  (ADR-019) — nenhum default existente alterado. ⚠️ Ratificação formal no
  documento Baseline v1.0 §5 PENDENTE (o catálogo-como-código é a fonte
  executável; registrar na próxima revisão do documento).
- **UI**: Sidebar/NavigationGroup/NavigationItem/Chip/Drawer/Badge do DS
  congelado (zero mudanças em `ui-*`; slot `sidebar` do AppShell que já
  existia). Alertas do topo = Chips acionáveis (🔴 atrasadas / ⚠ próximas) que
  FILTRAM — sem modal, sem interrupção. Cards: badge de prazo com ícone+texto+
  forma/cor (P5, nunca só cor): "🔴 Atrasada há 1 h 24 min" / "⚠ Vence em 18
  min". Filtros combináveis por interseção (situação × posição × colaborador ×
  prazo) com chips removíveis + "Limpar filtros" — filtrar é leitura pura
  (provado por teste: fila e audit_outbox inalterados). Mobile (<768px):
  gatilho "Filtros e equipe" → Drawer com o MESMO componente Sidebar; tablet
  ≥768px mantém sidebar persistente (CSS do DS já fazia o corte).
- **Atualização temporal**: tick de MINUTO no controller (`setInterval` +
  cleanup; Clock injetado segue única fonte de agora) — NORMAL→DUE_SOON→OVERDUE
  sem refresh e SEM mutation (provado: status persistido continua PENDING).
- **Testes**: +15 (`operations-sidebar.test.tsx` + `dueStateFor` puro): roster
  só com escalados (Equipe B de folga não aparece), contadores, filtros
  (colaborador/sem responsável/posição/combinados/limpar), alertas filtram,
  overdue/dueSoon derivados, DONE e AWAITING_REVIEW não contam, relógio
  avançando muda estado sem mutation, mobile Drawer, tablet sidebar, axe,
  fila/auditoria intactas ao filtrar. 142 testes web verdes (127 preservados,
  1 espera ajustada por texto duplicado legítimo).
- **Validação Chromium real (CDP)**: cenários 1–7 — sidebar tablet/desktop com
  contadores exatos; João filtra e chip remove; Produção filtra e tripla
  combinação mostra interseção vazia honesta; "⚠ Vence em 24 min" + 4× "🔴
  Atrasada há Xh" ao vivo; fluxo real João (PIN) inicia→envia p/ conferência →
  card sem 🔴 + sidebar "1 aberta"/"Conferir 1"; 390px Drawer fecha ao
  selecionar, chips legíveis, sem overflow; 834px sidebar+quadro (578px úteis).
- **Achado (DEV)**: os 4 templates fixture (DAILY, posições Produção/
  Atendimento/Apoio) materializam junto e suas posições NÃO são atribuíveis no
  cadastro de colaborador (só posições reais do baseline) — no piloto o quadro
  DEV mostra tarefas dessas posições sem colaborador correspondente na equipe.
  Comportamento pré-existente, agora VISÍVEL pela triagem; some com o cadastro
  real de definições (backend) ou limpando as fixtures de template.

## UX Operacional V1.2 — sidebar adaptativa/retrátil da /operacao

Somente UX/UI + estado EFÊMERO de apresentação — domínio, tarefas, escala,
identidade, autorização, offline, recorrência e regras de prazo intactos.

- **Desktop (hover real)**: inicia RECOLHIDA como navigation rail (~80px) com
  os sinais operacionais (Badges com contagem: atrasadas/próximas/conferir +
  equipe/filtros). Aproximar o ponteiro expande em OVERLAY (position:fixed —
  escapa do overflow do shell sem tocar o DS; sem empurrar o quadro); afastar
  recolhe após delay de 300 ms (anti-flicker). "Fixar aberta" → PINNED
  (in-flow, quadro cede espaço); "Recolher" desfaz. Preferência é efêmera
  (não há mecanismo de UI-preferences no app — nada persistido/sincronizado).
- **Reuso do DS**: o mecanismo collapsed/expanded é o do PRÓPRIO Sidebar
  (controlado + toggleLabel "Abrir/Fechar painel operacional" com
  aria-expanded); rail = Sidebar collapsed + NavigationItem (labels
  visually-hidden preservam nome acessível; contagem no rótulo). Touch usa o
  Drawer do DS (toque fora/ESC/foco por conta do primitive). Nenhuma segunda
  implementação de sidebar.
- **Capacidades por media feature** (nunca user-agent):
  `(hover:hover) and (pointer:fine)` decide hover×touch;
  `prefers-reduced-motion` desliga a transição do overlay (translateX/opacity
  curtos com motion tokens; cards não animam).
- **Regras críticas**: recolher NÃO esconde a situação (badges na rail + a
  região de alertas acionáveis acima do quadro segue lá — §6); mudança de
  prazo NUNCA abre a sidebar sozinha (§7); selecionar filtro recolhe SÓ a
  expansão temporária (fixada permanece — §9) e os chips de filtros ativos
  continuam no quadro; eventos localizados no shell (mouseenter/leave/focus/
  blur/keydown) — nenhum listener global (§10).
- **Mobile (<768px)** preservado: gatilho "Filtros e equipe" → Drawer da tela.
- **Testes**: +9 (`adaptive-sidebar.test.tsx`): collapsed inicial com sinais
  visíveis, hover expande/leave recolhe (fake timers), pin persiste/unpin,
  filtro sobrevive ao recolhimento, ESC devolve foco, reduced-motion sem
  transition, touch abre Drawer e 1 toque seleciona, mobile sem regressão,
  fila/audit intactos. Existentes adaptados só no helper (abrem+fixam).
  Suíte web 151/151 — 4 execuções seguidas sem flake.
- **Browser real (CDP)**: desktop 1280 — rail com [■5]/[●1], hover expande
  overlay completo, João filtra e recolhe sozinha (chip fica), leave recolhe
  com delay, fixar sobrevive ao mouse sair, Recolher volta à rail; alertas
  visíveis com rail recolhida; touch 834 (setTouchEmulationEnabled →
  hover:none real) — rail → toque → Drawer → 1 toque em João filtra e fecha,
  sem overflow; 390 — Drawer da tela sem regressão.
- **Limitação registrada**: `Emulation.setEmulatedMedia` não emula
  hover/pointer — usar `Emulation.setTouchEmulationEnabled` na validação CDP.

## Overnight Hardening — auditoria adversarial pré-piloto (MODO ULTRA)

Auditoria profunda em 10 dimensões (operador, encarregado, domínio, offline,
evidência, segurança, mensagens, performance, glove/a11y, identidade,
histórico) com verificação adversarial. 102 achados (1 P0, 17 P1, 49 P2,
35 P3). Corrigidos: o P0, todos os P1 únicos e os P2 de alto impacto.

**P0 corrigido — contenção de autoria**: unmount do quadro com drawer aberto
descartava... NÃO descartava o ator; a autorização retida carimbava autoria
ERRADA em enqueues posteriores de outras telas. Cleanup de unmount + boot do
/encarregado reidrata a autorização do contexto (ações JIT do quadro zeram o
snapshot global).

**P1 corrigidos**: exceção não congela mais Dialog/Drawer em busy (catch
devolve erro cancelável); reconcile aplica intenções em ordem de CRIAÇÃO
(ordem de chave UUID podia regredir estado no reload); dependência de fila em
PERMANENT_FAILURE resolve como morta (dependente vai a NEEDS_REVIEW em vez de
esperar para sempre); rótulo de falha terminal honesto ('avise o encarregado'
— nunca 'aguardando nova tentativa'); evento 'online' drena a fila + botão
'Sincronizar agora' (a promessa do banner virou verdade); identidades DEV sob
a MESMA escada de lockout (o encarregado do piloto era força-brutável);
mensagens de credencial permanentes acionáveis (sem PIN/janela vencida/reauth
— fim do loop 'confira e tente novamente'); 'Definir/Redefinir PIN' por
colaborador na gestão (upsert reabre a janela offline de 72h e zera o lockout
do aparelho — recuperação do 'muro dos 3 dias'); conferência mostra SÓ as
evidências da execução conferida (aprovação nunca decide por foto órfã/de
rodada devolvida) e o envio mostra só as fotos pendentes do ator; virada do
dia operacional: sessão ACTIVE de outro dia vira 'stale-session' explícito
com 'Fechar turno de <data>' (sem materialização corrompida, sem fechamento
silencioso); PinInput aceita teclados virtuais Android (onChange primário —
o PIN era indigitável no tablet-alvo); reatribuição exposta na UI
(Atribuir/Reatribuir para pending/overdue/needs-correction) com domínio
rejeitando TASK_IN_EXECUTION (trabalho vivo não se redistribui).

**Candidatas Fase 23** — implementadas: A (reatribuir — expor UI + guarda de
domínio), B/C parcial (adiar exige MOTIVO com autoria e não anula devolução —
novo prazo continuaria exigindo evolução formal de domínio: adiado), E
(resumo do turno + aviso de pendências no fechar — avisar ≠ impedir), G
(Definir/Redefinir PIN), H (filtros rápidos — devolvidas na triagem: chip ↩,
aba, sidebar e rail). Rejeitadas nesta noite: C-completo (novo prazo = nova
ocorrência/mutação de dueAt — pede desenho formal), D (nota operacional sem
desfecho = nova entidade), F (histórico por data — leitura viável, adiada por
escopo). Mensagens: catálogo operacional cobre condições permanentes de
claim/start/submit/review/assign; falha de abertura de sessão não acusa mais
o perfil da pessoa.

**Perf (100 tarefas reais no browser)**: render inicial ~0,6s, filtro ~60ms,
hover da sidebar ~60ms, sem overflow — leituras por tarefa paralelizadas
(era N+1 sequencial) e formatter de hora cacheado. Sem otimização prematura
adicional.

**Testes**: +6 regressões dedicadas (contenção de autoria no unmount, catch
anti-congelamento, drain no 'online', redefinição de PIN pós-lockout, lockout
das identidades DEV, ordem do reconcile) + atualizações de contrato (skip com
motivo, evidência escopada). Browser real: jornada completa encarregado+
operador com ciclo devolução→correção→aprovação, tablet 834 touch e 390.

**Dívida consciente registrada** (não implementado): superfície de
intervenção da fila (requeue/discard para NEEDS_REVIEW/CONFLICT); hard reauth
no caminho de sucesso (ADR-021 §6.4 — bloquearia para sempre sem backend);
auditoria de falhas de PIN/lockout; upload server-side de evidência + GC de
blobs órfãos; compressão de foto (limite 8MB); idle lock
(session.idleLockMs); histórico por data; fila sem GC (removeCompleted nunca
acionado); 'upgrade blocked' do IndexedDB com duas abas em versões diferentes.

## Piloto Vercel — coerência UI × domínio do time demo (fix/pilot-demo-workforce)

**Bug real do piloto**: /operacao mostrava "Produção — Carlos Nunes", mas
INICIAR com PIN válido do Carlos respondia NOT_ELIGIBLE ("responsabilidade
de outra posição"). Causa raiz: duas fontes de verdade — os cards nomeiam
ocupantes pelo diretório fixture (FIXTURE_TEAM), enquanto a elegibilidade
(claim/start) lê employee_assignments do cadastro REAL, onde o time demo
não existia (aparelho novo = workforce sem pessoas; os testes passavam
porque semeavam vínculos manualmente no harness).

**Correção no modelo (origem dos dados)**: `ensureDemoWorkforce` semeia o
time demo como cadastro real no boot do composition root — posições fixture,
pessoas e vínculos completos (equipe 12x36 A/B alternada + jornada), gated
por `fixturesEnabled()`, idempotente, e com época de vigência anterior a
qualquer cadastro da loja: quem a gestão cadastrar/realocar depois vence
pela regra única `currentAssignmentFor` (o seed nunca compete). Fixtures
passam a obedecer às mesmas invariantes da operação real; a validação de
posição NÃO foi afrouxada (regressão prova Marina negada em tarefa de
Produção). Seam `demoWorkforce: false` no container para suítes que
exercitam a loja construída do zero.

**Review adversarial do diff (11 agentes, 5 lentes + refutação)** — 2 P1
confirmados e corrigidos antes do PR: (1) o CompositeTeamDirectory dava
precedência à fixture congelada sobre o cadastro real — realocar um membro
demo faria o bug renascer na UI; agora a LOJA vence e a fixture só completa
(regressão cobre a metade UI da invariante); (2) aparelho que contornou o
bug pré-fix cadastrando um homônimo à mão ganharia um duplicado permanente
(não há inativação na gestão) — o seed agora pula membro demo quando existe
colaborador ATIVO homônimo (regra geral, nunca hardcode). Refutados:
unicidade por natural-key no seed de posições (converge por id fixo) e a
variante "realoca re-abre o bug" da lente offline (mesma raiz do P1 nº 1).

**Dívida registrada**: badge "Sem PIN" na gestão para membros demo cujo PIN
DEV funciona (o badge fala do credencial local — honesto, porém confuso no
piloto); Carlos é a fixture deliberada SEM `session.open` (matriz de
cenários de autorização) — ele INICIA tarefas mas o envio falha ao abrir o
turno dele ("avise o encarregado"): traço de DEV a resolver quando a
identidade real substituir a matriz; em dias da Equipe A a posição Produção
fica sem escalado (12x36 com 3 pessoas — dado demo, não regra).

## Foto V1.1 — captura direta por câmera (feat/photo-capture-v11)

**Evolução, não sistema novo**: o input file cru do SubmitDrawer (única
superfície de evidência do app — primeiro envio e reenvio pós-devolução
compartilham o drawer) virou o componente co-locado `PhotoCapture`, com as
mesmas fronteiras: `actions.addEvidence(file)` → blob local → IndexedDB →
fila. TaskExecution, requiresPhoto, storage e offline intocados; nenhuma
biblioteca adicionada; nada de base64.

**Duas ações explícitas**: "Abrir câmera" (`capture="environment"` — traseira
em celular/tablet) e "Escolher foto" (sem capture — galeria/arquivos). Nenhum
input cru como experiência principal; ambos ficam `hidden` e são acionados
pelos botões. Degradação honesta: onde o navegador não abre câmera (notebook),
o MESMO controle nativo cai no seletor do sistema — não é erro, e "Escolher
foto" está sempre visível ao lado. Sem `getUserMedia`: nenhum stream aberto,
nenhuma permissão pedida na carga da tela, captura só por toque explícito.

**Preview com confirmação**: seleção/captura gera object URL e mostra
pré-visualização com "Usar foto" (persiste), "Tirar outra" (reabre a MESMA
origem) e "Descartar". Nada é persistido sem confirmação — fechar o drawer
com pendente não cria evidência. Object URLs revogados em troca, descarte,
confirmação e desmontagem. Múltiplas evidências seguem suportadas como antes
(cada confirmação adiciona uma).

**Testes**: +5 em `photo-capture.test.tsx` (ações e atributos nativos;
preview não persiste; câmera passa pelo mesmo preview; trocar/descartar +
bloqueio de envio sem foto obrigatória; cancelar o drawer não persiste).
Helper `attachPhoto` das suítes existentes passou a confirmar o preview.
**Browser real** (CDP, perfil limpo): 7/7 — atributos, 390/834/1280 sem
overflow com ações visíveis, preview sem evidência, confirmação e jornada
completa até "Tarefa concluída.".

## UX Operacional V1.3 — navegação por funcionário escalado na /operacao (feat/operacao-nav-equipe)

READ MODEL + controller + UI da `/operacao`. Nenhuma mudança em domínio,
application, contratos, DS (`ui-*`), identidade, PIN, TaskExecution, escala,
recorrência, RBAC, offline, auditoria, materialização ou review. Nenhum ADR.

**Problema atacado**: filtrar o quadro por PESSOA existia desde a V1.1, mas só
pela sidebar — que na V1.2 passou a iniciar RECOLHIDA como rail no desktop.
O caminho era: aproximar/abrir o painel → rolar até o terceiro grupo → tocar.
Caro para tablet de chão com luva, e sem nenhuma pista prévia de que o filtro
existia. A navegação por funcionário virou o caminho PRIMÁRIO no corpo do
quadro.

- **Faixa "Equipe escalada hoje"** (`TeamStrip`, corpo do quadro, acima do
  SegmentedControl — "quem" antes de "o quê"): um `Chip` por pessoa com
  `Avatar` decorativo + primeiro nome + o MESMO badge de pendências da
  sidebar, mais "Toda a equipe". Fonte ÚNICA = `view.teamToday` (presença
  PLANEJADA — Escala V1), nunca o cadastro inteiro. Escreve no MESMO
  `employeeFilter` da sidebar: **não há segunda fonte de verdade nem estado
  paralelo** — as duas superfícies refletem uma à outra (provado por teste).
  Selecionar mostra posição + jornada planejada como confirmação.
- **`Chip` e não `Tabs`**: `Tab` do DS emite `aria-controls` apontando para um
  `TabPanel`; sem painel a referência fica pendurada (violação axe), e um
  painel por pessoa montaria N cópias da lista. `Chip` em `role="group"` é a
  MESMA linguagem já usada pelos alertas de prazo e filtros ativos. Zero
  mudança em `ui-*`.
- **Sem heading próprio**: os títulos dos cards são `h3`; um `h3` "Equipe de
  hoje" ao lado deles achataria o outline. A faixa é um GRUPO rotulado por
  `aria-labelledby` apontando para o próprio rótulo visível — nome visível e
  acessível são o mesmo nó, sem anúncio duplicado. Rótulo "Equipe escalada
  hoje" (distinto do grupo "Equipe de hoje" da sidebar, que permanece).
- **Nomes do card — ESCALADOS primeiro, ocupantes como fallback honesto**:
  `assigneeNames` vinha de `team.members()` (ocupantes vigentes do diretório,
  SEM filtro de escala), enquanto "Equipe de hoje" vinha da presença
  planejada — dois conjuntos diferentes nomeando a mesma operação. Agora o
  card usa os ESCALADOS da posição responsável; só quando NINGUÉM está
  escalado nela cai nos ocupantes vigentes, marcados com "(fora da escala de
  hoje)". O estado local `scheduledByPosition` (nome enganoso: nunca foi
  escala) virou `occupantsByPosition`; o mapa de escalados é derivado de
  `plannedDay`. Novo campo derivado `assigneesOffSchedule` no view model.
- **INVARIANTE DO PILOTO (#36) PRESERVADA**: nomear NUNCA autoriza. A
  elegibilidade de claim/start segue lida de `employee_assignments` pelo
  domínio (`currentAssignmentFor` + `decideStartDailyTask`); a UI só apresenta.
  `CompositeTeamDirectory` (loja vence) e `ensureDemoWorkforce` intactos —
  `pilot-demo-workforce.test.tsx` passa sem uma linha alterada.
- **Vazio operacional claro**: sem ninguém escalado, a faixa não fica muda —
  "Ninguém escalado para hoje" explica que as tarefas seguem no quadro pela
  posição responsável e aponta para a gestão; escala não configurada tem
  vazio próprio ("Escala de hoje não configurada"). O quadro NUNCA some.
- **Interseção vazia que explica**: o genérico "Nenhuma tarefa aqui" virou
  "Nenhuma tarefa nesta combinação de filtros" nomeando QUAL combinação
  esvaziou (`activeFilterSummary`), com "Limpar todos os filtros" e a saída
  dedicada "Ver todas de {pessoa}". Rótulo distinto do "Limpar filtros" dos
  chips ativos — os dois podiam coexistir na tela (defeito real, não só
  ambiguidade de teste).
- **Reuso**: `memberBadge`/`plural`/`firstName` extraídos para
  `ui/team-member-badge.tsx` — o MESMO sinal de pendências na sidebar e na
  faixa, calculado uma vez no view model.
- **Testes**: +11 (`operacao-team-strip.test.tsx`): faixa só com escalados
  (ocupante de folga não vira opção), sinal igual ao da sidebar, toque filtra
  /alterna, "Toda a equipe" não derruba os demais filtros, faixa ↔ sidebar no
  mesmo filtro, leitura pura (fila e `audit_outbox` inalterados), axe, card
  com escalado ignora ocupante de folga, card sem escalado rotula o fallback,
  vazio sem escalados, interseção vazia com as duas saídas. **177 testes web
  verdes** — os 166 existentes passaram SEM edição de teste.

**Redundância INTENCIONAL (decisão de UX aprovada, não é pendência)**: a faixa
e o grupo "Equipe de hoje" da sidebar são redundantes por desenho — mesma
fonte (presença planejada), mesmo filtro (`employeeFilter`). Os dois ficam,
com papéis distintos e declarados: o **corpo** é a navegação rápida
glove-first do funcionário; a **sidebar** é a triagem operacional completa
(situação × posição × pessoa). Nenhuma refatoração para eliminar a
redundância — a duplicação é de APRESENTAÇÃO, nunca de fonte de verdade.

## Fix — mínimo operacional do executor (fixture DEV × PilotBridge)

**Bug de piloto**: operador assumia e INICIAVA a tarefa, capturava a foto e
falhava ao FINALIZAR com "Não foi possível abrir seu turno para registrar a
execução". Diagnóstico fechado antes de qualquer alteração de código.

- **Causa raiz**: registrar execução exige `operatorSessionId`
  (`RecordTaskOutcome`), e o controller resolve isso abrindo o PRÓPRIO turno
  just-in-time — o que passa por `CAPABILITY_SESSION_OPEN`. A fixture DEV do
  Carlos (`emp-0002`) tinha só `audit.read`, divergindo do
  `PilotBridgeAuthorizationSource`, que concede `session.open` +
  `session.close` a qualquer colaborador com credencial local real. **Assimetria
  do ciclo**: assumir/iniciar passam por ELEGIBILIDADE (posição vigente +
  escalado, sem capability); só o desfecho passa por CAPABILITY.
- **Por que escapou do CI**: todo teste que chegava a "Finalizar" usava Marina
  ou Rita — as duas personas que por acaso tinham `session.open`. Carlos era
  testado só até INICIAR (`pilot-demo-workforce`, PR #36 destravou a
  elegibilidade e a jornada avançou até expor a metade da capability).
- **Correção (proximate, sem re-arquitetar)**: alinhar o caminho DEV ao mínimo
  já definido pelo bridge. `emp-0002` e `emp-0003` passam a ter
  `session.open` + `session.close`; `emp-0001` já tinha. **Nenhuma capability
  gerencial concedida** — `task.review`/`config.write`/`workforce.write`
  seguem exclusivas do encarregado. Domínio, contracts, application,
  `TaskExecution`, `OperatorSession` e evidência/câmera **intocados**: o diff
  de produção é uma linha de `permissions` por operador.
- **Invariante nova e explícita**: todo EXECUTOR do piloto carrega o MESMO
  mínimo operacional, e o caminho DEV não pode divergir do bridge. Coberta por
  teste (`todo EXECUTOR do piloto carrega o mesmo mínimo`).
- **Testes**: +6 em `pilot-demo-workforce.test.tsx` — jornada fixture COMPLETA
  (iniciar → foto → finalizar), autoria `emp-0002` + turno resolvido + evidência
  vinculada à execução, duplo toque não duplica execução nem turno, e o executor
  NEGADO ao conferir a própria execução ("Seu perfil não permite conferir
  execuções."). Os 6 falham sem o fix e passam com ele; os testes de
  incompatibilidade de POSIÇÃO seguem intactos. **183 testes web verdes.**
- **Testes ajustados (assertiva obsoleta, não regressão)**: três testes
  encodavam a assimetria como invariante. `vertical-slice` agora afirma o que
  de fato importa — executor tem o mínimo e NÃO tem gestão. Os estados de UI
  "sem permissão para abrir/fechar" deixaram de depender de uma persona com
  permissão faltando por acidente e passam a vir do PORT de identidade
  (colaborador não provisionado / perfil parcial), preservando a cobertura
  negativa sem inventar persona.
- **Validação em navegador (Chromium/CDP)**: `/operacao` → "Higienizar bancada
  de manipulação" → Carlos → PIN → iniciar → foto → **"Tarefa concluída."**;
  card em "Concluída · 📷 1 evidência"; IndexedDB com UMA sessão ACTIVE de
  `emp-0002` e execução `DONE` com autoria `emp-0002` e evidência vinculada.
  Em seguida, tarefa que exige conferência: Carlos envia e é **negado** ao
  tentar aprovar a própria execução (segue "Aguardando conferência").
  Relógio do navegador fixado em 26/08 — na escala 12x36 o Carlos (Equipe B)
  não trabalha em 25/08.

**Pendência mantida (não regride)**: o bridge continua sendo ponte de piloto;
a resolução real de permissões efetivas (ADR-018) substitui os dois caminhos
quando o backend de identidade/membership existir.

## Frontend Experience V2 — redesign de composição do produto inteiro

**Missão**: transformar o frontend numa experiência de "Sistema Operacional da
Loja" — profissional, coerente, densa e glove-first — SEM re-arquitetar: DS
congelado consumido pela API pública, zero hardcode, comportamento funcional
preservado. Auditoria prévia por 8 agentes (telas, shell, vocabulário do DS,
estados, acoplamento de testes) e revisão adversarial por 5 revisores
independentes ao final; jornadas reais validadas em Chromium (CDP).

**Direção visual**: a assinatura é a LINHA DE OPERAÇÃO — cards com régua de
estado na borda esquerda (cor semântica SÓ para exceção; normalidade calma) e
horário-limite como âncora tipográfica (fonte de dados + ênfase). O quadro
lê-se como rail de expedição: hora → tarefa → responsável → ação. Paleta e
tipografia 100% dos tokens congelados.

- **Chrome global** (`app-chrome.tsx`): TopBar sticky com navegação por área
  (Operação · Turno · Gestão, aria-current) + NavigationBar inferior no mobile
  (slot do AppShell) + status de conexão UMA vez. Fim dos becos sem saída
  (P0: /turno não voltava à /operacao) e dos botões ad-hoc de navegação.
- **Vocabulário único de estado** (`task-status.tsx`): os 3 quadros divergiam
  (PENDING neutral×info; OVERDUE warn + segundo badge error). Agora: badge
  canônico + régua, um único sinal de atraso ("Atrasada há X" em error).
- **/operacao (cockpit)**: attention strip acionável (atrasadas/prazo/
  conferir/devolvidas/sem responsável — tile zerado some) funde DueAlerts +
  card de contadores; quadro em ResponsiveGrid (2–3 linhas de operação por
  viewport no tablet); triagem por situação em StickyRegion; partição
  aberta/resolvida sobre a ordem aprovada por dueAt (DONE não fura fila);
  rail da sidebar aplica filtro no toque; fila de sync com contagem.
- **Identidade glove-first**: TODA identificação (PIN contextual da /operacao,
  /turno, /encarregado) trocou Select nativo por RadioGroup do DS (alvos
  64px); sem pré-seleção de operador em tablet compartilhado; seleção
  persiste no erro de PIN; células remontam por TENTATIVA (P0: a key usava a
  string do erro — dois erros idênticos travavam as células cheias).
- **/encarregado**: página conta o DIA (Turno → exceções → quadro da equipe)
  antes da CONFIGURAÇÃO; drawer Nova tarefa em grupos O QUE/QUEM/QUANDO/
  CONTROLE; P0 corrigido (`.then(reset)` apagava campos no erro de
  validação); atribuição situacional com progressive disclosure; quadro da
  equipe na MESMA linha de operação dos demais (era o último "outro sistema",
  pego pela revisão adversarial); resumo de fechamento em linhas.
- **/turno + /turno/tarefas**: estados pós-fechamento exclusivos; resumo do
  dia no ConfirmDialog de fechamento (leitura pura; avisar ≠ impedir);
  'failed' de sync não promete mais envio automático (honestidade de estado
  terminal); denied ganha "Identificar outro operador"; datas dd/mm
  (formatador comum — fim do ISO cru); quadro individual com hora âncora,
  NumberInput pt-BR, erro junto do quadro, exceções no topo, processamento
  no card certo (Button loading).
- **Evidência**: estado explícito ("Foto adicionada"/"Nenhuma ainda");
  miniaturas AMPLIÁVEIS em Modal (a conferência julga a foto de verdade),
  alvo 64px e rótulo indexado por leitor de tela.
- **Transversal**: skeleton loading nos quadros; empty/denied com próximo
  passo; jargão de arquitetura ("autorização offline") eliminado; timeOfDay
  deduplicado em helper comum (3 cópias → 1, formatters cacheados).

**Validação**: 189 testes web (183 pré-existentes migrados semanticamente —
combobox→radio, closest(div)→article com Card as="article"+aria-labelledby —
+6 novos: Modal de evidência, tiles, partição, resumo, formatadores); 10
chamadas axe preservadas; zero overflow horizontal em 12 combinações
rota×viewport (390/834/1280/1600); jornadas completas de operador e
encarregado em Chromium real; performance com 100 tarefas: carga ~640ms,
troca de filtro ~46ms, nenhum re-render por segundo.

**Decisões registradas**:

- `app-chrome.tsx` importa useRouter em src/ui (exceção consciente à
  convenção router-neutro de src/ui: o chrome É a composição de navegação;
  packages ui-* seguem proibidos de router pela regra mecânica).
- Navegação do TopBar usa Buttons com aria-current (semântica de link real
  ficaria dependente de estilização não testada do NavigationItem fora de
  Sidebar/NavigationBar — candidato a evolução do DS).
- EvidenceGallery usa <button> nativo (não existe primitive de thumbnail
  clicável no DS — lacuna registrada; promover via processo formal se o
  padrão se repetir).

**Dívidas UX (V3)**: unificação total do vocabulário de sync (5 redações de
'queued' viraram 3); "Registrar foto" do quadro individual segue toggle
honesto-mas-manual (câmera real = pendência do backlog de evidência);
SegmentedControl de 7 opções no /encarregado quebra em 2 linhas no mobile;
ToastProvider do DS segue não montado (notices como role=status); rail de
ícones ainda usa emoji (decisão de biblioteca de ícones é lacuna formal do
DS); EmptyStates da TeamStrip consomem espaço vertical do cockpit quando a
escala está vazia.

**Fora do escopo (registrado)**: advisory novo de `pnpm audit` em
deepmerge-ts <8 via prisma (devDependency, pré-existente na main, CI não
bloqueia) — corrigir na faixa de manutenção de dependências, não neste PR.

## Custo da Carcaça V1 — app irmão de calculadora operacional (feat/carcass-cost)

**Escopo**: novo app isolado `apps/carcass-cost` (`@tauros/carcass-cost`) —
calculadora mobile-first e offline do custo real do suíno vivo transformado
em carcaça (Estimativa por premissas × Lote Real por pesos efetivos, E-se de
preço, configurações de premissas padrão, histórico local). **Não-escopo**:
nenhuma mudança em domínio/application/infrastructure/contracts, nenhuma
mudança em pacotes ui-\*, nenhum backend/auth/sincronização. Raiz tocada só
em `knip.json` (workspace novo) e `.changeset/config.json` (ignore do app
privado); lockfile regenerado.

**Decisões registradas**:

- App IRMÃO (não rota do apps/web): o root layout do web monta
  obrigatoriamente o container operacional inteiro (IndexedDB/sessão), e o
  web hoje não tem manifest/service worker — nada a reaproveitar de offline.
- Vite 6 + React 19 (SPA estática, dist/ coberto pelo turbo; storybook já
  provava o pipeline Vite sobre os fontes TS do DS). Porta dev 3010.
- Consome APENAS `@tauros/tokens` + `@tauros/theme` + `@tauros/ui-primitives`
  pelos barrels públicos; bootstrap idêntico ao providers.tsx do web
  (injectUiStyles + ThemeProvider). Nenhum primitive novo, nenhum stylesheet
  paralelo (reset estrutural mínimo e metadados PWA no index.html/manifest).
- Domínio puro em `src/domain` (fonte de verdade matemática): quebras
  sequenciais; "quebra de frio" (física, peso) separada de "transformação"
  (econômica, preço) com um único campo de UI alimentando os dois conceitos
  de forma documentada; headline inclui TODOS os custos com decomposição
  por kg visível; taxa de abate por kg OU por cabeça, nunca ambos.
- Persistência: localStorage com envelope versionado + saneamento defensivo
  (padrão do theme-storage); PWA com sw.js mínimo sem biblioteca
  (network-first navegação, cache-first assets), registro só em produção.

**Testes**: +54 no app (fórmulas com os vetores canônicos do spec — rápido
7,1875 e lote real 65.212 → 6,38/kg —, validação §25, storage, formatação
pt-BR, jornada de integração com user-event e axe). Pipeline completo local
verde; CI cobre o app automaticamente por glob (nenhuma regra do
dependency-cruiser alterada).

**Pendências registradas**: ícone do manifest usa <text> SVG (rasterizar se
algum launcher não renderizar); deploy/hosting do app fora deste escopo;
histórico sem edição de descrição do lote (só data/resumo).

**Review adversarial pré-PR** (4 dimensões × céticos; 13 achados confirmados,
todos tratados): (1) crítico PWA — o precache estático não continha o bundle
com hash do Vite (offline quebraria na 2ª abertura em tela branca); sw.js
agora é gerado no build (plugin local em vite.config.ts) com a lista real de
assets e cache versionado por conteúdo (deploy novo ⇒ SW novo ⇒ cleanup do
activate roda); gravações de cache sob event.waitUntil; registro do SW não
depende mais só do evento load. Offline provado em Chromium real com o
servidor DERRUBADO (app renderiza e calcula). No caminho descobriu-se que
`caches.match` respeita `Vary: Origin` (vite preview) e o module script (com
header Origin) nunca batia com o precache — corrigido com ignoreVary. (2)
Configurações agora edita rascunho local validado pelas regras EXPORTADAS do
domínio (headCountIssue/percentageIssue/nonNegativeIssue) com erro visível
junto ao campo — antes descartava valor inválido em silêncio e duplicava as
regras na UI. (3) Troca de tela reseta scroll e move o foco ao início. (4)
Excluir do histórico passa pelo ConfirmDialog destrutivo do DS. (5) Salvar
no histórico dá feedback e não duplica o mesmo snapshot. (6) Chips do
"E se eu pagar…" ancorados no preço digitado (não re-centram sob o dedo; o
preço original continua na lista). (7) aria-label em containers genéricos
ganhou role="group"; mensagem do peso após frio alinhada ao rótulo do campo;
apple-touch-icon em PNG 180×180. (8) Regras ADITIVAS no dependency-cruiser
(`carcass-domain-is-pure`, `carcass-ui-presents-only`) — nenhuma regra
existente alterada.

**Achado de DS (validação em Chromium real, afeta também apps/web)**: os
radios `.t-visually-hidden` do SegmentedControl são `position: absolute` e
`.t-segment`/`.t-segmented` não são positioned — o containing block vira o
documento e a posição estática deles ESTICA o `html` (scroll fantasma da
página por fora do `.t-shell-content`; página rola até ~750px de branco).
Correção candidata no DS (processo formal): `position: relative` em
`.t-segment`. Workaround aplicado no app (sem tocar o DS): wrapper
`position: relative` em volta de cada SegmentedControl + `overflow: hidden`
estrutural no html/body do index.html.

## Custo da Carcaça V2 — quebras físicas separadas do ajuste comercial (feat/carcass-model-v2)

**Mudança de regra de negócio pedida pelo responsável** (só apps/carcass-cost;
nada no DS/monorepo): a estimativa agora separa TRÊS conceitos — quebra de
ABATE (padrão 17%, sobre o peso vivo), quebra de FRIO (padrão 2,5%, sobre o
peso restante APÓS o abate) e AJUSTE COMERCIAL/exportação (padrão 7%,
econômico: incide só sobre a matéria-prima convertida, nunca sobre
abate/serviço/frete nem sobre rendimento físico). Cadeia:
`base = vivo ÷ (1−q_abate) ÷ (1−q_frio)`; `equivalente = base × 1,07`;
`final = equivalente + adicionais ÷ peso final`. Entrada da estimativa passou
a ser peso vivo MÉDIO por suíno (total = derivado, exibido, nunca digitado).
**Supera o exemplo v1** (`5,00÷0,80×1,07`): no modelo novo a quebra de frio
entra na conversão do preço. Vetores novos testados: físico 100×115 →
11.500 → 9.545 → 9.306,375 kg (80,925%) e econômico 5,20 → ≈6,88/kg. Modo
Lote Real inalterado (custo físico real, sem ajuste — confirmar com o
responsável se o equivalente deve aparecer lá também). STORAGE_VERSION 1→2
(envelope antigo rejeitado, sem migração implícita). UI: campo único
"quebra de frio/transformação" virou dois campos + seção própria de Ajuste
comercial; resumo mostra a cadeia (total → após abate → carcaça final);
headline da estimativa renomeado "Custo final equivalente".

## Custo da Carcaça V2.1 — aba Custos simplificada (feat/carcass-costs-section)

**Pedido do responsável** (só apps/carcass-cost): removido o seletor
"Por kg / Por cabeça" — a taxa de abate é SEMPRE R$/cabeça (o suporte a
R$/kg deixou de existir, inclusive no Lote Real). O frete único virou dois
campos independentes de custo da VIAGEM (diária do motorista + combustível),
nunca multiplicados pela quantidade de suínos. Fórmulas: `custo_abate =
n × taxa`, `custo_serviço = n × taxa`, `custo_viagem = diária + combustível`,
`adicional_por_kg = total ÷ peso FINAL da carcaça` (V2 intacta; o +7% segue
só na matéria-prima). Resultado exibe explicitamente "Custos adicionais da
operação" (R$), "Impacto dos custos adicionais" (R$/kg) e o custo final
equivalente. Padrões: 50 / 3 / 150 / 0. STORAGE_VERSION 2→3 (sem migração
implícita). Vetores: canônico real 65.212 → 6,38 preservado; realista da
estimativa 5.700 ÷ 9.306,375 = 0,6125/kg ⇒ ≈7,49/kg; dobrar suínos dobra
abate/serviço mas não a viagem. Defaults da estimativa passam de 7,20/kg
(antes 7,16 com abate 0,50/kg — modelo por kg extinto).

## Custo da Carcaça V2.2 — Ajuste rápido de preço na tela de resultado (feat/carcass-quick-price)

Atalho de simulação na Estimativa: seção "Ajuste rápido" antes do card de
resultado com o campo de preço do vivo (CurrencyInput do DS) ligado ao MESMO
estado das Entradas (patchQuick.livePricePerKg) — nenhuma lógica duplicada,
recálculo imediato pelo motor V2 (+7% só no custo-base; adicionais fixos
diluídos pelo peso final). Só na Estimativa (Lote Real intocado). Testes:
motor V2 nos preços 5,00/5,20/5,50/6,00 (domínio) + jornada UI dos quatro
preços com parâmetros restantes intocados + sincronização bidirecional com o
campo das Entradas + ausência na aba Lote Real.

## Custo da Carcaça V2.3 — acréscimos fixos: oportunidade + CENAR (feat/carcass-fixed-surcharges)

Dois acréscimos FIXOS somados UMA vez ao custo final equivalente da
Estimativa (constantes no domínio, sem campos editáveis, sem rateio por
peso/viagem/cabeça e sem o +7% por cima): custo de oportunidade R$ 0,05/kg
(descarga não realizada) + imposto CENAR R$ 0,01/kg = +R$ 0,06/kg. Card
exibe as três linhas (oportunidade com legenda, CENAR, impacto total).
Motor V2 e Lote Real intactos (o pedido nomeia custo_final_equivalente —
aplicado só à Estimativa; estender ao Lote Real fica como pergunta aberta).
Vetores: lote padrão 7,46 → 7,52 (exemplo do pedido); 11.500 kg + 5.980 →
7,58; realista 7,49 → 7,55; validações individuais (+0,05 / +0,01 / +0,06).

## Custo da Carcaça V2.4 — remoção do "E se eu pagar…" (feat/carcass-remove-whatif)

Removida por completo a seção de chips de preços rápidos (título, descrição,
botões e toda a cadeia exclusiva: whatIf/âncora/applyPrice no controller e
whatIfPrices no domínio, com seus testes). O "Ajuste rápido" do preço do vivo
na tela de resultado PERMANECE como o caminho de simulação (mesmo estado das
Entradas, recálculo imediato). Motor V2, custos, +7% e acréscimos fixos
intactos. Teste novo garante a ausência da seção; teste do salvar passou a
alterar o preço pelo Ajuste rápido. 69 testes.

## Custo da Carcaça V3 — aba Transformação (indicador econômico de subprodutos) (feat/carcass-transformation)

Nova aba/tela "Transformação": o usuário edita peso e preço de venda de 7
subprodutos (cabeça, retalho, banha, papada, mãozinha, orelha, rabinho) e o
preço da carcaça de exportação (padrão R$ 7,70/kg). O domínio novo
(`transformation.ts`) calcula o INDICADOR ECONÔMICO = valor total dos
subprodutos ÷ valor da carcaça de exportação, onde a carcaça =
115 kg × rendimento físico REFERÊNCIA (17%/2,5%, constantes fixas —
reusa calculateFinalYield, não recalcula quebra) × preço de exportação.
Dados iniciais ⇒ 49,95 ÷ 716,590875 = **6,9705%** (não arredonda p/ 7 no
domínio; UI mostra 6,97%, padrão 7,00%, diferença -0,03 p.p.).

**Integração (o ponto central):** o indicador SUBSTITUI o antigo campo fixo
de 7% como o `commercialAdjustmentPct` da Estimativa. `commercialAdjustmentPct`
saiu de `QuickForm`/`DefaultSettings`/Configurações/tela; `buildQuickInput`
passou a receber o pct pronto (3º arg); o controller injeta
`resolveCommercialAdjustmentPct(transformation)` (fallback 7% se denominador
inválido). O MOTOR V2 é intacto (`QuickEstimateInput.commercialAdjustmentPct`
continua igual; +7% só no custo-base; oportunidade 0,05 + CENAR 0,01 seguem
fixos, sem receber o indicador). Default da Estimativa passou de 7,26 → 7,25
(indicador 6,97% no lugar de 7%). STORAGE_VERSION 3→4 (transformação
persistida; envelope antigo rejeitado sem migração). Acesso pela aba
(header "Transformação") e por "Ajustar subprodutos" na seção Ajuste comercial
da Estimativa (agora read-only mostrando o indicador vigente).

Testes: +transformation.test.ts (valores, soma, carcaça, indicador 6,97%,
reatividade preço/peso/carcaça, fallback) + integração UI (alterar papada
15,00 → indicador 7,67% → Estimativa 7,25→7,30; export 9,00 → 5,96%;
persistência; acréscimos fixos intactos). 83 testes no app; suíte e pipeline
verdes; jornada mobile validada em Chromium real (build de produção).

## Custo da Carcaça V3.1 — correção da fórmula do indicador de Transformação (fix/carcass-transformation-formula)

A fórmula V3 (`recuperado ÷ valor da carcaça`) tinha DIREÇÃO ERRADA (subia
quando o preço de venda subia). Corrigida para o INDICADOR ECONÔMICO DE
TRANSFORMAÇÃO definido pelo responsável:
`perda = (peso_total_subprodutos × preço_carcaça) − valor_recuperado`;
`indicador = perda ÷ valor_carcaça_exportação`. Agora ↑ preço de venda →
↑ recuperação → ↓ perda → ↓ indicador (comprovado em teste e navegador:
papada 12,99→15,00 leva o indicador de 1,63% para 0,92% e a Estimativa de
6,92 para 6,88/kg). Dados iniciais: 8 kg, R$ 49,95 recuperado, R$ 61,60
teórico, R$ 11,65 de perda, **indicador ≈ 1,63%** (nunca 7%). O 7% deixou
de existir: removidos `DEFAULT_COMMERCIAL_ADJUSTMENT_PCT`, o fallback
silencioso e as linhas "Padrão histórico 7,00%"/"Diferença" da aba —
indicador inválido (denominador ≤ 0) vira `null` e deixa a Estimativa
pendente, sem inventar percentual. Peso vivo COMPARTILHADO da Estimativa
(state.quick.avgLiveWeightKg, fallback 115) para o valor da carcaça; sem
segundo campo. Pele NÃO existe na equação nem na aba (7 subprodutos).
Motor V2 intacto (17%/2,5%, oportunidade 0,05, CENAR 0,01 independentes;
Lote Real inalterado). Sem mudança de arquitetura, storage ou boundaries.
Default da Estimativa 7,25 → 6,92. 84 testes.

## Custo da Carcaça V3.2 — rodada UX/UI compacta, sem mudança de regra (feat/carcass-ux-compact)

Tarefa exclusivamente de composição (skill `frontend-design` subordinada ao
DS): nenhuma fórmula, regra, estado, persistência ou cálculo foi alterado —
os 84 testes anteriores (vetores numéricos incluídos) passaram sem ajuste de
número; só rótulos de campo mudaram nos seletores. Viewport-alvo 390×844.
Rolagem medida em Chromium (altura do conteúdo a 390 px, antes → depois):
Estimativa 3.752 → 2.218 px (−41%); Lote Real 2.908 → 1.568 (−46%);
Transformação 2.882 → 1.525 (−47%); Configurações 1.435 → 941 (−34%);
Histórico 446 → 354 (−21%).

O que mudou (tudo via API pública do DS, tokens por `cssVar`, sem literal):
Transformação com card do indicador no topo + 7 linhas compactas (nome e
valor recuperado na mesma linha; "Peso [ ] Preço/kg [ ]" lado a lado com
`Label` + id explícito, sem `Field`) + barra fixa com o indicador;
entradas em `Grid` de 2 colunas; explicações longas viraram "?"
(`IconButton` + nota inline `aria-expanded/aria-controls`); "Resumo do
lote", composição do custo e do indicador em linhas "razão" (`LedgerRow`:
rótulo em `emphasis-level4-size`, valor em `data` — hierarquia
entrada/cálculo/resultado); navegação e "Voltar" em `secondary`
(borda visível); eyebrows e descrições de cabeçalho removidos.
Composições locais novas em `apps/carcass-cost/src/ui/`: `help.tsx`,
`ledger.tsx`, `grid-field.tsx`, `screen-header.tsx`.

Restrições do DS encontradas (registradas, NÃO contornadas — DS congelado):

1. `size-control-min` = 64 px (glove) em TODO controle; `sm/md/lg` só mudam
   padding/fonte. A altura dos inputs pedida na tarefa NÃO foi reduzida —
   compactação veio do layout. Consequência: o "?" também tem 64 px.
2. `PageHeader` empilha `actions` abaixo do título em telas estreitas (uma
   linha de 64 px a mais por tela) → `ScreenHeader` local (título + Voltar
   na mesma linha). Sugestão para o DS: variante inline das ações no mobile.
3. `Tooltip` abre por hover/foco; no iPhone o toque em botão não dá foco →
   nota inline em vez de tooltip/popover. `Popover` do DS traz trigger
   próprio (texto) sem nome acessível separado → não usado.
4. `Field` só tem layout vertical (rótulo acima) → linha compacta usa `Label`
   - `id`. Sugestão: `Field` com `layout="inline"`.
5. `.t-section-header` alinha ações em `flex-start` → título fica no topo ao
   lado de um botão de 64 px; `HelpSection` monta o cabeçalho com `Flex
align="center"` e nomeia a região por `aria-label`.
6. Em `Grid` de 2 colunas, rótulo de 2 linhas desalinha o campo vizinho →
   `GridField` (controle na base da célula, `margin-top: auto`).

Ajuste pós-rodada (fix/carcass-subproduct-price-label): rótulo do preço nas
7 linhas de subproduto "Preço/kg" → "R$/Kg" (microcopy; libera largura para
o campo mostrar "R$ 12,99" inteiro). Nenhuma outra alteração; domínio,
estado e cálculo intocados.

## Custo da Carcaça — auditoria matemática da Estimativa (test/carcass-estimate-audit)

Print com R$ 6,71/kg para preço 4,80, quebras 17%/2,5%, indicador 1,63% e
adicionais ≈ 0,59/kg. Auditoria da cadeia (código + reprodução em Chromium
390×844 no build de produção): indicador aplicado UMA vez (só sobre o
custo-base), acréscimos 0,05 + 0,01 somados UMA vez, adicionais rateados
pelo MESMO peso final exibido ("Carcaça estimada"), nenhum valor oculto —
`total = equivalente + adicionais/kg + 0,06` exatamente. Com essas entradas
a tela exibe **R$ 6,67/kg** (5,93 → +0,10 → 6,03 → +0,58/0,59 → +0,06).
**6,71 não é reprodutível com as entradas listadas**: só aparece com preço
4,83 ou quebra de abate 17,5% (ambos verificados no app). Conclusão: sem
divergência na cadeia; nenhuma regra alterada. Testes adicionados fixando o
cenário (domínio: etapas, incidência única, denominador, contra-exemplos;
UI: Ajuste rápido 4,80 → 6,67). Diagnóstico para o print: "Carcaça antes
do ajuste" 5,93 = entradas como listadas; 5,97 = preço 4,83 ou abate 17,5%
(neste caso "Rendimento final" mostra 80,44% em vez de 80,93%).

## Custo da Carcaça V3.3 — formação visual do custo + refinamento de UX (feat/carcass-cost-formation)

Só apresentação (src/ui + testes); domínio, estado e cálculo intocados.
Card de resultado ganhou a sequência "parcela → subtotal → total"
(`cost-formation.tsx`): coluna de sinal (+ / =), nota curta de origem por
parcela ("R$ 4,80/kg vivo ÷ 80,93% de rendimento", "Indicador 1,63% dos
subprodutos", "R$ 5.980,00 ÷ 10.237,01 kg", "Descarga não realizada"),
traço acima das linhas "=", total em destaque — tudo com valores já
calculados pelo domínio. Cenário 110×115, 4,80: 5,93 → +0,10 → 6,03 →
+0,58 → +0,05 → +0,01 → 6,67 (validado em Chromium 390×844; linha
"Impacto total dos acréscimos +0,06" saiu — parcelas 0,05 e 0,01 já
aparecem). "?" passou a `IconButton` ghost com glifo de 24 px (círculo,
tokens do DS) mantendo o alvo de toque de 64 px e o nome acessível.
Hierarquia de botões com variantes do DS: Salvar lote = `primary`; Excluir
= `danger`; "Ajustar subprodutos" = `secondary` com contorno/texto em
`color-accent-default` (ligado ao card do indicador); navegação e Voltar
seguem `secondary` neutros. Testes de UI novos (composição = valores do
domínio via `calculateQuickEstimate`; preço e subprodutos recalculam a
composição; "?" acessível; variantes). NBSP do `Intl` nos matchers:
normalizar o esperado (`plain()`), a Testing Library só normaliza o DOM.
93 testes. Altura da Estimativa 2.218 → 2.274 px (+56, as 4 notas).

## Custo da Carcaça V3.4 — indicador comercial de Desossa (feat/carcass-deboning)

Nova área **Desossa**, independente da Transformação (só `apps/carcass-cost`;
Transformação, Estimativa e o custo equivalente da carcaça intocados — teste
de UI prova 6,92/kg e 1,63% inalterados após editar a desossa).
Reproduz a estatística comercial da operação: carcaça (peso, valor inicial)

- produtos (peso, R$/kg) → `valor = peso × preço`, `percentual = peso ÷ peso
da carcaça`, `valor comercial = Σ`, `acréscimo = comercial − carcaça`,
`margem = acréscimo ÷ comercial`. Cenário da planilha fixado em teste:
1.128,10 kg / R$ 13.029,56 → **R$ 16.829,56 · + R$ 3.800,00 · 22,58%**;
  peso dos produtos 1.128,81 kg → **100,06%** (exibido como está, não
  corrigido). A planilha arredonda linha a linha; o domínio soma com precisão
  total (16.829,5573 / 3.799,9973) e a apresentação coincide — registrado,
  não silenciado.

Decisões: (1) domínio puro novo `domain/deboning.ts` (cálculo, forma,
validação — `positiveIssue`/`nonNegativeIssue` reutilizados); (2) estado na
sub-árvore `deboning` do MESMO envelope (`STORAGE_VERSION` 4 mantida: mudança
aditiva, o saneamento campo a campo preenche os padrões quando ausente e
preserva o restante — sem migração, sem apagar o estado do operador);
(3) histórico de desossas em chave própria
(`tauros.carcass-cost.deboning-history.v1`), listado na tela Histórico
(seção "Desossas", só quando há registro; lotes ganharam o título "Lotes");
(4) navegação passou de 3 para 4 telas em `Grid columns={2}` (2×2): quatro
botões lado a lado não cabem em 390 px ("Transformação"/"Configurações"
quebrariam) e `ResponsiveGrid`/`Tabs`/`NavigationBar` seriam navegação
paralela ou dependeriam de medida em `ch`; (5) lista de produtos editável
sem tela nova — "Editar" (ghost, `aria-pressed`) revela nome editável
e "Remover" por linha; "Adicionar produto" (secondary) já entra em edição;
(6) `CostFormation` ganhou o tipo `subtract` (acréscimo negativo) e
`format.ts` o `formatSignedBRL` — aditivos, sem tocar na formação do custo.
Botões: Salvar análise `primary`, Excluir análise `danger` (ConfirmDialog),
Adicionar `secondary`, Voltar `secondary`. Nenhuma alteração no DS; nenhum
ADR necessário (app isolado, mesmas camadas e regras do dependency-cruiser).
Campos vazios de produto contam 0; carcaça sem peso ou valor negativo ⇒
resultado nulo com mensagem no campo (nada inventado).
Testes: 19 de domínio (11 casos do pedido), +6 de storage, +11 de UI
(jornada, isolamento, persistência, "?" e axe) — 132 no app.
