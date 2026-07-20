-- Correção forward-only: no Supabase, pgcrypto vive no schema `extensions`.
-- As funções de auditoria precisam enxergar digest() — ajusta o search_path
-- persistido das funções (sem tocar nos corpos já aplicados).

alter function app.audit_events_before_insert()
  set search_path = public, app, extensions;

alter function app.verify_audit_chain(uuid)
  set search_path = public, app, extensions;
