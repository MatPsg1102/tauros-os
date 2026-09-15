# Agent Development State

Checkpoint compacto entre **GPT** (supervisor), **Claude Code** (executor) e o **responsável humano**.
Não é histórico: registra só o necessário para a próxima iteração. O contrato de execução está em
[agent-execution-protocol.md](agent-execution-protocol.md); histórico e decisões formais continuam
na [matriz de rastreabilidade](design-system/traceability-5.3-to-6.3.md). Este arquivo é versionado:
toda alteração dele entra no mesmo PR da iteração que a produziu.

## Current Goal

**Custo da Carcaça + Desossa** (`apps/carcass-cost`, pacote `@tauros/carcass-cost`) é tratado, por
enquanto, como **produto vertical próprio**: app irmão isolado no monorepo, que consome apenas
`@tauros/tokens`, `@tauros/theme` e `@tauros/ui-primitives`; nada no monorepo depende dele.
**Não integrar ao Tauros OS neste momento.**

Evolução planejada (uma fase por vez; cada fase começa por gate humano):

1. **FASE 1 — Auth Supabase.**
2. **FASE 2 — Persistência multiusuário.**
3. **FASE 3 — Offline/sincronização.**
4. **Integração completa ao Tauros OS: POSTERIOR** (fora do horizonte atual).

