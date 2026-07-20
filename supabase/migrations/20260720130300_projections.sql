-- Tauros OS — projeção de estoque (ADR-009).
-- inventory NUNCA é escrito à mão: somente este trigger, a partir do razão.
-- A soma é cega (quantity já carrega o sinal — CHECK garante coerência).

create or replace function app.project_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  insert into public.inventory (id, store_id, product_id, on_hand, updated_at)
  values (gen_random_uuid(), new.store_id, new.product_id, new.quantity, now())
  on conflict (product_id)
  do update set
    on_hand    = public.inventory.on_hand + excluded.on_hand,
    updated_at = now();

  return new;
end;
$$;

create trigger project_inventory_after
  after insert on public.stock_movements
  for each row execute function app.project_inventory();

-- Razão imutável: nenhum UPDATE/DELETE, nem por privilégio de app.
revoke update, delete on public.stock_movements from authenticated, anon;
