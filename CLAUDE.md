# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Tauros OS — PWA operacional de gestão de açougue (evoluindo para SaaS multi-loja), monorepo pnpm + Turborepo.

**Estado atual:** `main` na tag `design-system-v1.0`; 587 testes no monorepo; CI com dois jobs (`verify` + `architecture`). **Nunca fazer merge com CI vermelho.**

**A arquitetura está congelada.** A SAS, os ADRs — em especial **ADR-018** (permissões efetivas), **ADR-019** (Configuration Engine) e **ADR-020** (UI Metadata Engine) — o Configuration Baseline v1.0 e os documentos de design são a **fonte de verdade**. Não re-arquitetar nem trocar tecnologia sem novo ADR. Se uma implementação revelar necessidade de mudança estrutural: **interromper, explicar o problema, apresentar alternativas, recomendar e aguardar aprovação** antes de alterar qualquer artefato congelado. Se dois documentos divergirem: **parar e apresentar a divergência — nunca decidir silenciosamente.**

Idioma: **código, identificadores e comentários técnicos em inglês ou pt-BR conforme o arquivo vizinho; textos de UI sempre em pt-BR via i18n, nunca hardcoded.** Comentários existentes referenciam seções dos artefatos (ex.: `(7.1 §42)`, `ADR-019`) — mantenha esse hábito ao adicionar código.

## Comandos

```bash
pnpm install              # também instala os git hooks (prepare → core.hooksPath=.githooks)
pnpm dev                  # turbo dev (web em :3000, storybook em :6006)
pnpm build | lint | typecheck | test
pnpm format               # prettier --write .   (format:check no CI/pre-commit)
pnpm boundaries           # dependency-cruiser — regras de camada; FALHA = erro de arquitetura
pnpm knip                 # dead code / exports não usados (non-blocking no CI)
pnpm check:hardcoded      # falha se ui-primitives tiver cor/dimensão/duração literal
pnpm changeset            # versionamento por pacote
```

Um pacote / um teste só:

```bash
pnpm --filter @tauros/ui-primitives test
pnpm --filter @tauros/infrastructure exec vitest run src/offline/retry-policy.test.ts
pnpm --filter @tauros/infrastructure exec vitest run -t "nome do caso"
```

Banco (ver `prisma/README.md` e `supabase/README.md`):

```bash
pnpm db:validate | db:generate | db:migrate | db:deploy
pnpm db:apply-sql         # aplica supabase/migrations + prisma/seeds em ordem contra DATABASE_URL
pnpm db:seed              # só prisma/seeds (idempotentes)
```

