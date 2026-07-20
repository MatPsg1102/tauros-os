-- Tauros OS — espelho auth.users → public.profiles (SAS §3: Profile é o
-- espelho 1:1 da identidade global; sem store_id).

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  insert into public.profiles (id, full_name, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Usuário'),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();
