-- Tauros OS — Custom Access Token Hook (Supabase Auth).
-- Injeta no JWT os claims que TODAS as policies RLS consomem (ADR-018):
--   app_metadata.store_id                — loja ativa (tenant)
--   app_metadata.permissions             — Set efetivo (array de chaves)
--   app_metadata.permission_model_version
-- Registrar no Dashboard (Auth → Hooks → Customize Access Token) ou no
-- config.toml local. Executa como supabase_auth_admin.

create or replace function public.custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, app
as $$
declare
  v_user   uuid;
  v_claims jsonb;
  v_member public.store_memberships;
  v_perms  text[];
begin
  v_user   := (event ->> 'user_id')::uuid;
  v_claims := coalesce(event -> 'claims', '{}'::jsonb);

  v_member := app.active_membership(v_user);

  if v_member.id is not null then
    v_perms := app.effective_permissions(v_user, v_member.store_id);

    v_claims := jsonb_set(
      v_claims,
      '{app_metadata}',
      coalesce(v_claims -> 'app_metadata', '{}'::jsonb)
        || jsonb_build_object(
             'store_id', v_member.store_id,
             'permissions', to_jsonb(v_perms),
             'permission_model_version', app.permission_model_version()
           )
    );
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- Permissões de execução do hook (padrão Supabase).
grant usage on schema public, app to supabase_auth_admin;
grant execute on function public.custom_access_token(jsonb) to supabase_auth_admin;
grant select on public.store_memberships, public.membership_roles,
                public.role_permissions, public.permissions,
                public.membership_permission_overrides,
                public.configuration_versions
  to supabase_auth_admin;

revoke execute on function public.custom_access_token(jsonb) from authenticated, anon, public;
