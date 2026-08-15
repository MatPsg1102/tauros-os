-- Operação Compartilhada V1. Aditiva, forward-only: não altera dados nem
-- colunas existentes; aplicada junto do deploy do backend real.
--
-- Evoluções FUNCIONAIS dentro da arquitetura congelada (sem ADR — decisão
-- registrada na traceability):
--  1. Estados intermediários da OCORRÊNCIA (daily_task_status): a decisão
--     "sem estado intermediário" era ESCOPO da 7.2; o ciclo compartilhado
--     exige EM EXECUÇÃO → AGUARDANDO CONFERÊNCIA → CORREÇÃO NECESSÁRIA.
--     DONE permanece o ÚNICO terminal de aprovação (concluir ≠ aprovar).
--  2. requires_review na DEFINIÇÃO — mesmo padrão de requires_photo
--     (parâmetro da definição; default false = zero mudança para templates
--     existentes; review nunca é obrigatório para tudo).
--  3. Horário REAL de início na ocorrência (started_at/started_by) e na
--     execução (started_at) — planejado ≠ real.
--  4. CONFERÊNCIA como fato sobre a execução (reviewed_by/at, outcome, nota).
--     Devolução NUNCA apaga a execução: o reenvio cria NOVA execução ligada
--     pela cadeia superseded_by_id JÁ EXISTENTE no schema congelado.
--     (review_reason existente segue sendo de SYNC/autoria — conceito
--     distinto, intocado.)

-- AlterEnum: estados intermediários do ciclo compartilhado (aditivo)
ALTER TYPE "daily_task_status" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "daily_task_status" ADD VALUE 'AWAITING_REVIEW';
ALTER TYPE "daily_task_status" ADD VALUE 'NEEDS_CORRECTION';

-- CreateEnum: desfecho da conferência gerencial
CREATE TYPE "task_review_outcome" AS ENUM ('APPROVED', 'RETURNED');

-- AlterTable: review como parâmetro da definição (padrão de requires_photo)
ALTER TABLE "task_templates"
  ADD COLUMN "requires_review" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: execução em andamento na ocorrência (quem/quando iniciou)
ALTER TABLE "daily_tasks"
  ADD COLUMN "started_at" TIMESTAMPTZ(6),
  ADD COLUMN "started_by_employee_id" UUID;

-- AlterTable: horário real de início + conferência na execução
ALTER TABLE "task_executions"
  ADD COLUMN "started_at" TIMESTAMPTZ(6),
  ADD COLUMN "reviewed_by_profile_id" UUID,
  ADD COLUMN "reviewed_by_employee_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
  ADD COLUMN "review_outcome" "task_review_outcome",
  ADD COLUMN "review_note" TEXT;
