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
