-- Tauros OS — validação de execução no BEFORE INSERT (ADR-008/014; Baseline §1-2).
-- O servidor é autoritativo para "quando chegou"; o turno é resolvido pelo
-- event_time validado (nunca pelo now() do sync). Fora dos bounds → REVIEW,
-- nunca descarte silencioso.

create or replace function app.resolve_shift_occurrence(p_store uuid, p_at timestamptz)
returns uuid
language plpgsql
stable
set search_path = public, app
as $$
declare
  v_tz   text;
  v_date date;
  v_occ  uuid;
begin
  -- Timezone da loja (config); fallback UTC.
  select coalesce(ss.timezone, 'UTC') into v_tz
    from public.store_settings ss where ss.store_id = p_store;
  v_date := (p_at at time zone coalesce(v_tz, 'UTC'))::date;

  -- v1.3: escala é config materializada — a ocorrência do dia responde.
  -- Overrides já foram aplicados na materialização (shift_overrides).
  select so.id into v_occ
    from public.shift_occurrences so
   where so.store_id = p_store and so.work_date = v_date;

  return v_occ;
end;
$$;

create or replace function app.validate_execution()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_drift   interval;
  v_tz      text;
  v_weekday int;
  v_open    time;
  v_close   time;
  v_local   time;
begin
  -- Servidor é autoritativo para o momento de chegada.
  new.server_timestamp := now();
  new.sync_status := 'SYNCED';
  new.review_reason := null;

  -- Bound 1: evento no futuro (tolerância 5 min de clock skew).
  if new.event_time > now() + interval '5 minutes' then
    new.sync_status := 'REVIEW';
    new.review_reason := 'TIME_OUT_OF_BOUNDS';
  end if;

  -- Bound 2: offline longo demais (janela do Baseline: 24h).
  v_drift := now() - new.client_timestamp;
  if v_drift > interval '24 hours' or v_drift < interval '-5 minutes' then
    new.sync_status := 'REVIEW';
    new.review_reason := 'TIME_OUT_OF_BOUNDS';
  end if;

  -- Bound 3: fora da janela operacional configurada (se houver config).
  select coalesce(ss.timezone, 'UTC') into v_tz
    from public.store_settings ss where ss.store_id = new.store_id;
  v_local := ((new.event_time at time zone coalesce(v_tz, 'UTC'))::time);
  v_weekday := extract(dow from (new.event_time at time zone coalesce(v_tz, 'UTC')))::int;

  select oh.opens_at::time, oh.closes_at::time into v_open, v_close
    from public.store_operating_hours oh
   where oh.store_id = new.store_id and oh.weekday = v_weekday and oh.is_open;

  if found and v_open is not null and v_close is not null then
    -- Tolerância de 30 min em cada borda (registro na abertura/fechamento).
    if v_local < (v_open - interval '30 minutes')::time
       or v_local > (v_close + interval '30 minutes')::time then
      new.sync_status := 'REVIEW';
      new.review_reason := coalesce(new.review_reason, 'TIME_OUT_OF_BOUNDS');
    end if;
  end if;

  -- Turno resolvido pela intenção (event_time), não pelo sync (ADR-008).
  new.resolved_shift_id := app.resolve_shift_occurrence(new.store_id, new.event_time);

  return new;
end;
$$;

create trigger validate_execution_before
  before insert on public.task_executions
  for each row execute function app.validate_execution();

-- Correção é nova linha (superseded_by) — DELETE nunca; UPDATE só via revisão
-- autorizada (policy RLS com review.handle).
revoke delete on public.task_executions from authenticated, anon;
