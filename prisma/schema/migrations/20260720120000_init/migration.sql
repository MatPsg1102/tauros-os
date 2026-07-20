-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "override_effect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "task_frequency" AS ENUM ('ONCE', 'DAILY', 'PER_SHIFT', 'HOURLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "daily_task_status" AS ENUM ('PENDING', 'DONE', 'OVERDUE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "execution_result" AS ENUM ('PASS', 'FAIL', 'NA');

-- CreateEnum
CREATE TYPE "execution_source" AS ENUM ('HUMAN', 'SYSTEM', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('PENDING', 'SYNCED', 'CONFLICT', 'REVIEW');

-- CreateEnum
CREATE TYPE "review_reason" AS ENUM ('TIME_OUT_OF_BOUNDS', 'AUTHORSHIP_UNVERIFIED', 'SESSION_UNVERIFIABLE', 'PERMISSION_MISMATCH', 'STORE_MISMATCH', 'UNFINISHED_SWITCH');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('ACTIVE', 'CLOSED_LOCAL', 'CLOSED_CONFIRMED', 'REJECTED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "session_end_reason" AS ENUM ('SWITCH', 'LOGOUT', 'EXPIRED', 'STORE_SWITCH');

-- CreateEnum
CREATE TYPE "movement_type" AS ENUM ('ENTRADA', 'SAIDA_VENDA', 'PRODUCAO_CONSUMO', 'PRODUCAO_SAIDA', 'PERDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "loss_reason" AS ENUM ('QUEBRA', 'VENCIMENTO', 'CONTAMINACAO', 'AVARIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "production_status" AS ENUM ('DRAFT', 'REGISTERED', 'YIELD_REVIEW');

-- CreateEnum
CREATE TYPE "equipment_status" AS ENUM ('OK', 'ALERT', 'MAINTENANCE', 'FAULT');

-- CreateEnum
CREATE TYPE "incident_severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "incident_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "calendar_exception_type" AS ENUM ('HOLIDAY', 'SPECIAL');

-- CreateEnum
CREATE TYPE "kpi_grain" AS ENUM ('SHIFT', 'DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "field_type" AS ENUM ('TEXT', 'NUMBER', 'DECIMAL', 'CURRENCY', 'TEMPERATURE', 'DATE', 'TIME', 'DATETIME', 'SELECT', 'MULTISELECT', 'CHECKLIST', 'IMAGE', 'SIGNATURE', 'QRCODE', 'BARCODE', 'LOCATION', 'NOTE', 'ATTACHMENT');

-- CreateTable
CREATE TABLE "access_roles" (
    "id" UUID NOT NULL,
    "store_id" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "access_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_roles" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),

    CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_permission_overrides" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "effect" "override_effect" NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),

    CONSTRAINT "membership_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "execution_id" UUID,
    "incident_id" UUID,
    "loss_record_id" UUID,
    "product_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "equipment_status" NOT NULL DEFAULT 'OK',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temperature_logs" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "execution_id" UUID,
    "reading_celsius" DECIMAL(5,2) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "temperature_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_logs" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "area" TEXT NOT NULL,
    "product_used" TEXT,
    "execution_id" UUID,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cleaning_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "timezone" TEXT NOT NULL,
    "idle_lock_ms" INTEGER NOT NULL DEFAULT 900000,
    "session_absolute_ms" INTEGER NOT NULL DEFAULT 43200000,
    "pin_offline_validity_ms" INTEGER NOT NULL DEFAULT 259200000,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_operating_hours" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "opens_at" TEXT,
    "closes_at" TEXT,

    CONSTRAINT "store_operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_calendar_exceptions" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "calendar_exception_type" NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "opens_at" TEXT,
    "closes_at" TEXT,

    CONSTRAINT "store_calendar_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_versions" (
    "id" UUID NOT NULL,
    "store_id" UUID,
    "entity" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6),
    "changed_by" UUID NOT NULL,
    "justification" TEXT,
    "previous_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "timezone" TEXT,
    "shift_anchor_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "profile_id" UUID,
    "job_title_id" UUID,
    "registration" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_memberships" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "employee_id" UUID,
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "store_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "incident_severity" NOT NULL,
    "status" "incident_status" NOT NULL DEFAULT 'OPEN',
    "equipment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "movement_type" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "source_type" TEXT,
    "source_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "on_hand" DECIMAL(10,3) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_records" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "input_product_id" UUID NOT NULL,
    "input_qty" DECIMAL(10,3) NOT NULL,
    "status" "production_status" NOT NULL DEFAULT 'REGISTERED',
    "produced_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "production_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_outputs" (
    "id" UUID NOT NULL,
    "production_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "production_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loss_records" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "reason" "loss_reason" NOT NULL,
    "approved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loss_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "actor_id" UUID,
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "ip" TEXT,
    "device" TEXT,
    "server_timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "recipient_profile_id" UUID,
    "target_role_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "target_value" DECIMAL(12,3) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_snapshots" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "kpi_key" TEXT NOT NULL,
    "grain" "kpi_grain" NOT NULL,
    "period_start" DATE NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,
    "config_version_ref" UUID,
    "source_hash" TEXT,

    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_sessions" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "membership_id" UUID,
    "actor_profile_id" UUID NOT NULL,
    "actor_employee_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "opened_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "client_opened_at" TIMESTAMPTZ(6) NOT NULL,
    "client_closed_at" TIMESTAMPTZ(6),
    "server_received_at" TIMESTAMPTZ(6),
    "opened_offline" BOOLEAN NOT NULL DEFAULT false,
    "closed_offline" BOOLEAN NOT NULL DEFAULT false,
    "status" "session_status" NOT NULL DEFAULT 'ACTIVE',
    "end_reason" "session_end_reason",
    "authorization_snapshot" JSONB,
    "permission_model_version" INTEGER,
    "config_version_ref" UUID,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operator_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_patterns" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "shift_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_pattern_days" (
    "id" UUID NOT NULL,
    "pattern_id" UUID NOT NULL,
    "day_index" INTEGER NOT NULL,
    "works" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shift_pattern_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_definitions" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "breaks" JSONB,
    "config_version_ref" UUID,

    CONSTRAINT "shift_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_occurrences" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "team_id" UUID NOT NULL,
    "shift_definition_id" UUID NOT NULL,

    CONSTRAINT "shift_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_overrides" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "shift_occurrence_id" UUID,
    "work_date" DATE NOT NULL,
    "team_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "frequency" "task_frequency" NOT NULL,
    "target_position_id" UUID,
    "requires_photo" BOOLEAN NOT NULL DEFAULT false,
    "expected_min" DECIMAL(6,2),
    "expected_max" DECIMAL(6,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklists" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_tasks" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "daily_task_status" NOT NULL DEFAULT 'PENDING',
    "expected_min_snapshot" DECIMAL(6,2),
    "expected_max_snapshot" DECIMAL(6,2),
    "config_version_ref" UUID,

    CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_executions" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "daily_task_id" UUID NOT NULL,
    "operator_session_id" UUID NOT NULL,
    "execution_source" "execution_source" NOT NULL DEFAULT 'HUMAN',
    "performed_by_profile_id" UUID NOT NULL,
    "performed_by_employee_id" UUID NOT NULL,
    "synced_by_profile_id" UUID,
    "synced_by_session_id" UUID,
    "device_id" TEXT NOT NULL,
    "result" "execution_result" NOT NULL,
    "numeric_value" DECIMAL(6,2),
    "notes" TEXT,
    "event_time" TIMESTAMPTZ(6) NOT NULL,
    "client_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "server_timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_shift_id" UUID,
    "sync_status" "sync_status" NOT NULL DEFAULT 'PENDING',
    "review_reason" "review_reason",
    "idempotency_key" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "superseded_by_id" UUID,

    CONSTRAINT "task_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_definitions" (
    "id" UUID NOT NULL,
    "store_id" UUID,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_sections" (
    "id" UUID NOT NULL,
    "form_definition_id" UUID NOT NULL,
    "title" TEXT,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "form_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" "field_type" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "default_value" TEXT,
    "min" DECIMAL(14,4),
    "max" DECIMAL(14,4),
    "mask" TEXT,
    "unit" TEXT,
    "required_permission_id" UUID,
    "requires_photo" BOOLEAN NOT NULL DEFAULT false,
    "requires_comment" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_rules" (
    "id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "expression" TEXT NOT NULL,
    "message" TEXT,

    CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_rules" (
    "id" UUID NOT NULL,
    "field_id" UUID,
    "section_id" UUID,
    "condition" TEXT NOT NULL,

    CONSTRAINT "visibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_rules" (
    "id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "mode" TEXT NOT NULL,

    CONSTRAINT "permission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layout_definitions" (
    "id" UUID NOT NULL,
    "form_definition_id" UUID NOT NULL,
    "density" TEXT,
    "config" JSONB,

    CONSTRAINT "layout_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_definitions" (
    "id" UUID NOT NULL,
    "form_definition_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "kind" TEXT NOT NULL,

    CONSTRAINT "action_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_titles" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_positions" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "operational_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_assignments" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "team_id" UUID,
    "operational_position_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_staffing_requirements" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "operational_position_id" UUID NOT NULL,
    "min_count" INTEGER NOT NULL,

    CONSTRAINT "team_staffing_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_roles_store_id_idx" ON "access_roles"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_roles_store_id_key_key" ON "access_roles"("store_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "membership_roles_membership_id_idx" ON "membership_roles"("membership_id");

-- CreateIndex
CREATE INDEX "membership_permission_overrides_membership_id_idx" ON "membership_permission_overrides"("membership_id");

-- CreateIndex
CREATE INDEX "attachments_store_id_idx" ON "attachments"("store_id");

-- CreateIndex
CREATE INDEX "equipment_store_id_idx" ON "equipment"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "temperature_logs_execution_id_key" ON "temperature_logs"("execution_id");

-- CreateIndex
CREATE INDEX "temperature_logs_store_id_equipment_id_recorded_at_idx" ON "temperature_logs"("store_id", "equipment_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "cleaning_logs_execution_id_key" ON "cleaning_logs"("execution_id");

-- CreateIndex
CREATE INDEX "cleaning_logs_store_id_recorded_at_idx" ON "cleaning_logs"("store_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "store_settings_store_id_key" ON "store_settings"("store_id");

-- CreateIndex
CREATE INDEX "store_operating_hours_store_id_idx" ON "store_operating_hours"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_operating_hours_store_id_weekday_key" ON "store_operating_hours"("store_id", "weekday");

-- CreateIndex
CREATE INDEX "store_calendar_exceptions_store_id_idx" ON "store_calendar_exceptions"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_calendar_exceptions_store_id_date_key" ON "store_calendar_exceptions"("store_id", "date");

-- CreateIndex
CREATE INDEX "configuration_versions_entity_version_idx" ON "configuration_versions"("entity", "version");

-- CreateIndex
CREATE UNIQUE INDEX "stores_cnpj_key" ON "stores"("cnpj");

-- CreateIndex
CREATE INDEX "employees_store_id_idx" ON "employees"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_store_id_registration_key" ON "employees"("store_id", "registration");

-- CreateIndex
CREATE UNIQUE INDEX "store_memberships_employee_id_key" ON "store_memberships"("employee_id");

-- CreateIndex
CREATE INDEX "store_memberships_store_id_idx" ON "store_memberships"("store_id");

-- CreateIndex
CREATE INDEX "store_memberships_profile_id_idx" ON "store_memberships"("profile_id");

-- CreateIndex
CREATE INDEX "incidents_store_id_status_idx" ON "incidents"("store_id", "status");

-- CreateIndex
CREATE INDEX "products_store_id_idx" ON "products"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_store_id_sku_key" ON "products"("store_id", "sku");

-- CreateIndex
CREATE INDEX "stock_movements_store_id_product_id_created_at_idx" ON "stock_movements"("store_id", "product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_product_id_key" ON "inventory"("product_id");

-- CreateIndex
CREATE INDEX "inventory_store_id_idx" ON "inventory"("store_id");

-- CreateIndex
CREATE INDEX "production_records_store_id_produced_at_idx" ON "production_records"("store_id", "produced_at");

-- CreateIndex
CREATE INDEX "loss_records_store_id_created_at_idx" ON "loss_records"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_store_id_entity_created_at_idx" ON "audit_logs"("store_id", "entity", "created_at");

-- CreateIndex
CREATE INDEX "notifications_store_id_recipient_profile_id_idx" ON "notifications"("store_id", "recipient_profile_id");

-- CreateIndex
CREATE INDEX "goals_store_id_idx" ON "goals"("store_id");

-- CreateIndex
CREATE INDEX "kpi_snapshots_store_id_idx" ON "kpi_snapshots"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_snapshots_store_id_kpi_key_grain_period_start_key" ON "kpi_snapshots"("store_id", "kpi_key", "grain", "period_start");

-- CreateIndex
CREATE INDEX "operator_sessions_store_id_idx" ON "operator_sessions"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "operator_sessions_store_id_idempotency_key_key" ON "operator_sessions"("store_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "shift_patterns_store_id_idx" ON "shift_patterns"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_pattern_days_pattern_id_day_index_key" ON "shift_pattern_days"("pattern_id", "day_index");

-- CreateIndex
CREATE INDEX "shift_definitions_store_id_idx" ON "shift_definitions"("store_id");

-- CreateIndex
CREATE INDEX "shift_occurrences_store_id_work_date_idx" ON "shift_occurrences"("store_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_occurrences_store_id_work_date_key" ON "shift_occurrences"("store_id", "work_date");

-- CreateIndex
CREATE INDEX "shift_overrides_store_id_work_date_idx" ON "shift_overrides"("store_id", "work_date");

-- CreateIndex
CREATE INDEX "task_templates_store_id_idx" ON "task_templates"("store_id");

-- CreateIndex
CREATE INDEX "checklists_store_id_idx" ON "checklists"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_items_checklist_id_template_id_key" ON "checklist_items"("checklist_id", "template_id");

-- CreateIndex
CREATE INDEX "daily_tasks_store_id_work_date_status_idx" ON "daily_tasks"("store_id", "work_date", "status");

-- CreateIndex
CREATE INDEX "task_executions_store_id_event_time_idx" ON "task_executions"("store_id", "event_time");

-- CreateIndex
CREATE UNIQUE INDEX "task_executions_store_id_idempotency_key_key" ON "task_executions"("store_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "form_definitions_store_id_idx" ON "form_definitions"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_definitions_store_id_key_version_key" ON "form_definitions"("store_id", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_section_id_key_key" ON "field_definitions"("section_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "layout_definitions_form_definition_id_key" ON "layout_definitions"("form_definition_id");

-- CreateIndex
CREATE INDEX "job_titles_store_id_idx" ON "job_titles"("store_id");

-- CreateIndex
CREATE INDEX "operational_positions_store_id_idx" ON "operational_positions"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "operational_positions_store_id_key_key" ON "operational_positions"("store_id", "key");

-- CreateIndex
CREATE INDEX "teams_store_id_idx" ON "teams"("store_id");

-- CreateIndex
CREATE INDEX "employee_assignments_store_id_idx" ON "employee_assignments"("store_id");

-- CreateIndex
CREATE INDEX "employee_assignments_employee_id_idx" ON "employee_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "team_staffing_requirements_store_id_idx" ON "team_staffing_requirements"("store_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "store_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_permission_overrides" ADD CONSTRAINT "membership_permission_overrides_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "store_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_permission_overrides" ADD CONSTRAINT "membership_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "task_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_loss_record_id_fkey" FOREIGN KEY ("loss_record_id") REFERENCES "loss_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temperature_logs" ADD CONSTRAINT "temperature_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temperature_logs" ADD CONSTRAINT "temperature_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "task_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_logs" ADD CONSTRAINT "cleaning_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "task_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_versions" ADD CONSTRAINT "configuration_versions_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "configuration_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "job_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_input_product_id_fkey" FOREIGN KEY ("input_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "production_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_records" ADD CONSTRAINT "loss_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "store_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_pattern_days" ADD CONSTRAINT "shift_pattern_days_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "shift_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_occurrences" ADD CONSTRAINT "shift_occurrences_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_occurrences" ADD CONSTRAINT "shift_occurrences_shift_definition_id_fkey" FOREIGN KEY ("shift_definition_id") REFERENCES "shift_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_shift_occurrence_id_fkey" FOREIGN KEY ("shift_occurrence_id") REFERENCES "shift_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_target_position_id_fkey" FOREIGN KEY ("target_position_id") REFERENCES "operational_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_daily_task_id_fkey" FOREIGN KEY ("daily_task_id") REFERENCES "daily_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_operator_session_id_fkey" FOREIGN KEY ("operator_session_id") REFERENCES "operator_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "task_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_sections" ADD CONSTRAINT "form_sections_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "form_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_rules" ADD CONSTRAINT "validation_rules_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_rules" ADD CONSTRAINT "visibility_rules_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_rules" ADD CONSTRAINT "visibility_rules_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "form_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_rules" ADD CONSTRAINT "permission_rules_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layout_definitions" ADD CONSTRAINT "layout_definitions_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_definitions" ADD CONSTRAINT "action_definitions_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_operational_position_id_fkey" FOREIGN KEY ("operational_position_id") REFERENCES "operational_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_staffing_requirements" ADD CONSTRAINT "team_staffing_requirements_operational_position_id_fkey" FOREIGN KEY ("operational_position_id") REFERENCES "operational_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

