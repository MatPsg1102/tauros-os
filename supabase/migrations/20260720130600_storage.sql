-- Tauros OS — Storage (ADR-012: binário no Storage; metadados em attachments).
-- Bucket privado; objetos organizados por tenant: attachments/<store_id>/...
-- O isolamento usa o 1º segmento do path = store_id do JWT.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy attachments_select on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = app.current_store_id()::text
  );

create policy attachments_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = app.current_store_id()::text
  );

-- Evidência é imutável (P3/rastreabilidade): sem update; remoção só service-role.
