-- Tauros OS — PermissionResolver no banco (ADR-018).
-- Deriva o Set efetivo: vínculo ACTIVE → papéis válidos agora → união de
-- role_permissions → overrides temporais (DENY vence). Consumido pelo
-- Custom Access Token Hook para embutir claims no JWT.

-- Vínculo ativo do profile (MVP: um por vez; multi-loja escolhe o mais recente).
create or replace function app.active_membership(p_profile uuid)
returns public.store_memberships
language sql
stable
set search_path = public, app
as $$
  select m.*
    from public.store_memberships m
   where m.profile_id = p_profile
     and m.status = 'ACTIVE'
     and (m.ended_at is null or m.ended_at > now())
   order by m.started_at desc
   limit 1;
$$;

-- Set efetivo de permissões para (profile, loja) no instante atual.
create or replace function app.effective_permissions(p_profile uuid, p_store uuid)
returns text[]
language sql
stable
set search_path = public, app
as $$
  with membership as (
    select m.id
      from public.store_memberships m
     where m.profile_id = p_profile
       and m.store_id = p_store
       and m.status = 'ACTIVE'
       and (m.ended_at is null or m.ended_at > now())
  ),
  role_grants as (
    select p.key
      from membership mb
      join public.membership_roles mr on mr.membership_id = mb.id
      join public.role_permissions rp on rp.role_id = mr.role_id
      join public.permissions p on p.id = rp.permission_id
     where mr.valid_from <= now()
       and (mr.valid_until is null or mr.valid_until > now())
  ),
  allows as (
    select p.key
      from membership mb
      join public.membership_permission_overrides o on o.membership_id = mb.id
      join public.permissions p on p.id = o.permission_id
     where o.effect = 'ALLOW'
       and o.valid_from <= now()
       and (o.valid_until is null or o.valid_until > now())
  ),
  denies as (
    select p.key
      from membership mb
      join public.membership_permission_overrides o on o.membership_id = mb.id
      join public.permissions p on p.id = o.permission_id
     where o.effect = 'DENY'
       and o.valid_from <= now()
       and (o.valid_until is null or o.valid_until > now())
  )
  select coalesce(array_agg(distinct k order by k), '{}')
    from (
      select key as k from role_grants
      union
      select key from allows
    ) granted
   where k not in (select key from denies);
$$;

-- Versão do modelo de permissões (invalidação de cache / snapshot de sessão).
create or replace function app.permission_model_version()
returns int
language sql
stable
set search_path = public, app
as $$
  select coalesce(max(version), 1)
    from public.configuration_versions
   where entity = 'permission_model';
$$;

comment on function app.effective_permissions(uuid, uuid) is
  'Set efetivo (ADR-018): papéis válidos + ALLOW − DENY, avaliado em now().';
