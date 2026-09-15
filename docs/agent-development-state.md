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
local (aprovado e na `main`); em curso = pré-requisitos da primeira vertical slice manual do Agent
Bridge (L-0001, ainda não iniciado).

## Current Phase

**Etapa 1 do Loop Engineering — pré-requisitos da primeira vertical slice manual do Agent Bridge**
em PR documental: regra `.agent-loop/` no `.gitignore`, seção `Current Loop` neste checkpoint e
`docs/agent-gate-paths.md`. O design está aprovado (revisão 3) e na `main`. **L-0001 não iniciado**:
seu HANDOFF será aprovado separadamente após o merge dos pré-requisitos. Produto: V3.4.1 entregue
(PR #55). **FASE 1 (Auth Supabase) NÃO iniciada.**

## Last Approved Baseline

- `main` = `0e95473` — PR #59 `docs(agent-state): checkpoint — design da bridge aprovado (rev. 3) e em PR #58`, squash-merge em 2026-09-15T12:53Z. CI da `main` em `0e95473`: run `34971593655`, em andamento no momento da coleta; o head do PR #59 (`d54dfb1`) teve `verify` e `architecture` verdes.
- Design da bridge: PR #58 mergeado (`9c79160`, 2026-09-15T11:54Z); [agent-bridge-design.md](agent-bridge-design.md) está na `main`.
- Etapa 0 (PR #56, `caaf0e9`) concluída e versionada; protocolo de execução em vigor.
- Último PR de produto: #55 (`b096268`, Custo da Carcaça V3.4.1). Produção https://carcass-cost.vercel.app serve o bundle desse commit (`index-DaEjw6mv.js`).
- PR aberto: o PR documental de pré-requisitos da slice (branch `docs/agent-slice-prereqs`, três arquivos), aguardando `verify` + `architecture` e GATE 6.

## Current Branch

`main`, sincronizada com `origin/main`. Branch de trabalho: `docs/agent-slice-prereqs` (esta
iteração). Untracked locais que **não devem ser versionados**: `.agents/` (skill `frontend-design`),
`.claude/skills/` (symlink para `.agents/`) e `skills-lock.json`. A pasta `.agent-loop/` (ignorada
pelo git a partir deste PR) ainda não existe; é criada localmente ao iniciar um loop e nunca é versionada.

## Current Loop

Seção escrita pela bridge — na fase manual, pelo executor ao fechar cada iteração — conforme o design
(§3.5). Contadores zerados: nenhum loop iniciado.

```text
LOOP_ID: none
LAST_LOOP_ID: none
ITERATION: 0
HANDOFF_REF: none
STARTED: none
HUMAN_INTERVENTIONS: 0
FAILED_ITERATIONS: 0
LOOPS_THIS_SESSION: 0
```

## Approved Decisions

Somente o necessário para continuar (fontes: `apps/carcass-cost/README.md`, traceability, ADRs, PRs #56–#59):

- **Protocolo em vigor**: [agent-execution-protocol.md](agent-execution-protocol.md) (ciclo, gates 1–8, handoff, ordem de contexto) é o contrato de toda iteração.
- **Design da bridge aprovado (revisão 3, PR #58, `9c79160`)** — [agent-bridge-design.md](agent-bridge-design.md): Autonomy Envelope por objetivo (só o humano alarga; o GPT mantém ou estreita); gates 1 e 2 = CONDITIONAL, 3 e 4 = HARD no núcleo com CONDITIONAL só para implementação explicitamente aprovada (qualquer política RLS sai do envelope salvo política exata aprovada), 5, 6 e 7 = HARD, 8 = CONDITIONAL com detecção mecânica; CI_VERIFIED encerra o engineering loop, MERGED atrás do GATE 6, DEPLOYED fora do loop e atrás do GATE 7 quando houver ação explícita; `change_budget` 10 arquivos / 300 linhas / 0 dependências é **default** redefinível por HANDOFF aprovado; segunda ocorrência da mesma assinatura de falha encerra a **iteração** como FAILED, não o objetivo; `NEXT_OBJECTIVE_PROPOSAL` é informacional e não executável; métricas HUMAN_INTERVENTIONS_PER_OBJECTIVE, ITERATIONS_PER_OBJECTIVE e FAILED_ITERATIONS_PER_OBJECTIVE medidas a partir de agora.
- **Decisão operacional provisória para a primeira vertical slice**: o humano observa o CI; tempo aguardando CI **não** conta como HUMAN_INTERVENTION; intervenção = decisão ou ação humana necessária para o objetivo prosseguir.
- **Pré-requisitos da vertical slice aprovados** (2026-09-15): regra `.agent-loop/` no `.gitignore` (pasta local, nunca versionada), seção `Current Loop` neste checkpoint e [agent-gate-paths.md](agent-gate-paths.md) como fonte declarativa única dos gate paths, derivada só do design. Nenhum template adicional: os formatos de HANDOFF/RESULT/DECISION são os do design (§3). O transporte continua manual — a slice prova o protocolo antes de automatizar o transporte.
- **L-0001 (proposta conceitualmente aprovada; HANDOFF ainda não aprovado, não executar)**: corrigir a linha "Estado atual" do `CLAUDE.md` para não afirmar que a `main` está na tag `design-system-v1.0` e orientá-la a obter o estado real pelo Git e por este checkpoint; **sem introduzir contagem absoluta de testes** nem outra informação perecível; a tag só pode ser citada como último milestone, se factual; SCOPE = `CLAUDE.md`; só a menor região necessária muda.
- **Vertical isolado.** `apps/carcass-cost` não entra em `apps/web`, `packages/*` de domínio/aplicação/infra, `prisma/` nem `supabase/`. Regras aditivas do dependency-cruiser `carcass-domain-is-pure` e `carcass-ui-presents-only` permanecem.
- **Fórmulas só em `src/domain`** (TypeScript puro, sem React); UI apenas apresenta; nada arredonda internamente (2 casas só em `ui/format.ts`).
- **Desossa é indicador comercial independente**: nada da Desossa alimenta Transformação nem Estimativa (6,92/kg e 1,63% intactos são invariantes cobertas por teste).
- **Persistência atual = `localStorage`** com envelope versionado (`STORAGE_VERSION` 4); mudanças de estado são aditivas com saneamento defensivo; nunca apagar estado do operador.
- **README do app declara fora de escopo: login, backend, sincronização.** Essa declaração só é revisada quando a FASE 1 for aprovada (GATE 4 + GATE 8).
- **ADR-021** define a identidade operacional do Tauros OS (Employee + PIN; Supabase Auth explicitamente adiado). A FASE 1 do carcass-cost **não reutiliza nem contradiz** essa decisão sem deliberação explícita.
- **Processo do repositório permanece**: branch `<tipo>/<escopo>`, Conventional Commits, PR, CI verde nos dois jobs, squash, aprovação humana entre etapas; tag e deploy só com autorização.

## Forbidden Changes

No escopo atual (pré-requisitos da slice em PR; até nova aprovação registrada aqui):

- Merge de qualquer PR sem GATE 6.
- Executar L-0001 ou qualquer loop antes do HANDOFF aprovado pelo humano; versionar a pasta `.agent-loop/` ou seu conteúdo; criar templates além dos formatos já definidos no design.
- Gravar no `CLAUDE.md` contagem absoluta de testes ou outra informação de estado perecível.
- Qualquer automação executável do fluxo: daemon, watcher, chamadas à OpenAI/Anthropic, scripts que enviem prompts, loops, bots/webhooks do GitHub, MCP novo, automação de VS Code — inclusive "protótipos".
- Qualquer alteração em aplicações, produto, domínio, banco (`prisma/`, `supabase/`), CI (`.github/`), hooks ou dependências (`package.json`, `pnpm-lock.yaml`).
- Fórmulas e regras de negócio do carcass-cost (GATE 1), inclusive "correções" de arredondamento.
- Início da FASE 1 (auth Supabase), schema, migration ou RLS: exige gate humano (GATE 2, GATE 3, GATE 4, GATE 8).
- Artefatos congelados (SAS, ADR-018/019/020, Configuration Baseline v1.0, Design System), tags, commit/push direto na `main`, deploy.
- Versionar `.agents/`, `.claude/`, `skills-lock.json` ou qualquer valor do `.env`.

## Current Evidence

Coletado em 2026-09-15T12:56Z:

- **git**: `main` = `0e95473` = `origin/main`; PRs #58 e #59 mergeados; branch `docs/agent-slice-prereqs` com exatamente três arquivos: `.gitignore` (+1 linha), este checkpoint e `docs/agent-gate-paths.md` (novo).
- **CI**: head do PR #59 (`d54dfb1`) — `verify` success, `architecture` success; `main` em `0e95473` — run `34971593655` em andamento no momento da coleta.
- **testes**: nenhum código de produto alterado desde `b096268`; última evidência válida: `pnpm --filter @tauros/carcass-cost test` → 136 passed, 7 arquivos.
- **implementação**: desde `caaf0e9` só documentação e uma linha de `.gitignore`; nenhum código, dependência, CI, hook ou infra alterados; nenhum arquivo executável.
- **métricas (processo manual, primeiro registro)**: objetivo "design da bridge" — ITERATIONS 3 (v1, revisão 2, revisão 3), HUMAN_INTERVENTIONS 2 (pedido da revisão 2; ajustes da revisão 3), FAILED_ITERATIONS 0. Métricas de loop passam a viver em `Current Loop`; ao fechar cada loop, uma linha aqui consolida HUMAN_INTERVENTIONS, ITERATIONS, FAILED_ITERATIONS, DONE_LEVEL alcançado, `change_budget` previsto e consumido e arquivos de contexto usados.

## Open Questions

Nenhum bloqueio real. Decisões abertas do design, não bloqueantes: (1) calibração do default de
`change_budget` com loops reais; (2) lista de caminhos do GATE 3 quando a FASE 1 Auth for desenhada;
(3) observação do CI — coberta provisoriamente pela decisão operacional acima; (4) divergência a
decidir: o glob `**/src/domain/**` do design (GATE 1) não cobre `packages/domain/**` — registrada em
`agent-gate-paths.md` como pendência, sem acrescentar caminho por conta própria.

## Next Action

Após o merge do PR de pré-requisitos: apresentar o HANDOFF definitivo de L-0001 (OBJECTIVE, SCOPE,
DONE_WHEN, AUTONOMY) para aprovação humana; só então executar. **L-0001 não iniciado.** Verificável:
HANDOFF aprovado por escrito e `Current Loop` passando a `L-0001.1` no PR do loop.

## Human Gate

**HUMAN_APPROVAL_REQUIRED** — (a) GATE 6 do PR de pré-requisitos; (b) HANDOFF de L-0001 antes de
qualquer execução; (c) qualquer implementação da bridge ou automação do transporte;
(d) FASE 1 (Auth Supabase) só começa com aprovação explícita (GATE 3 / GATE 4 / GATE 8).

## Last Updated

2026-09-15T12:56Z — Claude Code (pré-requisitos da vertical slice, após os merges dos PRs #58 e #59).