**Pipeline completo local** (rodar inteiro antes de abrir PR):

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm boundaries && pnpm check:hardcoded && pnpm test && pnpm build
```

## Arquitetura

Clean Architecture com as camadas materializadas como **pacotes**; o grafo de dependências é a forma de imposição — `dependency-cruiser` transforma violação de camada em falha de CI.

**Núcleo (sem framework):**

- `packages/domain` — regras puras: entidades, VOs, eventos, domain services. Não importa React/Next, nem application/infrastructure.
- `packages/contracts` — schemas Zod + **ports** (interfaces) compartilhados front/back. É por aqui que os tipos atravessam camadas.
- `packages/application` — use cases (1 por arquivo, verbo + `UseCase`). Depende **só** de domain + contracts, sempre de ports, nunca de adapters.
- `packages/infrastructure` — adapters: `supabase/`, `offline/` (fila IndexedDB, retry, sync, state machine, DAG), `audit/` (outbox + bridge), `mappers/`.
- `packages/config-engine` — Configuration Engine (ADR-019): catálogo tipado, herança global→loja, vigência, cache. **Config nunca vem de store de cliente.**
- `packages/ui-metadata` — UI Metadata Engine (ADR-020): FormDefinition → renderers genéricos.

**Design System (categorias unidirecionais, Component Library Governance):**

`tokens` → `theme` → `ui-primitives` → `ui-composites` → `ui-operational` / `ui-infrastructure`; `ui-layouts` organiza via **slots** e nunca importa o que hospeda. `ui-operational` conhece **tipos** do domínio, jamais infraestrutura. Nenhum pacote `ui-*` importa roteador (contrato neutro de links — o adapter de router vive em `apps/web/src/navigation/links.ts`), Prisma ou Supabase.

**Apps:**

- `apps/web` — Next.js App Router + PWA, **composition root**. `src/app` (rotas) · `src/ui` (telas) · `src/controllers` (hooks de orquestração) · `src/navigation` · `src/wiring` (`container.ts` monta todos os adapters; `adapters.ts` implementa os ports do app). A UI do app fala com contratos de aplicação — só o `wiring/` monta infraestrutura.
- `apps/storybook` — catálogo oficial do DS. Nunca importa backend/domínio e consome os pacotes **apenas pelo barrel público**.

**Persistência (ADR-002, duas fontes com papéis distintos):** o fluxo operacional usa supabase-js + RLS (`supabase/migrations` = DDL, RLS, triggers, projeções — fonte da verdade operacional); Prisma é restrito a schema/migrations/seeds e relatórios admin com service-role.

## Convenções obrigatórias (ADR-018A)

- **Barrel único**: cada pacote expõe só `src/index.ts` com exports explícitos. **Nunca importe por caminho profundo entre pacotes.** Dentro do pacote, imports relativos levam extensão `.js` (ESM real).
- Estrutura interna de `ui-*`: `src/<Componente>/<Componente>.tsx` + `.stories.tsx` + `.test.tsx` + `index.ts`.
- Nomes: pacote `@tauros/<kebab>`; arquivos `kebab-case` (componentes React `PascalCase`); port = `…Port`; adapter = `…` + tecnologia (`SupabaseTaskQueue`); use case = verbo + `PascalCase`; constante `SCREAMING_SNAKE_CASE`; chave de config `dot.case`; chave de token `layer.categoria.papel[.estado]`; evento de domínio no passado (`TemperatureLogged`).
- **TS strict total**; `any` é erro de lint; `consistent-type-imports` obrigatório; `exactOptionalPropertyTypes` e `noUncheckedIndexedAccess` estão ligados no `tsconfig.base.json`.
- Estado de servidor → React Query. Stores de cliente só para estado de UI, sem regra de negócio, sem config, sem permissões (permissões vêm das permissões efetivas, ADR-018).
- Validação de entrada/saída por Zod em `@tauros/contracts` — schema único front/back.
- Estilo: componentes consomem **CSS Variables via `cssVar`/tokens**; valores visuais literais em `ui-primitives` são bloqueados por `pnpm check:hardcoded` (allowlist estrutural mínima: `1px`, `2px`, `-1px`, `0s`, `0px`; exceção pontual exige comentário `scanner-allow` visível no diff).
- Testes colocados ao lado do código (`X.test.ts(x)`): Vitest unit por pacote, integração onde há adapter, Playwright e2e em `apps/web`, axe nos `ui-*`. Presets compartilhados em `packages/config` (`vitest.preset.mjs`, `eslint.preset.mjs`); pacotes com DOM fazem `mergeConfig(preset, { test: { environment: 'jsdom' } })`.
- Sem código provisório, sem solução temporária, sem TODO sem issue vinculada. Mocks só em teste.
- Migrations são **forward-only**; correção = nova migration, nunca editar uma aplicada. Nome `<timestamp>_<verbo>_<escopo>.sql`. Nenhum seed de dado operacional em migration.

## Processo por etapa (obrigatório)

1. Criar branch `<tipo>/<escopo>` — nunca commitar/push direto na `main` (bloqueado pelo hook `pre-push`).
2. Implementar a etapa.
3. Rodar o **pipeline completo local** (acima) — verde do início ao fim.
4. Abrir PR (**Conventional Commits**, validados pelo hook `commit-msg`; escopo = nome curto do pacote).
5. **Aguardar os dois jobs do CI verdes** (`verify` e `architecture`).
6. Merge **squash**.
7. Sincronizar a `main` local.
8. **Parar e aguardar aprovação explícita do responsável antes de iniciar a próxima etapa.**

**Tags:** só em milestones (`bootstrap-v1.0`, `infra-v1.0`, `design-system-v1.0`). **Nunca criar tag sem autorização.**

## Regras invioláveis

- **Fronteiras mecânicas são falhas de CI, não sugestões**: as regras de `dependency-cruiser` (`pnpm boundaries`) e o scanner de valores visuais (`pnpm check:hardcoded`) não se relaxam, contornam nem se adicionam exceções sem ADR.
- **Design System congelado**: consumir pela **API pública** de `@tauros/ui-primitives` (e demais pacotes `ui-*`). Não criar pacote ou stylesheet paralelo, não duplicar primitives.
- **Risco F-01 — credencial do banco**: a credencial real vive **somente** no `.env` (ignorado pelo Git). Nunca reproduzir, exibir em output/log/PR, nem commitar o valor; referir-se a ela apenas como `DATABASE_PASSWORD`. **Rotação obrigatória antes de produção ou de qualquer acesso externo.** O hook `pre-commit` bloqueia strings com cara de segredo; `.env.example` fica sem valores reais.
- **Rastreabilidade**: [docs/design-system/traceability-5.3-to-6.3.md](docs/design-system/traceability-5.3-to-6.3.md) é o registro vivo de decisões e pendências — **atualizar a cada etapa**.
- Mudanças em pacotes publicáveis pedem changeset (`@tauros/web` e `@tauros/storybook` são ignorados).
