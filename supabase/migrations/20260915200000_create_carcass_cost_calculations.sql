-- Carcass Cost — lotes salvos por usuário piloto (Supabase Auth e-mail/senha).
-- Vertical isolada (decisão humana 2026-09-15): sem store_id, membership,
-- permissões ou auditoria; isolamento exclusivamente por auth.uid().
-- Aplicada isoladamente com `prisma db execute --file` (P-0001); não faz parte
-- do fluxo de migrations pendentes do Tauros OS.
create table public.carcass_cost_calculations (
  id         uuid primary key,
  user_id    uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  saved_at   timestamptz not null default now(),
  entry      jsonb not null,
  created_at timestamptz not null default now(),
  constraint carcass_cost_calculations_entry_is_object
    check (jsonb_typeof(entry) = 'object')
);

create index carcass_cost_calculations_user_saved_idx
  on public.carcass_cost_calculations (user_id, saved_at desc);

alter table public.carcass_cost_calculations
  enable row level security;

create policy carcass_cost_calculations_select_own
  on public.carcass_cost_calculations
  for select
  to authenticated
  using (user_id = auth.uid());

create policy carcass_cost_calculations_insert_own
  on public.carcass_cost_calculations
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy carcass_cost_calculations_delete_own
  on public.carcass_cost_calculations
  for delete
  to authenticated
  using (user_id = auth.uid());
