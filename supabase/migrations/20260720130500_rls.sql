-- Tauros OS — Row Level Security (SAS v1.3 §7; ADR-003/018).
-- Padrões: (1) isolamento de tenant; (2) append-only nas fontes da verdade;
-- (3) escrita sensível por CAPACIDADE (has_permission), nunca por papel;
-- (4) audit_logs write-only-via-trigger; (5) projeções nunca escritas à mão.
-- Ocultar UI nunca é segurança: o RLS é a fronteira real.

-- ---------------------------------------------------------------------------
-- 1) Habilitar RLS em todas as tabelas do schema public.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Leitura por tenant (todas as tabelas com store_id NOT NULL).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'employees', 'store_memberships', 'job_titles', 'operational_positions',
    'teams', 'employee_assignments', 'team_staffing_requirements',
    'shift_patterns', 'shift_definitions', 'shift_occurrences', 'shift_overrides',
    'operator_sessions', 'task_templates', 'checklists', 'daily_tasks',
    'task_executions', 'equipment', 'temperature_logs', 'cleaning_logs',
    'products', 'stock_movements', 'inventory', 'production_records',
    'loss_records', 'incidents', 'attachments', 'notifications', 'goals',
    'kpi_snapshots', 'store_settings', 'store_operating_hours',
    'store_calendar_exceptions'
  ]
  loop
    execute format(
      'create policy tenant_select on public.%I for select to authenticated
         using (store_id = app.current_store_id());', t);
  end loop;
end $$;

-- Loja: membro lê a própria loja ativa.
create policy tenant_select on public.stores for select to authenticated
  using (id = app.current_store_id());

-- Perfis: o usuário lê/edita o próprio.
create policy own_profile_select on public.profiles for select to authenticated
  using (id = auth.uid());
create policy own_profile_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Catálogo de acesso (global ou por loja): leitura autenticada; escrita gerida.
create policy roles_select on public.access_roles for select to authenticated
  using (store_id is null or store_id = app.current_store_id());
create policy permissions_select on public.permissions for select to authenticated
  using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (true);

-- Config versionada / metadados de UI (global ou por loja).
create policy config_versions_select on public.configuration_versions for select to authenticated
  using (store_id is null or store_id = app.current_store_id());
create policy form_definitions_select on public.form_definitions for select to authenticated
  using (store_id is null or store_id = app.current_store_id());

-- ---------------------------------------------------------------------------
-- 3) Escrita operacional (INSERT com check de tenant) — fluxo do operador.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'operator_sessions', 'task_executions', 'temperature_logs', 'cleaning_logs',
    'incidents', 'loss_records', 'attachments', 'production_records',
    'stock_movements', 'notifications'
  ]
  loop
    execute format(
      'create policy tenant_insert on public.%I for insert to authenticated
         with check (store_id = app.current_store_id());', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Transições sensíveis por CAPACIDADE (ADR-018).
-- ---------------------------------------------------------------------------
-- Aprovar perda: loss.approve.
create policy loss_approve on public.loss_records for update to authenticated
  using (store_id = app.current_store_id() and app.has_permission('loss.approve'))
  with check (store_id = app.current_store_id());

-- Resolver revisão/conflito de execução: review.handle.
create policy execution_review on public.task_executions for update to authenticated
  using (store_id = app.current_store_id() and app.has_permission('review.handle'))
  with check (store_id = app.current_store_id());

-- Encerrar/atualizar a própria sessão; gestão ampla exige review.handle.
create policy session_update on public.operator_sessions for update to authenticated
  using (
    store_id = app.current_store_id()
    and (actor_profile_id = auth.uid() or app.has_permission('review.handle'))
  )
  with check (store_id = app.current_store_id());

-- Incidentes: atualizar exige incident.manage.
create policy incident_manage on public.incidents for update to authenticated
  using (store_id = app.current_store_id() and app.has_permission('incident.manage'))
  with check (store_id = app.current_store_id());

-- ---------------------------------------------------------------------------
-- 5) Administração & configuração: config.write / access.manage.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'stores', 'employees', 'job_titles', 'operational_positions', 'teams',
    'employee_assignments', 'team_staffing_requirements', 'shift_patterns',
    'shift_definitions', 'shift_occurrences', 'shift_overrides',
    'task_templates', 'checklists', 'equipment', 'products', 'goals',
    'store_settings', 'store_operating_hours', 'store_calendar_exceptions',
    'configuration_versions', 'form_definitions'
  ]
  loop
    execute format(
      'create policy config_write on public.%I for all to authenticated
         using (app.has_permission(''config.write''))
         with check (app.has_permission(''config.write''));', t);
  end loop;

  foreach t in array array[
    'store_memberships', 'access_roles', 'permissions', 'role_permissions',
    'membership_roles', 'membership_permission_overrides'
  ]
  loop
    execute format(
      'create policy access_manage on public.%I for all to authenticated
         using (app.has_permission(''access.manage''))
         with check (app.has_permission(''access.manage''));', t);
  end loop;
end $$;

-- Vínculo/atribuições do próprio usuário: leitura direta.
create policy own_membership_select on public.store_memberships for select to authenticated
  using (profile_id = auth.uid());
create policy own_membership_roles_select on public.membership_roles for select to authenticated
  using (exists (
    select 1 from public.store_memberships m
     where m.id = membership_id and m.profile_id = auth.uid()
  ));
create policy own_overrides_select on public.membership_permission_overrides for select to authenticated
  using (exists (
    select 1 from public.store_memberships m
     where m.id = membership_id and m.profile_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 6) Tabelas-filhas (sem store_id): policy via pai.
-- ---------------------------------------------------------------------------
create policy via_parent_select on public.shift_pattern_days for select to authenticated
  using (exists (select 1 from public.shift_patterns p
                  where p.id = pattern_id and p.store_id = app.current_store_id()));
create policy via_parent_write on public.shift_pattern_days for all to authenticated
  using (app.has_permission('config.write')) with check (app.has_permission('config.write'));

create policy via_parent_select on public.checklist_items for select to authenticated
  using (exists (select 1 from public.checklists c
                  where c.id = checklist_id and c.store_id = app.current_store_id()));
create policy via_parent_write on public.checklist_items for all to authenticated
  using (app.has_permission('config.write')) with check (app.has_permission('config.write'));

create policy via_parent_select on public.production_outputs for select to authenticated
  using (exists (select 1 from public.production_records r
                  where r.id = production_id and r.store_id = app.current_store_id()));
create policy via_parent_insert on public.production_outputs for insert to authenticated
  with check (exists (select 1 from public.production_records r
                       where r.id = production_id and r.store_id = app.current_store_id()));

-- Metadados de UI (filhas de form_definitions): leitura via raiz; escrita config.write.
do $$
declare
  t text;
begin
  foreach t in array array[
    'form_sections', 'layout_definitions', 'action_definitions'
  ]
  loop
    execute format(
      'create policy via_form_select on public.%I for select to authenticated
         using (exists (select 1 from public.form_definitions f
                         where f.id = form_definition_id
                           and (f.store_id is null or f.store_id = app.current_store_id())));', t);
    execute format(
      'create policy via_form_write on public.%I for all to authenticated
         using (app.has_permission(''config.write''))
         with check (app.has_permission(''config.write''));', t);
  end loop;
end $$;

create policy via_section_select on public.field_definitions for select to authenticated
  using (exists (
    select 1 from public.form_sections s
      join public.form_definitions f on f.id = s.form_definition_id
     where s.id = section_id
       and (f.store_id is null or f.store_id = app.current_store_id())
  ));
create policy via_section_write on public.field_definitions for all to authenticated
  using (app.has_permission('config.write')) with check (app.has_permission('config.write'));

do $$
declare
  t text;
begin
  foreach t in array array['validation_rules', 'permission_rules'] loop
    execute format(
      'create policy via_field_select on public.%I for select to authenticated
         using (exists (
           select 1 from public.field_definitions fd
             join public.form_sections s on s.id = fd.section_id
             join public.form_definitions f on f.id = s.form_definition_id
            where fd.id = field_id
              and (f.store_id is null or f.store_id = app.current_store_id())));', t);
    execute format(
      'create policy via_field_write on public.%I for all to authenticated
         using (app.has_permission(''config.write''))
         with check (app.has_permission(''config.write''));', t);
  end loop;
end $$;

create policy visibility_select on public.visibility_rules for select to authenticated
  using (true);
create policy visibility_write on public.visibility_rules for all to authenticated
  using (app.has_permission('config.write')) with check (app.has_permission('config.write'));

-- ---------------------------------------------------------------------------
-- 7) Especiais.
-- ---------------------------------------------------------------------------
-- Auditoria: leitura só com audit.read; escrita SÓ via trigger (definer).
create policy audit_read on public.audit_logs for select to authenticated
  using (store_id = app.current_store_id() and app.has_permission('audit.read'));

-- Projeção: nunca escrita à mão (nem via RLS — privilégio revogado).
revoke insert, update, delete on public.inventory from authenticated, anon;

-- Notificações: destinatário marca como lida.
create policy notification_read_own on public.notifications for update to authenticated
  using (store_id = app.current_store_id() and recipient_profile_id = auth.uid())
  with check (store_id = app.current_store_id());
