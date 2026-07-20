-- Tauros OS — app helpers (SAS v1.3 §7: Security & Authorization).
-- Claim-based helpers used by every RLS policy. Authorization is derived from
-- effective permissions embedded in the JWT (ADR-018) — never from role enums.

create schema if not exists app;

-- Active store (tenant) from JWT app_metadata.
create or replace function app.current_store_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      auth.jwt() -> 'app_metadata' ->> 'store_id',
      auth.jwt() ->> 'store_id'
    ), ''
  )::uuid;
$$;

-- Authenticated profile id (auth.users.id mirror).
create or replace function app.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- Capability check against the effective permission set in the JWT
-- (claim `permissions`: JSON array of keys). DENY-wins is applied when the
-- set is derived (PermissionResolver) — the claim already reflects overrides.
create or replace function app.has_permission(p_key text)
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' -> 'permissions') ? p_key,
    false
  );
$$;

-- Service role bypass detector (Prisma/admin path, ADR-002).
create or replace function app.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

comment on function app.current_store_id() is 'Tenant do JWT (app_metadata.store_id).';
comment on function app.has_permission(text) is 'Capability check no Set efetivo do JWT (ADR-018).';
