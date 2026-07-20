# @tauros/config-engine

Configuration Engine (ADR-019): única fonte de resolução de configuração.

- `CONFIG_CATALOG` — Baseline v1.0 como código: 25 chaves tipadas com escopo
  (global/store), hot-reload e política de revalidação.
- `ConfigResolver` — herança global → loja, vigência (`effectiveFrom/Until`),
  precedência por versão, cache por loja com `invalidate()` e `snapshot()`
  imutável para materializações.
- `ConfigSourcePort` — contrato da fonte de overrides (implementado pela
  infraestrutura; o engine não conhece Supabase/Prisma).

Nenhum módulo lê tabelas de configuração diretamente — tudo passa por aqui.