Em paralelo ao produto, o **Loop Engineering** (fluxo supervisionado GPT ↔ Claude Code) evolui por
etapas próprias: Etapa 0 = protocolo + estado (concluída); Etapa 1 = design da bridge/orquestrador
local (aprovado e na `main`); pré-requisitos da primeira vertical slice manual mergeados (PR #60);
em curso = correção do GATE 1 na fonte declarativa de gate paths; L-0001 aprovado e liberado
operacionalmente só após o merge dessa correção (ainda não iniciado).

## Current Phase

**Etapa 1 do Loop Engineering — correção do GATE 1 na fonte declarativa de gate paths** em PR
documental: `packages/domain/**` passa a ser superfície do GATE 1. Pré-requisitos da slice mergeados
(PR #60). **HANDOFF de L-0001 aprovado** com dois orçamentos independentes; **L-0001 não iniciado**,
liberado operacionalmente só após o merge desta correção. Produto: V3.4.1 entregue (PR #55).
**FASE 1 (Auth Supabase) NÃO iniciada.**

## Last Approved Baseline

- `main` = `4873a77` — PR #60 `docs(agent-slice): pré-requisitos mínimos da primeira vertical slice manual do Agent Bridge`, squash-merge em 2026-09-15T13:09Z. CI da `main` em `4873a77`: run `34973264904`, em andamento no momento da coleta; o head do PR #60 (`f4c40ea`) teve `verify` e `architecture` verdes. CI da `main` em `0e95473` (PR #59) concluiu verde nos dois jobs.
- Design da bridge: PR #58 mergeado (`9c79160`, 2026-09-15T11:54Z); [agent-bridge-design.md](agent-bridge-design.md) está na `main`.
- Etapa 0 (PR #56, `caaf0e9`) concluída e versionada; protocolo de execução em vigor.
- Último PR de produto: #55 (`b096268`, Custo da Carcaça V3.4.1). Produção https://carcass-cost.vercel.app serve o bundle desse commit (`index-DaEjw6mv.js`).
- PR aberto: o PR documental de correção do GATE 1 (branch `docs/agent-gate1-domain-path`, dois arquivos: `docs/agent-gate-paths.md` e este checkpoint), aguardando `verify` + `architecture` e GATE 6.

## Current Branch

`main`, sincronizada com `origin/main`. Branch de trabalho: `docs/agent-gate1-domain-path` (esta
iteração). Untracked locais que **não devem ser versionados**: `.agents/` (skill `frontend-design`),
`.claude/skills/` (symlink para `.agents/`) e `skills-lock.json`. A pasta `.agent-loop/` (ignorada
pelo git desde o PR #60) ainda não existe; é criada localmente ao iniciar um loop e nunca é versionada.

## Current Loop

Seção escrita pela bridge — na fase manual, pelo executor ao fechar cada iteração — conforme o design
(§3.5). Loop L-0002 em execução (iteração 1): Agent Bridge MVP, subcomando `decide`.

```text
LOOP_ID: L-0002
LAST_LOOP_ID: L-0001
ITERATION: 2
HANDOFF_REF: .agent-loop/inbox/L-0002.handoff.md
STARTED: 2026-09-15T14:52Z
HUMAN_INTERVENTIONS: 1
FAILED_ITERATIONS: 0
LOOPS_THIS_SESSION: 2
```

## Approved Decisions

Somente o necessário para continuar (fontes: `apps/carcass-cost/README.md`, traceability, ADRs, PRs #56–#60):

- **Protocolo em vigor**: [agent-execution-protocol.md](agent-execution-protocol.md) (ciclo, gates 1–8, handoff, ordem de contexto) é o contrato de toda iteração.
- **Design da bridge aprovado (revisão 3, PR #58, `9c79160`)** — [agent-bridge-design.md](agent-bridge-design.md): Autonomy Envelope por objetivo (só o humano alarga; o GPT mantém ou estreita); gates 1 e 2 = CONDITIONAL, 3 e 4 = HARD no núcleo com CONDITIONAL só para implementação explicitamente aprovada (qualquer política RLS sai do envelope salvo política exata aprovada), 5, 6 e 7 = HARD, 8 = CONDITIONAL com detecção mecânica; CI_VERIFIED encerra o engineering loop, MERGED atrás do GATE 6, DEPLOYED fora do loop e atrás do GATE 7 quando houver ação explícita; `change_budget` 10 arquivos / 300 linhas / 0 dependências é **default** redefinível por HANDOFF aprovado; segunda ocorrência da mesma assinatura de falha encerra a **iteração** como FAILED, não o objetivo; `NEXT_OBJECTIVE_PROPOSAL` é informacional e não executável; métricas HUMAN_INTERVENTIONS_PER_OBJECTIVE, ITERATIONS_PER_OBJECTIVE e FAILED_ITERATIONS_PER_OBJECTIVE medidas a partir de agora.
- **Decisão operacional provisória para a primeira vertical slice**: o humano observa o CI; tempo aguardando CI **não** conta como HUMAN_INTERVENTION; intervenção = decisão ou ação humana necessária para o objetivo prosseguir.
- **Pré-requisitos da vertical slice mergeados** (PR #60, `4873a77`): regra `.agent-loop/` no `.gitignore` (pasta local, nunca versionada), seção `Current Loop` neste checkpoint e [agent-gate-paths.md](agent-gate-paths.md) como fonte declarativa única dos gate paths, derivada só do design. Nenhum template adicional: os formatos de HANDOFF/RESULT/DECISION são os do design (§3). O transporte continua manual — a slice prova o protocolo antes de automatizar o transporte.
- **GATE 1 — Domain Rules inclui `packages/domain/**`** (decisão do responsável, 2026-09-15): é superfície de domínio do Tauros OS e sua ausência criava ponto cego na detecção mecânica. Corrigido só na fonte declarativa; **não autoriza** nenhuma alteração em `packages/domain/**`; não misturado com L-0001.
- **L-0001 — HANDOFF aprovado (2026-09-15) com correção normativa; execução liberada só após o merge da correção do GATE 1**: OBJECTIVE = corrigir a linha "Estado atual" do `CLAUDE.md` (não afirmar `main` na tag `design-system-v1.0`; a tag só como milestone histórico; estado operacional pelo Git e por este checkpoint; sem contagem absoluta de testes nem outra informação perecível); SCOPE executável = só `CLAUDE.md`; FORBIDDEN, CONTEXT (4 arquivos), VERIFY, DONE_WHEN (10 critérios binários), AUTONOMY, BRANCH `docs/claude-md-estado-atual`, artefatos em `.agent-loop/` e transporte manual conforme o HANDOFF apresentado. **Dois orçamentos independentes**: EXECUTABLE_CHANGE_BUDGET files=1, net_lines=5, dependencies=0 (só `CLAUDE.md`); STATE_BOOKKEEPING_BUDGET files=1, net_lines=12 (só este checkpoint, e só Current Loop, Current Evidence para consolidar o resultado, Next Action, Human Gate e Last Updated — nunca decisões, arquitetura, SCOPE, Approved Decisions, Open Questions ou requisitos). Exceder qualquer orçamento = HUMAN_GATE. Após o RESULT de cada iteração o executor **para** e aguarda a DECISION do GPT por transporte manual; nunca a fabrica.
- **Vertical isolado.** `apps/carcass-cost` não entra em `apps/web`, `packages/*` de domínio/aplicação/infra, `prisma/` nem `supabase/`. Regras aditivas do dependency-cruiser `carcass-domain-is-pure` e `carcass-ui-presents-only` permanecem.
- **Fórmulas só em `src/domain`** (TypeScript puro, sem React); UI apenas apresenta; nada arredonda internamente (2 casas só em `ui/format.ts`).
- **Desossa é indicador comercial independente**: nada da Desossa alimenta Transformação nem Estimativa (6,92/kg e 1,63% intactos são invariantes cobertas por teste).
- **Persistência atual = `localStorage`** com envelope versionado (`STORAGE_VERSION` 4); mudanças de estado são aditivas com saneamento defensivo; nunca apagar estado do operador.
- **README do app declara fora de escopo: login, backend, sincronização.** Essa declaração só é revisada quando a FASE 1 for aprovada (GATE 4 + GATE 8).
- **ADR-021** define a identidade operacional do Tauros OS (Employee + PIN; Supabase Auth explicitamente adiado). A FASE 1 do carcass-cost **não reutiliza nem contradiz** essa decisão sem deliberação explícita.
- **Processo do repositório permanece**: branch `<tipo>/<escopo>`, Conventional Commits, PR, CI verde nos dois jobs, squash, aprovação humana entre etapas; tag e deploy só com autorização.

## Forbidden Changes

No escopo atual (correção do GATE 1 em PR; até nova aprovação registrada aqui):

- Merge de qualquer PR sem GATE 6.
- Executar L-0001 enquanto o PR de correção do GATE 1 estiver aberto; fabricar a DECISION do GPT; versionar a pasta `.agent-loop/` ou seu conteúdo; criar templates além dos formatos já definidos no design.
- Alterar `packages/domain/**`: a inclusão no GATE 1 não autoriza nenhuma mudança lá.
- Gravar no `CLAUDE.md` contagem absoluta de testes ou outra informação de estado perecível.
- Qualquer automação executável do fluxo: daemon, watcher, chamadas à OpenAI/Anthropic, scripts que enviem prompts, loops, bots/webhooks do GitHub, MCP novo, automação de VS Code — inclusive "protótipos".
- Qualquer alteração em aplicações, produto, domínio, banco (`prisma/`, `supabase/`), CI (`.github/`), hooks ou dependências (`package.json`, `pnpm-lock.yaml`).
- Fórmulas e regras de negócio do carcass-cost (GATE 1), inclusive "correções" de arredondamento.
- Início da FASE 1 (auth Supabase), schema, migration ou RLS: exige gate humano (GATE 2, GATE 3, GATE 4, GATE 8).
- Artefatos congelados (SAS, ADR-018/019/020, Configuration Baseline v1.0, Design System), tags, commit/push direto na `main`, deploy.
- Versionar `.agents/`, `.claude/`, `skills-lock.json` ou qualquer valor do `.env`.

## Current Evidence

Coletado em 2026-09-15T13:14Z:

- **git**: `main` = `4873a77` = `origin/main`; PRs #58, #59 e #60 mergeados; branch `docs/agent-gate1-domain-path` com exatamente dois arquivos: `docs/agent-gate-paths.md` e este checkpoint. `packages/domain/` existe no repositório.
- **CI**: head do PR #60 (`f4c40ea`) — `verify` success, `architecture` success; `main` em `4873a77` — run `34973264904` em andamento no momento da coleta.
- **testes**: nenhum código de produto alterado desde `b096268`; última evidência válida: `pnpm --filter @tauros/carcass-cost test` → 136 passed, 7 arquivos.
- **implementação**: desde `caaf0e9` só documentação e uma linha de `.gitignore`; nenhum código, dependência, CI, hook ou infra alterados; nenhum arquivo executável; `.agent-loop/` não existe.
- **métricas (processo manual, primeiro registro)**: objetivo "design da bridge" — ITERATIONS 3 (v1, revisão 2, revisão 3), HUMAN_INTERVENTIONS 2 (pedido da revisão 2; ajustes da revisão 3), FAILED_ITERATIONS 0. Métricas de loop passam a viver em `Current Loop`; ao fechar cada loop, uma linha aqui consolida HUMAN_INTERVENTIONS, ITERATIONS, FAILED_ITERATIONS, DONE_LEVEL alcançado, `change_budget` previsto e consumido e arquivos de contexto usados.
- **L-0001 fechado (DECISION DONE, 2026-09-15T14:22Z)**: DONE_LEVEL CI_VERIFIED; ITERATIONS 1; FAILED_ITERATIONS 0; HUMAN_INTERVENTIONS 0; EXECUTABLE_CHANGE_BUDGET previsto files=1/net_lines=5/dependencies=0, consumido files=1/net_lines=0/dependencies=0; STATE_BOOKKEEPING_BUDGET previsto files=1/net_lines=12, consumido na iteração 1 files=1/net_lines=−3; contexto 3 de 4 arquivos; PR #62; commit `1b643d5`; CI run `34975231171` com `verify` e `architecture` verdes.

## Open Questions

Nenhum bloqueio real. Decisões abertas do design, não bloqueantes: (1) calibração do default de
`change_budget` com loops reais; (2) lista de caminhos do GATE 3 quando a FASE 1 Auth for desenhada;
(3) observação do CI — coberta provisoriamente pela decisão operacional acima. A divergência do
GATE 1 (`packages/domain/**`) foi decidida e corrigida nesta iteração.

## Next Action

L-0002 iteração 2 (RETRY humano após GATE 8 de orçamento) na branch `feat/agent-bridge-decide` (HANDOFF aprovado em
2026-09-15): implementar `tooling/agent-bridge.mjs decide`, testes sem rede, prova real com os
artefatos de L-0001, RESULT em `.agent-loop/outbox/L-0002.1.result.md` e **parar** até a DECISION.

## Human Gate

**HUMAN_APPROVAL_REQUIRED** — (a) GATE 6 do PR de L-0002; (b) DECISION do GPT após
cada RESULT de L-0001, entregue por transporte manual; (c) qualquer implementação da bridge ou
automação do transporte; (d) FASE 1 (Auth Supabase) só começa com aprovação explícita
(GATE 3 / GATE 4 / GATE 8).

## Last Updated

2026-09-15T15:02Z — Claude Code (L-0002 iteração 2 após HUMAN_GATE de orçamento → RETRY humano).
