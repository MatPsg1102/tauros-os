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
etapas próprias: Etapa 0 = protocolo + estado (concluída); Etapa 1 = bridge/orquestrador local.

## Current Phase

**Preparação da Etapa 1 do Loop Engineering** — projeto (design) da bridge/orquestrador local
GPT ↔ Claude Code. Etapa 0 **concluída e versionada** (PR #56). Somente projeto nesta fase: nenhuma
automação executável existe nem é criada sem gate humano. Produto: V3.4.1 entregue (PR #55).
**FASE 1 (Auth Supabase) NÃO iniciada.**

## Last Approved Baseline

- `main` = `caaf0e9` — PR #56 `docs(agent-flow): fundação do fluxo supervisionado GPT ↔ Claude Code (Etapa 0)`, squash-merge em `2026-09-15T03:44Z`, CI verde no PR (`verify` + `architecture`).
- Último PR de produto: #55 (`b096268`, Custo da Carcaça V3.4.1). Produção https://carcass-cost.vercel.app serve o bundle desse commit (`index-DaEjw6mv.js`).
- Nenhum PR aberto.

## Current Branch

`main`, sincronizada com `origin/main`. Untracked locais que **não devem ser versionados**:
`.agents/` (skill `frontend-design`), `.claude/skills/` (symlink para `.agents/`) e `skills-lock.json`.

## Approved Decisions

Somente o necessário para continuar (fontes: `apps/carcass-cost/README.md`, traceability, ADRs, PR #56):

- **Protocolo em vigor**: [agent-execution-protocol.md](agent-execution-protocol.md) (ciclo, gates 1–8, handoff, ordem de contexto) é o contrato de toda iteração a partir de agora.
- **Vertical isolado.** `apps/carcass-cost` não entra em `apps/web`, `packages/*` de domínio/aplicação/infra, `prisma/` nem `supabase/`. Regras aditivas do dependency-cruiser `carcass-domain-is-pure` e `carcass-ui-presents-only` permanecem.
- **Fórmulas só em `src/domain`** (TypeScript puro, sem React); UI apenas apresenta; nada arredonda internamente (2 casas só em `ui/format.ts`).
- **Desossa é indicador comercial independente**: nada da Desossa alimenta Transformação nem Estimativa (6,92/kg e 1,63% intactos são invariantes cobertas por teste).
- **Persistência atual = `localStorage`** com envelope versionado (`STORAGE_VERSION` 4); mudanças de estado são aditivas com saneamento defensivo; nunca apagar estado do operador.
- **README do app declara fora de escopo: login, backend, sincronização.** Essa declaração só é revisada quando a FASE 1 for aprovada (GATE 4 + GATE 8).
- **ADR-021** define a identidade operacional do Tauros OS (Employee + PIN; Supabase Auth explicitamente adiado). A FASE 1 do carcass-cost **não reutiliza nem contradiz** essa decisão sem deliberação explícita.
- **Processo do repositório permanece**: branch `<tipo>/<escopo>`, Conventional Commits, PR, CI verde nos dois jobs, squash, aprovação humana entre etapas; tag e deploy só com autorização.
- **Etapa 1 do Loop Engineering começa por projeto, não por código**: a bridge/orquestrador local é primeiro descrita (fluxo de mensagens, formato dos arquivos de handoff, pontos de gate, limites) e revisada; só depois de aprovação explícita algo executável é criado.

## Forbidden Changes

No escopo atual (preparação da Etapa 1 e até nova aprovação registrada aqui):

- Qualquer automação executável do fluxo: daemon, watcher, chamadas à OpenAI/Anthropic, scripts que enviem prompts, loops, bots/webhooks do GitHub, MCP novo, automação de VS Code — inclusive "protótipos".
- Qualquer alteração em aplicações, produto, domínio, banco (`prisma/`, `supabase/`), CI (`.github/`) ou dependências (`package.json`, `pnpm-lock.yaml`).
- Fórmulas e regras de negócio do carcass-cost (GATE 1), inclusive "correções" de arredondamento.
- Início da FASE 1 (auth Supabase), schema ou migration Supabase: exige gate humano (GATE 2, GATE 3, GATE 4, GATE 8).
- Artefatos congelados (SAS, ADR-018/019/020, Configuration Baseline v1.0, Design System), tags, commit/push direto na `main`, merge, deploy.
- Versionar `.agents/`, `.claude/`, `skills-lock.json` ou qualquer valor do `.env`.

## Current Evidence

Coletado em `2026-09-15T03:45Z`:

- **git**: `main` = `caaf0e9` = `origin/main`; branch `docs/agent-flow` removida (local e remota); sem PRs abertos (`gh pr list`).
- **CI**: PR #56 (`a4e201a`) — `verify` success, `architecture` success. CI da `main` em `caaf0e9`: `verify in_progress`.
- **testes**: nenhum código de produto alterado desde `b096268`; última evidência válida: `pnpm --filter @tauros/carcass-cost test` → 136 passed, 7 arquivos.
- **implementação**: PR #56 mergeado com exatamente `CLAUDE.md`, `docs/agent-development-state.md` e `docs/agent-execution-protocol.md`; nenhum código, dependência, CI ou infra alterados.

## Open Questions

Nenhum bloqueio real.

## Next Action

Projetar a bridge/orquestrador local GPT ↔ Claude Code: um documento de design (fluxo de mensagens
entre supervisor e executor, formato dos arquivos de handoff/estado trocados, onde cada gate 1–8
interrompe o fluxo, limites de contexto e o que fica fora), entregue para revisão humana.
Verificável: o documento existe em branch própria e nenhum arquivo executável foi criado.

## Human Gate

**HUMAN_APPROVAL_REQUIRED** — (a) obrigatório antes de criar **qualquer** automação executável;
(b) versionar esta atualização do checkpoint exige novo PR documental, autorizado pelo responsável;
(c) FASE 1 (Auth Supabase) só começa com aprovação explícita (GATE 3 / GATE 4 / GATE 8).

## Last Updated

`2026-09-15T03:45Z` — Claude Code (pós-merge do PR #56, sessão supervisionada pelo responsável).
