-- Tauros OS — CHECK constraints estruturais (SAS v1.3 §3; ADR-009/012).
-- Invariantes que o Prisma não expressa.

-- ADR-012: attachment tem exatamente UM pai (polimorfismo tipado).
alter table public.attachments
  add constraint attachment_single_parent check (
    (execution_id   is not null)::int +
    (incident_id    is not null)::int +
    (loss_record_id is not null)::int +
    (product_id     is not null)::int = 1
  );

-- ADR-009: o sinal mora no dado — quantity coerente com o MovementType.
-- ENTRADA / PRODUCAO_SAIDA entram positivas; SAIDA_VENDA / PRODUCAO_CONSUMO /
-- PERDA entram negativas; AJUSTE apenas não-zero.
alter table public.stock_movements
  add constraint stock_movement_sign_matches_type check (
    (type in ('ENTRADA', 'PRODUCAO_SAIDA')  and quantity > 0) or
    (type in ('SAIDA_VENDA', 'PRODUCAO_CONSUMO', 'PERDA') and quantity < 0) or
    (type = 'AJUSTE' and quantity <> 0)
  );

-- RA-QUEUE-01/ADR-016: consistência temporal mínima do registro offline.
alter table public.task_executions
  add constraint execution_client_before_server check (
    client_timestamp <= server_timestamp
  );

-- VisibilityRule aponta para campo OU seção (exatamente um).
alter table public.visibility_rules
  add constraint visibility_rule_single_target check (
    (field_id is not null)::int + (section_id is not null)::int = 1
  );
