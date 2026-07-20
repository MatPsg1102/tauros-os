# ADR-018A — Implementation Conventions

- **Status:** Accepted
- **Data:** 2026-07-20
- **Relaciona-se com:** SAS v1.3, Configuration Baseline v1.0, Design Language, Design Tokens, Component Library Governance.

## Contexto

A arquitetura do Tauros OS está congelada. Este documento **não altera arquitetura** —
registra os padrões **obrigatórios de implementação** que valem durante toda a Etapa 6,
para que o código nasça uniforme e apto a produção. Se algo aqui conflitar com a arquitetura,
a arquitetura vence e abre-se uma proposta de mudança (ver "Regra de mudança").

## Decisão

Adotar as convenções abaixo em todos os pacotes e apps do monorepo.

---

## 1. Nomenclatura

| Elemento                             | Convenção                        | Exemplo                            |
| ------------------------------------ | -------------------------------- | ---------------------------------- |
| Pacote                               | `@tauros/<kebab>`                | `@tauros/ui-operational`           |
| Diretório / arquivo (geral)          | `kebab-case`                     | `resolve-shift.ts`                 |
| Componente React (arquivo + símbolo) | `PascalCase`                     | `TaskCard.tsx` → `TaskCard`        |
| Hook                                 | `useCamelCase`                   | `useSyncQueue.ts` → `useSyncQueue` |
| Type / Interface / Enum              | `PascalCase` (sem prefixo `I`)   | `OperatorSession`                  |
| Value Object / Entity (Domain)       | `PascalCase`                     | `StockMovement`                    |
| Use case (Application)               | `PascalCase` + verbo             | `RegisterLoss`, `ResolveShift`     |
| Port (interface de saída)            | `PascalCase` + sufixo `Port`     | `TaskQueuePort`                    |
| Adapter (Infrastructure)             | `PascalCase` + tecnologia        | `SupabaseTaskQueue`                |
| Constante                            | `SCREAMING_SNAKE_CASE`           | `MAX_CONCURRENCY`                  |
| Evento de domínio                    | `PascalCase` no passado          | `TemperatureLogged`                |
| Chave de configuração                | `dot.case`                       | `sync.retry.maxAttempts`           |
| Chave de token                       | `layer.categoria.papel[.estado]` | `context.sync.conflict`            |

Idioma: **código em inglês**; textos de UI em **pt-BR** (via i18n, nunca hardcoded).

## 2. Organização de diretórios (interna a cada pacote)

Cada pacote expõe **apenas** por `src/index.ts` (barrel). Estrutura por responsabilidade:

```
packages/domain/src/
  entities/        # entidades e agregados
  value-objects/
  events/          # domain events
  services/        # domain services (ShiftResolver, RuleRegistry)
  index.ts

packages/application/src/
  use-cases/       # 1 arquivo por use case
  ports/           # interfaces (repositórios, gateways)
  dto/
  index.ts

packages/infrastructure/src/
  supabase/        # adapters supabase-js (fluxo operacional + RLS)
  offline/         # IndexedDB queue, sync, retry
  audit/           # bridge de auditoria
  mappers/         # domain <-> persistência
  index.ts

packages/ui-*/src/
  <ComponentName>/
    <ComponentName>.tsx
    <ComponentName>.stories.tsx
    <ComponentName>.test.tsx
    index.ts
  index.ts
```

Regra: **nenhum símbolo importado por caminho profundo entre pacotes** — só pelo barrel público.
As fronteiras entre camadas são impostas por `dependency-cruiser` (não relaxar sem ADR).

## 3. Hooks (React)

- Vivem em `apps/web` ou nos pacotes `ui-*`; **nunca** em `domain`/`application`.
- **Estado de servidor** → React Query (`useQuery`/`useMutation`); **nunca** guardar dado remoto em store de cliente.
- Hooks de `ui-operational` podem conhecer **tipos** do domínio; **jamais** infraestrutura (Service Worker, fila, APIs).
- Um hook faz uma coisa; efeitos colaterais explícitos; sem lógica de negócio (essa mora em use cases/domínio).
- Nome sempre `use…`; retorno tipado explicitamente.

## 4. Stores (estado de cliente)

- Somente para **estado de UI/cliente** que não é servidor nem config (ex.: operador ativo selecionado, modo glove local).
- Mínimos e tipados; um store por preocupação; sem regra de negócio.
- Config **nunca** vem de store — vem do Configuration Engine (ADR-019). Permissões **nunca** de store — vêm das permissões efetivas (ADR-018).

## 5. Services / Use Cases (Application) e Adapters (Infrastructure)

- Use case = uma classe/função com **uma responsabilidade**, dependendo apenas de **ports** (interfaces), nunca de adapters concretos.
- Adapters implementam ports e são injetados na composição (composition root em `apps/web`).
- Validação de entrada/saída por **Zod** (`@tauros/contracts`) — schema único front/back.
- Efeitos colaterais (persistência, rede) só via ports. Domínio permanece puro.

## 6. Migrations

- **Prisma** (`prisma/migrations`): apenas schema/estrutura para tarefas admin e relatórios (service-role). Sem dado operacional.
- **Supabase** (`supabase/migrations`): DDL + RLS + triggers (audit, projeção de inventory, `validate_execution`) versionados e ordenados por timestamp.
- Nome de migration: `<timestamp>_<verbo>_<escopo>.sql` (ex.: `20260721_add_operator_sessions.sql`).
- **Nenhum seed de dado operacional** em migration; seeds de **configuração** (12x36, 07:30–19:30, 4 posições, sessão de sistema) ficam em `prisma/seeds` e são idempotentes.
- Migrations são **forward-only** em produção; correções via nova migration, nunca edição de migration aplicada.

## 7. Testes

- Colocação junto ao código: `X.test.ts(x)` ao lado de `X`.
- **Unit** (Vitest) por pacote; **integração** onde há adapter; **e2e** (Playwright) em `apps/web`; **a11y** (axe) nos `ui-*`.
- Domínio e use cases: cobertura alvo alta (regra pura, fácil de testar). Cobertura é elevada por pacote no preset compartilhado quando os testes existem (thresholds hoje em 0 = estrutura pronta).
- Sem `mock` permanente: mocks só em teste, nunca no código de produção.

## 8. Convenções de commit internas

- **Conventional Commits** (validado por hook `commit-msg`): `feat|fix|chore|docs|refactor|test|build|ci|perf|style|revert`.
- Escopo = nome curto do pacote/módulo: `feat(config-engine): ...`, `fix(offline): ...`.
- Um commit = uma mudança coesa. PR obrigatório; sem push direto na `main` (hooks + ruleset).
- Versionamento por pacote via **Changesets** (Governança §8.2).

## 9. Transversais

- **TypeScript strict** total; `any` proibido (lint `error`); tipagem forte, sem `as` desnecessário.
- Erros: tipos de erro explícitos; mensagens que dizem causa + próximo passo (P7 da Design Language).
- Sem código provisório, sem solução temporária, sem TODO sem issue vinculada.
- Documentação mínima: cada pacote com README de responsabilidade; cada use case/adapter com doc-comment curto.

## Regra de mudança

Se uma implementação revelar necessidade de mudança **estrutural** (arquitetura, tokens,
governança, baseline): **interromper**, explicar o problema, apresentar alternativas,
recomendar solução e **aguardar aprovação** antes de alterar qualquer artefato congelado.
