-- 7.1: capability oficial de abertura de sessão operacional (ADR-018).
-- Aditiva e idempotente; aplicada junto do deploy do backend do slice.
INSERT INTO public.permissions (id, code, description)
VALUES (gen_random_uuid(), 'session.open', 'Abrir sessão operacional (turno de trabalho)')
ON CONFLICT (code) DO NOTHING;
