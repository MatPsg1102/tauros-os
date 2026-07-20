# supabase

Fonte da verdade operacional (ADR-002): o fluxo do usuário usa supabase-js +
RLS; Prisma fica restrito a admin/migrations (`../prisma`).

## Migrations (`migrations/`)

Camada que o Prisma não expressa — aplicar APÓS a migration Prisma `init`:

| Arquivo                        | Conteúdo                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `..._app_helpers.sql`          | schema `app`: `current_store_id()`, `has_permission()` (claims JWT, ADR-018)                  |
| `..._constraints.sql`          | CHECKs: pai único de attachment (ADR-012), sinal por MovementType (ADR-009), bounds temporais |
| `..._audit.sql`                | `trigger_audit()` (ADR-007) anexado às tabelas sensíveis; audit_logs append-only              |
| `..._projections.sql`          | `project_inventory()`: inventory = projeção do razão (ADR-009)                                |
| `..._execution_validation.sql` | `validate_execution()`: bounds de sanidade + turno por `event_time` (ADR-008)                 |
| `..._rls.sql`                  | RLS em todas as tabelas: tenant, append-only, escrita por capacidade                          |
| `..._storage.sql`              | bucket privado `attachments` isolado por `<store_id>/...`                                     |
| `..._auth_profiles.sql`        | espelho `auth.users` → `profiles`                                                             |

## Permissões usadas nas policies

`loss.approve` · `review.handle` · `incident.manage` · `config.write` ·
`access.manage` · `audit.read` — chaves do catálogo (`permissions`), embarcadas
no claim `permissions` do JWT pelo PermissionResolver. Seeds na Etapa 6.2.4+.

## Functions (`functions/`)

Edge Functions (sync com validação de autoria RA-QUEUE-01, rule engine via
pg_cron) entram nas Etapas 6.2.5–6.2.8.

## Aplicação

Local: `supabase start` + `supabase db reset` (requer Docker).
Cloud: `supabase link` + `supabase db push`.
