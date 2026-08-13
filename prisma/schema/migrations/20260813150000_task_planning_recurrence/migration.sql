-- Planejamento e recorrência de tarefas (Área do Encarregado).
-- Aditiva, forward-only: não altera dados nem colunas existentes. Aplicada
-- junto do deploy do backend real (o fluxo operacional roda offline-first no
-- cliente até lá). target_position_id já era NULLABLE — "definir no dia" é
-- representado pela ausência real de responsável, sem posição artificial.

-- CreateEnum
CREATE TYPE "task_recurrence_kind" AS ENUM ('ONCE', 'WEEKDAYS', 'WHEN_SCHEDULED');

-- CreateEnum
CREATE TYPE "weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- AlterTable: planejamento na definição
ALTER TABLE "task_templates"
  ADD COLUMN "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "planned_start_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "planned_end_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recurrence_kind" "task_recurrence_kind" NOT NULL DEFAULT 'WEEKDAYS',
  ADD COLUMN "recurrence_weekdays" "weekday"[] NOT NULL DEFAULT ARRAY[]::"weekday"[];

-- AlterTable: atribuição situacional + início planejado na ocorrência
ALTER TABLE "daily_tasks"
  ADD COLUMN "planned_start_at" TIMESTAMPTZ(6),
  ADD COLUMN "assigned_position_id" UUID;

-- AddForeignKey: atribuição situacional referencia a posição oficial
ALTER TABLE "daily_tasks"
  ADD CONSTRAINT "daily_tasks_assigned_position_id_fkey"
  FOREIGN KEY ("assigned_position_id") REFERENCES "operational_positions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
