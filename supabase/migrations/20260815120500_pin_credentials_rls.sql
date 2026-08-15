-- Identidade Operacional V1 (ADR-021) — RLS da credencial de PIN.
-- A tabela employee_pin_credentials nasce na migration Prisma aditiva
-- (20260815120000_add_pin_credentials); aqui aplicamos a fronteira real de
-- segurança (RLS), no mesmo padrão do resto do schema (SAS §7 / ADR-018).
--
-- POSTURA (ADR-021 §5): o VERIFIER nunca é exposto ao cliente. A verificação
-- do PIN e o provisionamento acontecem SERVER-SIDE (função SECURITY DEFINER /
-- service-role no backend real), que ignora o RLS por elevação. Portanto:
-- RLS habilitado, FORCE, e NENHUMA policy para `authenticated` — negação por
-- padrão. O cliente jamais lê/escreve o hash: não há bearer credential.

alter table public.employee_pin_credentials enable row level security;
alter table public.employee_pin_credentials force row level security;

comment on table public.employee_pin_credentials is
  'Verifier de PIN (ADR-021). Acesso só server-side (SECURITY DEFINER/service-role); '
  'sem policy para authenticated — o cliente nunca lê o hash, que não é bearer credential.';
