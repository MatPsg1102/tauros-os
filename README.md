# Tauros OS

PWA operacional para gestão de açougue (evoluindo para SaaS multi-loja).
Monorepo. **A arquitetura está congelada**: esta implementação obedece à SAS v1.3,
ao Configuration Baseline v1.0 e aos artefatos do Design System. Nenhuma decisão
estrutural muda sem uma nova ADR.

## Ferramentas

pnpm workspaces · Turborepo · TypeScript strict · ESLint + dependency-cruiser ·
Prettier · Vitest / Playwright / axe · Storybook · Changesets · GitHub Actions.

## Estrutura

```
apps/web            Presentation — Next.js App Router · PWA (composition root)
apps/storybook      Catálogo oficial de componentes (Governança §6)
packages/domain          Domain — entidades, VOs, domain services, eventos (puro)
packages/contracts       Schemas Zod compartilhados front/back
packages/application     Use cases + ports (depende só de domain + contracts)
packages/infrastructure  Adapters: Supabase, IndexedDB, sync, audit bridge
packages/config-engine   Configuration Engine (ADR-019)
packages/ui-metadata     UI Metadata Engine (ADR-020)
packages/tokens          Design Tokens (fonte multiplataforma)
packages/ui-primitives   Primitive Components (5.3)
packages/ui-composites   Composite Components (5.4)
packages/ui-operational  Operational Components (5.5)
packages/ui-infrastructure Infrastructure Components (5.6)
packages/ui-layouts      Layout System (5.7)
packages/interaction     Navigation & Interaction Architecture
prisma/                  Prisma — migrations/seeds/relatórios admin (service-role) — ADR-002
supabase/                DDL + RLS + triggers + Edge Functions (fonte da verdade operacional)
```

## Fronteiras impostas por build

O grafo de pacotes + `dependency-cruiser` transformam as regras de camada da
Clean Architecture e da Component Library Governance em **falha de CI**.
Ex.: `ui-operational` não pode importar `ui-infrastructure`; `domain` não importa framework.
Rode localmente: `pnpm boundaries`.

## Scripts

`pnpm dev | build | lint | typecheck | test | format | boundaries | changeset`
