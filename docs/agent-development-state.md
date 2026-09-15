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
local (aprovado, em PR); próxima = vertical slice manual do Agent Bridge, só após o merge do design.

## Current Phase

**Etapa 1 do Loop Engineering — design da bridge aprovado (revisão 3) e versionado no PR #58**,
aguardando GATE 6. A vertical slice manual do Agent Bridge **não foi iniciada** e só começa após
aprovação/merge do design. Produto: V3.4.1 entregue (PR #55). **FASE 1 (Auth Supabase) NÃO iniciada.**

## Last Approved Baseline

- `main` = `81a3fca` — PR #57 `docs(agent-state): checkpoint pós-merge da Etapa 0 — preparação da Etapa 1 do Loop Engineering`, squash-merge em 2026-09-15T11:36Z. CI da `main` em `81a3fca`: run `34964212930`, `verify` success, `architecture` success.
- Etapa 0 (PR #56, `caaf0e9`) concluída e versionada; protocolo de execução em vigor.
- Último PR de produto: #55 (`b096268`, Custo da Carcaça V3.4.1). Produção https://carcass-cost.vercel.app serve o bundle desse commit (`index-DaEjw6mv.js`).
- PR aberto: **#58** `docs(agent-bridge): design da bridge/orquestrador local GPT ↔ Claude Code (Etapa 1, rev. 3)` — branch `docs/agent-bridge-design`, head `3eff690`, exatamente um arquivo (`docs/agent-bridge-design.md`, 438 linhas); aguarda `verify` + `architecture` e GATE 6.

## Current Branch

`main`, sincronizada com `origin/main`. Branches de trabalho: `docs/agent-bridge-design` (publicada,
PR #58) e a branch deste checkpoint. Untracked locais que **não devem ser versionados**: `.agents/`
(skill `frontend-design`), `.claude/skills/` (symlink para `.agents/`) e `skills-lock.json`.

## Approved Decisions

Somente o necessário para continuar (fontes: `apps/carcass-cost/README.md`, traceability, ADRs, PRs #56–#58):

- **Protocolo em vigor**: [agent-execution-protocol.md](agent-execution-protocol.md) (ciclo, gates 1–8, handoff, ordem de contexto) é o contrato de toda iteração.
- **Design da bridge aprovado (revisão 3, PR #58)** — `docs/agent-bridge-design.md` (PR #58; o link relativo passa a valer após o merge): Autonomy Envelope por objetivo (só o humano alarga; o GPT mantém ou estreita); gates 1 e 2 = CONDITIONAL, 3 e 4 = HARD no núcleo com CONDITIONAL só para implementação explicitamente aprovada (qualquer política RLS sai do envelope salvo política exata aprovada), 5, 6 e 7 = HARD, 8 = CONDITIONAL com detecção mecânica; CI_VERIFIED encerra o engineering loop, MERGED atrás do GATE 6, DEPLOYED fora do loop e atrás do GATE 7 quando houver ação explícita; `change_budget` 10 arquivos / 300 linhas / 0 dependências é **default** redefinível por HANDOFF aprovado; segunda ocorrência da mesma assinatura de falha encerra a **iteração** como FAILED, não o objetivo; `NEXT_OBJECTIVE_PROPOSAL` é informacional e não executável; métricas HUMAN_INTERVENTIONS_PER_OBJECTIVE, ITERATIONS_PER_OBJECTIVE e FAILED_ITERATIONS_PER_OBJECTIVE medidas a partir de agora.
- **Decisão operacional provisória para a primeira vertical slice**: o humano observa o CI; tempo aguardando CI **não** conta como HUMAN_INTERVENTION; intervenção = decisão ou ação humana necessária para o objetivo prosseguir.
- **Vertical slice manual só após o merge do design**, com PR próprio para seus pré-requisitos (`.gitignore`, seção `Current Loop`, `docs/agent-gate-paths.md`), cada um sob gate humano.
- **Vertical isolado.** `apps/carcass-cost` não entra em `apps/web`, `packages/*` de domínio/aplicação/infra, `prisma/` nem `supabase/`. Regras aditivas do dependency-cruiser `carcass-domain-is-pure` e `carcass-ui-presents-only` permanecem.
- **Fórmulas só em `src/domain`** (TypeScript puro, sem React); UI apenas apresenta; nada arredonda internamente (2 casas só em `ui/format.ts`).
- **Desossa é indicador comercial independente**: nada da Desossa alimenta Transformação nem Estimativa (6,92/kg e 1,63% intactos são invariantes cobertas por teste).
- **Persistência atual = `localStorage`** com envelope versionado (`STORAGE_VERSION` 4); mudanças de estado são aditivas com saneamento defensivo; nunca apagar estado do operador.
- **README do app declara fora de escopo: login, backend, sincronização.** Essa declaração só é revisada quando a FASE 1 for aprovada (GATE 4 + GATE 8).
- **ADR-021** define a identidade operacional do Tauros OS (Employee + PIN; Supabase Auth explicitamente adiado). A FASE 1 do carcass-cost **não reutiliza nem contradiz** essa decisão sem deliberação explícita.
- **Processo do repositório permanece**: branch `<tipo>/<escopo>`, Conventional Commits, PR, CI verde nos dois jobs, squash, aprovação humana entre etapas; tag e deploy só com autorização.

## Forbidden Changes

No escopo atual (design em PR; até nova aprovação registrada aqui):

- Merge do PR #58 ou de qualquer PR sem GATE 6.
- Criar `.agent-loop/` ou `docs/agent-gate-paths.md`, alterar `.gitignore`, adicionar a seção `Current Loop` ao STATE ou qualquer outro pré-requisito da vertical slice antes da aprovação dela.
- Qualquer automação executável do fluxo: daemon, watcher, chamadas à OpenAI/Anthropic, scripts que enviem prompts, loops, bots/webhooks do GitHub, MCP novo, automação de VS Code — inclusive "protótipos".
- Qualquer alteração em aplicações, produto, domínio, banco (`prisma/`, `supabase/`), CI (`.github/`), hooks ou dependências (`package.json`, `pnpm-lock.yaml`).
- Fórmulas e regras de negócio do carcass-cost (GATE 1), inclusive "correções" de arredondamento.
- Início da FASE 1 (auth Supabase), schema, migration ou RLS: exige gate humano (GATE 2, GATE 3, GATE 4, GATE 8).
- Artefatos congelados (SAS, ADR-018/019/020, Configuration Baseline v1.0, Design System), tags, commit/push direto na `main`, deploy.
- Versionar `.agents/`, `.claude/`, `skills-lock.json` ou qualquer valor do `.env`.

## Current Evidence

Coletado em 2026-09-15T11:44Z:

- **git**: `main` = `81a3fca` = `origin/main`; PR #57 mergeado; PR #58 aberto (head `3eff690`, 3 commits, 1 arquivo, +438 linhas; `git diff origin/main..origin/docs/agent-bridge-design` confere).
- **CI**: `main` em `81a3fca` — run `34964212930`, `verify` success, `architecture` success. PR #58: `verify` e `architecture` em andamento no momento da coleta.
- **testes**: nenhum código de produto alterado desde `b096268`; última evidência válida: `pnpm --filter @tauros/carcass-cost test` → 136 passed, 7 arquivos.
- **implementação**: desde `caaf0e9` só documentação (checkpoint no #57, design no #58); nenhum código, dependência, CI, hook, `.gitignore` ou infra alterados.
- **métricas (processo manual, primeiro registro)**: objetivo "design da bridge" — ITERATIONS 3 (v1, revisão 2, revisão 3), HUMAN_INTERVENTIONS 2 (pedido da revisão 2; ajustes da revisão 3), FAILED_ITERATIONS 0.

## Open Questions

Nenhum bloqueio real. Decisões abertas do design, não bloqueantes: (1) calibração do default de
`change_budget` com loops reais; (2) lista de caminhos do GATE 3 quando a FASE 1 Auth for desenhada;
(3) observação do CI — coberta provisoriamente pela decisão operacional acima.

## Next Action

Preparar a vertical slice manual do Agent Bridge após aprovação/merge do design (PR #58). **Não
iniciar ainda.** Verificável: PR #58 mergeado e um PR de pré-requisitos da slice apresentado para
aprovação, sem nenhum arquivo executável.

## Human Gate

**HUMAN_APPROVAL_REQUIRED** — (a) GATE 6 do PR #58 (design) e do PR deste checkpoint;
(b) pré-requisitos da vertical slice e qualquer implementação da bridge;
(c) FASE 1 (Auth Supabase) só começa com aprovação explícita (GATE 3 / GATE 4 / GATE 8).

## Last Updated

2026-09-15T11:44Z — Claude Code (após o merge do PR #57 e a abertura do PR #58).
