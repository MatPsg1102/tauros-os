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

## Current Phase

**Etapa 0 — Fundação do fluxo supervisionado GPT ↔ Claude Code**: protocolo + estado persistente,
sem automação executável. Produto: V3.4.1 entregue (PR #55). **FASE 1 não iniciada.**

## Last Approved Baseline

- `main` = `b096268` — PR #55 `feat(carcass-cost): Desossa — custo do kg editável, valor inicial da carcaça derivado`, squash-merge em 2026-09-15T03:19Z, CI verde (`verify` + `architecture`).
- PR #54 (`d7bb0cd`, Desossa V3.4) confirmado mergeado em 2026-09-15T02:56Z — **não é bloqueio**.
- Nenhum PR aberto.
- Produção: https://carcass-cost.vercel.app serve o bundle de `b096268` (`index-DaEjw6mv.js`, `CACHE_NAME carcass-cost-8b892bb70d65`), publicado pela git integration da Vercel ao mergear na `main`.

## Current Branch

`main`, sincronizada com `origin/main`, árvore rastreada limpa. Untracked locais que **não devem ser
versionados**: `.agents/` (skill `frontend-design`), `.claude/skills/` (symlink para `.agents/`) e
`skills-lock.json`.

## Approved Decisions

Somente o necessário para continuar (fontes: `apps/carcass-cost/README.md`, traceability, ADRs):

- **Vertical isolado.** `apps/carcass-cost` não entra em `apps/web`, `packages/*` de domínio/aplicação/infra, `prisma/` nem `supabase/`. Regras aditivas do dependency-cruiser `carcass-domain-is-pure` e `carcass-ui-presents-only` permanecem.
- **Fórmulas só em `src/domain`** (TypeScript puro, sem React); UI apenas apresenta; nada arredonda internamente (2 casas só em `ui/format.ts`).
- **Desossa é indicador comercial independente**: nada da Desossa alimenta Transformação nem Estimativa (6,92/kg e 1,63% intactos são invariantes cobertas por teste).
- **Persistência atual = `localStorage`** com envelope versionado (`STORAGE_VERSION` 4); mudanças de estado são aditivas com saneamento defensivo; nunca apagar estado do operador.
- **README do app declara fora de escopo: login, backend, sincronização.** Essa declaração só é revisada quando a FASE 1 for aprovada (GATE 4 + GATE 8).
- **ADR-021** define a identidade operacional do Tauros OS (Employee + PIN; Supabase Auth explicitamente adiado). A FASE 1 do carcass-cost **não reutiliza nem contradiz** essa decisão sem deliberação explícita.
- **Processo do repositório permanece**: branch `<tipo>/<escopo>`, Conventional Commits, PR, CI verde nos dois jobs, squash, aprovação humana entre etapas; tag e deploy só com autorização.
- **Etapa 0 cria apenas documentação/protocolo.** Nenhuma automação que chame APIs, nenhum loop autônomo.

## Forbidden Changes

No escopo atual (Etapa 0 e até nova aprovação registrada aqui):

- Automação executável do fluxo: daemon, watcher, chamadas à OpenAI/Anthropic, scripts que enviem prompts, loops, bots/webhooks do GitHub, MCP novo, automação de VS Code.
- Qualquer alteração em aplicações, produto, domínio, banco (`prisma/`, `supabase/`), CI (`.github/`) ou dependências (`package.json`, `pnpm-lock.yaml`).
- Fórmulas e regras de negócio do carcass-cost (GATE 1), inclusive "correções" de arredondamento.
- Início da FASE 1 (auth Supabase) sem gate humano: envolve GATE 3, GATE 4 e GATE 8.
- Artefatos congelados (SAS, ADR-018/019/020, Configuration Baseline v1.0, Design System), tags, commit/push direto na `main`, merge, deploy.
- Versionar `.agents/`, `.claude/`, `skills-lock.json` ou qualquer valor do `.env`.

## Current Evidence

Coletado em 2026-09-15T03:30Z:

- **git**: `main` = `b096268` = `origin/main`; sem PRs abertos (`gh pr list`).
- **CI**: run `34924546841` em `b096268` — `verify` success, `architecture` success.
- **testes focados**: `pnpm --filter @tauros/carcass-cost test` → 136 passed, 7 arquivos, 0 falhas.
- **implementação**: Etapa 0 tocou apenas `docs/agent-development-state.md`, `docs/agent-execution-protocol.md` e um bloco de referência no `CLAUDE.md`; nenhum código, dependência, CI ou infra alterados.
- **produção**: bundle remoto = dist local (`index-DaEjw6mv.js`).

## Open Questions

Nenhum bloqueio real. PR #54 e #55 confirmados mergeados via `gh pr view`.

## Next Action

Após aprovação humana desta fundação: abrir branch `docs/agent-flow`, commitar os três arquivos da
Etapa 0 e abrir PR (verificável por `gh pr view` + CI verde). Nada de automação nesse PR.

## Human Gate

**HUMAN_APPROVAL_REQUIRED** — (a) revisão desta fundação antes de qualquer commit/PR;
(b) separadamente, a FASE 1 só começa com aprovação explícita (GATE 3 / GATE 4 / GATE 8).

## Last Updated

2026-09-15T03:30Z — Claude Code (Etapa 0, sessão supervisionada pelo responsável).
