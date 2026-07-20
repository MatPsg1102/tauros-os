-- Tauros OS — trilha de auditoria canônica (6.2.8 §5/§6/§7).
-- audit_events: trilha de EVENTOS de negócio/segurança (pipeline cliente/server).
-- audit_logs (6.2.3) permanece: trilha de DIFFS por trigger de banco.
-- O SERVIDOR é a autoridade: recorded_at/seq/hash são gerados AQUI; o cliente
-- nunca edita/apaga; idempotência por event_id.

create extension if not exists pgcrypto;

create table public.audit_events (
  event_id          text primary key,             -- determinístico (dedupe lógico)
  event_type        text not null,
  schema_version    int  not null,
  occurred_at       timestamptz not null,         -- momento da AÇÃO (cliente)
  sent_at           timestamptz,                  -- momento do ENVIO (cliente)
  recorded_at       timestamptz not null default now(), -- AUTORITATIVO (servidor)
  seq               bigint generated always as identity, -- ordenação estável
  store_id          uuid,
  actor_id          uuid,
  actor_type        text not null check (actor_type in ('human','system','integration')),
  session_id        text,
  device_id         text,
  correlation_id    text not null,
  causation_id      text,
  idempotency_key   text not null,
  entity_type       text,
  entity_id         text,
  operation         text,
  source            text not null check (source in ('client-offline','client-online','server','database')),
  execution_source  text,
  previous_state    text,
  next_state        text,
  result            text not null check (result in ('success','failure','rejected','review','conflict')),
  error_code        text,
  error_name        text,
  error_message     text,
  authorization_ref jsonb,
  config_version_ref text,
  queue_item_id     text,
  attempt           int,
  metadata          jsonb,
  -- Integridade §7: cadeia SHA-256 por partição (loja), computada no trigger.
  prev_hash         text not null,
  hash              text not null
);

-- Índices (§6/§12): loja, ator, entidade, correlação, tempo, tipo; paginação
-- estável por (recorded_at, seq).
create index audit_events_store_time_idx on public.audit_events (store_id, recorded_at, seq);
create index audit_events_actor_idx      on public.audit_events (store_id, actor_id, recorded_at);
create index audit_events_entity_idx     on public.audit_events (store_id, entity_type, entity_id);
create index audit_events_correlation_idx on public.audit_events (correlation_id);
create index audit_events_type_idx       on public.audit_events (store_id, event_type, recorded_at);

-- Cabeças de cadeia por partição (serializa concorrência por loja, não global).
create table public.audit_chain_heads (
  partition_key text primary key,                 -- store_id::text ou '__global__'
  last_hash     text not null
);

-- Trigger: valida campos autoritativos, computa a cadeia, garante autoria.
create or replace function app.audit_events_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_partition text;
  v_prev text;
  v_canonical text;
begin
  -- §5: campos autoritativos são do servidor — sobrescreve o que vier.
  new.recorded_at := now();

  -- §5: autoria não é arbitrária — para chamadas de cliente autenticado (JWT),
  -- actor_id deve ser o próprio usuário. Contextos de servidor (service_role
  -- ou conexão direta sem JWT) podem registrar por outros atores.
  if auth.uid() is not null and not app.is_service_role() then
    if new.actor_id is distinct from auth.uid() then
      raise exception 'audit_events: actor_id inconsistente com o usuário autenticado';
    end if;
    if new.store_id is distinct from app.current_store_id() then
      raise exception 'audit_events: store_id inconsistente com a loja ativa';
    end if;
  end if;

  -- §7: cadeia por partição com lock do head (concorrência serializada por loja).
  v_partition := coalesce(new.store_id::text, '__global__');
  insert into public.audit_chain_heads (partition_key, last_hash)
    values (v_partition, 'genesis')
    on conflict (partition_key) do nothing;
  select last_hash into v_prev
    from public.audit_chain_heads
   where partition_key = v_partition
   for update;

  -- Canônico do servidor: campos estáveis na ordem declarada.
  v_canonical := concat_ws('|',
    new.event_id, new.event_type, new.schema_version::text,
    new.occurred_at::text, new.recorded_at::text,
    coalesce(new.store_id::text,''), coalesce(new.actor_id::text,''),
    new.actor_type, coalesce(new.session_id,''), coalesce(new.device_id,''),
    new.correlation_id, coalesce(new.causation_id,''), new.idempotency_key,
    coalesce(new.entity_type,''), coalesce(new.entity_id,''),
    coalesce(new.operation,''), new.source, coalesce(new.execution_source,''),
    coalesce(new.previous_state,''), coalesce(new.next_state,''),
    new.result, coalesce(new.error_code,''), coalesce(new.error_message,'')
  );

  new.prev_hash := v_prev;
  new.hash := encode(digest(v_prev || '|' || v_canonical, 'sha256'), 'hex');

  update public.audit_chain_heads
     set last_hash = new.hash
   where partition_key = v_partition;

  return new;
end;
$$;

create trigger audit_events_before
  before insert on public.audit_events
  for each row execute function app.audit_events_before_insert();

-- Verificação de integridade da partição (investigação/exportação).
create or replace function app.verify_audit_chain(p_store uuid)
returns table (valid boolean, broken_event_id text, checked bigint)
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  r record;
  v_prev text := 'genesis';
  v_expected text;
  v_count bigint := 0;
  v_canonical text;
begin
  for r in
    select * from public.audit_events
     where coalesce(store_id::text,'__global__') = coalesce(p_store::text,'__global__')
     order by recorded_at, seq
  loop
    v_count := v_count + 1;
    if r.prev_hash <> v_prev then
      return query select false, r.event_id, v_count; return;
    end if;
    v_canonical := concat_ws('|',
      r.event_id, r.event_type, r.schema_version::text,
      r.occurred_at::text, r.recorded_at::text,
      coalesce(r.store_id::text,''), coalesce(r.actor_id::text,''),
      r.actor_type, coalesce(r.session_id,''), coalesce(r.device_id,''),
      r.correlation_id, coalesce(r.causation_id,''), r.idempotency_key,
      coalesce(r.entity_type,''), coalesce(r.entity_id,''),
      coalesce(r.operation,''), r.source, coalesce(r.execution_source,''),
      coalesce(r.previous_state,''), coalesce(r.next_state,''),
      r.result, coalesce(r.error_code,''), coalesce(r.error_message,'')
    );
    v_expected := encode(digest(v_prev || '|' || v_canonical, 'sha256'), 'hex');
    if r.hash <> v_expected then
      return query select false, r.event_id, v_count; return;
    end if;
    v_prev := r.hash;
  end loop;
  return query select true, null::text, v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e privilégios (§5/§6): append-only de verdade.
-- ---------------------------------------------------------------------------
alter table public.audit_events enable row level security;
alter table public.audit_chain_heads enable row level security;

-- SELECT: capacidade audit.read, escopo da loja (eventos globais: service only).
create policy audit_events_select on public.audit_events for select to authenticated
  using (store_id = app.current_store_id() and app.has_permission('audit.read'));

-- INSERT: autenticado, na própria loja (trigger valida autoria e completa).
create policy audit_events_insert on public.audit_events for insert to authenticated
  with check (store_id = app.current_store_id());

-- UPDATE/DELETE: NENHUMA policy + privilégio revogado — imutabilidade lógica.
revoke update, delete on public.audit_events from authenticated, anon;
revoke all on public.audit_chain_heads from authenticated, anon;

-- Idempotência de aplicação: PK event_id ⇒ inserts duplicados conflitam;
-- o transporte trata conflito de PK como 'duplicate' (dedupe lógico).
