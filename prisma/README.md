# prisma

Uso restrito (ADR-002): migrations, seeds e relatórios administrativos com
service-role. O fluxo operacional NÃO usa Prisma — usa Supabase client + RLS
(ver `../supabase`).

## Schema

Multi-arquivo em `schema/` (1 arquivo por módulo). `pnpm db:validate` valida.

## Migrations (`migrations/`)

- Forward-only em produção; correção = nova migration, nunca editar aplicada.
- Nome: `<timestamp>_<verbo>_<escopo>` (ADR-018A §6).
- Apenas DDL — nenhum dado operacional. Seeds de configuração ficam em `seeds/`.
- `20260720120000_init`: schema completo da SAS v1.3 (52 tabelas, 19 enums, 50 FKs).
- RLS, triggers (audit, projeção inventory, validate_execution) e CHECKs
  (ex.: pai único de attachments) são aplicados pelas migrations Supabase
  (`../supabase/migrations`) — camada de banco fora do alcance do Prisma.

## Aplicação

Local/CI: `pnpm db:migrate` (dev) · Produção: `prisma migrate deploy`.
