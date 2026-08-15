-- Identidade Operacional V1 (ADR-021). Aditiva, forward-only: não altera dados
-- existentes. Materializa a credencial de PIN como conceito SEPARADO de
-- Employee (relação 1:0..1) e relaxa a identidade de PLATAFORMA da sessão.
--
-- Decisões congeladas (ADR-021):
--  1. Employee NUNCA ganha coluna pin/password; a credencial vive em tabela
--     própria (employee_pin_credentials) e guarda o VERIFIER (hash + salt),
--     nunca o PIN em texto puro.
--  2. O verifier server-side NÃO é bearer credential: o servidor verifica o
--     PIN e resolve permissões; nunca concede acesso por igualdade de hash
--     recebida do cliente.
--  3. actor_profile_id da sessão passa a NULLABLE — identidade de plataforma é
--     opcional até provisionamento real; actor_employee_id (autoria
--     operacional) permanece obrigatório. Sem UUID fictício.

-- CreateEnum: ciclo de vida da credencial
CREATE TYPE "credential_status" AS ENUM (
  'LOCAL_PENDING_PROVISIONING',
  'PROVISIONED',
  'BLOCKED',
  'RESET_REQUIRED'
);

-- CreateTable: credencial de PIN (1:0..1 com employees; employees intacta)
CREATE TABLE "employee_pin_credentials" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" "credential_status" NOT NULL DEFAULT 'LOCAL_PENDING_PROVISIONING',
    "last_online_confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_pin_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: relação 1:0..1 (uma credencial por colaborador) + escopo de loja
CREATE UNIQUE INDEX "employee_pin_credentials_employee_id_key" ON "employee_pin_credentials"("employee_id");
CREATE INDEX "employee_pin_credentials_store_id_idx" ON "employee_pin_credentials"("store_id");

-- AddForeignKey: credencial pertence a um colaborador cadastrado
ALTER TABLE "employee_pin_credentials"
  ADD CONSTRAINT "employee_pin_credentials_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: identidade de plataforma opcional na sessão (ADR-021 §10)
ALTER TABLE "operator_sessions" ALTER COLUMN "actor_profile_id" DROP NOT NULL;
