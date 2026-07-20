-- Tauros OS — auditoria por trigger no banco (ADR-007).
-- Funciona para escrita direta via supabase-js E via service-role; impossível
-- "esquecer de chamar". IP/device chegam por parâmetro de sessão (set_config).

create or replace function app.trigger_audit()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_store uuid;
  v_id uuid;
begin
  v_store := coalesce(
    case when tg_op = 'DELETE' then null else (to_jsonb(new) ->> 'store_id')::uuid end,
    case when tg_op = 'INSERT' then null else (to_jsonb(old) ->> 'store_id')::uuid end
  );
  v_id := coalesce(
    case when tg_op = 'DELETE' then null else (to_jsonb(new) ->> 'id')::uuid end,
    case when tg_op = 'INSERT' then null else (to_jsonb(old) ->> 'id')::uuid end
  );

  insert into public.audit_logs
    (id, store_id, actor_id, entity, entity_id, action, diff, ip, device, server_timestamp, created_at)
  values (
    gen_random_uuid(),
    v_store,
    auth.uid(),
    tg_table_name,
    v_id,
    tg_op,
    jsonb_build_object(
      'before', case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      'after',  case when tg_op = 'DELETE' then null else to_jsonb(new) end
    ),
    nullif(current_setting('app.ip', true), ''),
    nullif(current_setting('app.device', true), ''),
    now(),
    now()
  );

  return coalesce(new, old);
end;
$$;

-- Tabelas sensíveis (fontes da verdade + decisões + configuração).
do $$
declare
  t text;
begin
  foreach t in array array[
    'task_executions', 'operator_sessions', 'stock_movements',
    'production_records', 'loss_records', 'incidents',
    'temperature_logs', 'cleaning_logs',
    'store_memberships', 'membership_roles', 'membership_permission_overrides',
    'store_settings', 'store_operating_hours', 'store_calendar_exceptions',
    'shift_definitions', 'shift_patterns', 'shift_overrides',
    'configuration_versions', 'form_definitions',
    'employee_assignments', 'team_staffing_requirements'
  ]
  loop
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function app.trigger_audit();', t);
  end loop;
end $$;

-- audit_logs é append-only no nível de privilégio (além do RLS).
revoke update, delete on public.audit_logs from authenticated, anon;
