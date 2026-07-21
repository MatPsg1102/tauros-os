-- 7.2: capability oficial de fechamento de sessão operacional (ADR-018).
-- Aditiva, forward-only e idempotente. Nenhuma migration aplicada é editada.
-- Aplicação junto do deploy do backend do slice — o seed de 'session.open'
-- (20260721160000) permanece pendente e entra no MESMO plano de deploy.
--
-- Execução de tarefa NÃO ganha capability nova: a RLS congelada autoriza o
-- insert em task_executions apenas por tenant (store_id), e 'review.handle'
-- continua governando a resolução de revisão/conflito.
INSERT INTO public.permissions (id, code, description)
VALUES (gen_random_uuid(), 'session.close', 'Fechar sessão operacional (turno de trabalho)')
ON CONFLICT (code) DO NOTHING;
