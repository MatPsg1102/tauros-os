-- Escala Operacional V1 (Gestão de Equipe). Aditiva, forward-only: não
-- altera dados nem colunas existentes; aplicada junto do deploy do backend
-- real (o fluxo operacional roda offline-first no cliente até lá).
--
-- Lacunas mínimas do schema congelado que esta migration cobre:
--  1. JORNADA por VÍNCULO (employee_assignments.shift_definition_id):
--     colaboradores da MESMA equipe podem ter horários diferentes — a janela
--     de trabalho pertence à pessoa/vínculo, nunca à equipe. NULL = vínculo
--     anterior à Escala V1 (sem jornada declarada).
--  2. ROTAÇÃO por EQUIPE (teams.rotation_offset): posição da equipe no ciclo
--     do padrão vigente (12x36 A/B = offsets 0 e 1). A âncora da rotação já
--     existe (stores.shift_anchor_date).
--  3. VIGÊNCIA do padrão (shift_patterns.effective_from/effective_until):
--     troca de escala sem reescrever histórico; NULL = aberto.

-- AlterTable: jornada declarada no vínculo temporal
ALTER TABLE "employee_assignments"
  ADD COLUMN "shift_definition_id" UUID;

-- AddForeignKey: a jornada referencia a definição oficial (config, ADR-019)
ALTER TABLE "employee_assignments"
  ADD CONSTRAINT "employee_assignments_shift_definition_id_fkey"
  FOREIGN KEY ("shift_definition_id") REFERENCES "shift_definitions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: posição da equipe no ciclo do padrão da loja
ALTER TABLE "teams"
  ADD COLUMN "rotation_offset" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: vigência temporal do padrão de escala
ALTER TABLE "shift_patterns"
  ADD COLUMN "effective_from" DATE,
  ADD COLUMN "effective_until" DATE;
