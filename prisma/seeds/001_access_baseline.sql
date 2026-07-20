-- Tauros OS — seed do modelo de acesso (ADR-018). IDEMPOTENTE.
-- Papéis e permissões são DADOS (nunca enum). Templates globais: store_id NULL.
-- Nota: unique(store_id, key) não deduplica NULLs — por isso NOT EXISTS.

-- 1) Catálogo de permissões (chaves consumidas pelas policies RLS da 6.2.3).
insert into public.permissions (id, key, description)
select gen_random_uuid(), v.key, v.description
from (values
  ('loss.approve',    'Aprovar perdas (emite movimento no razão)'),
  ('review.handle',   'Tratar revisões e conflitos de execução/sessão'),
  ('incident.manage', 'Atribuir e resolver incidentes'),
  ('config.write',    'Alterar configuração operacional (Configuration Engine)'),
  ('access.manage',   'Gerir papéis, permissões e vínculos'),
  ('audit.read',      'Consultar a trilha de auditoria')
) as v(key, description)
where not exists (select 1 from public.permissions p where p.key = v.key);

-- 2) Papéis-template globais (presets da SAS §5; semeiam permissões).
insert into public.access_roles (id, store_id, key, name)
select gen_random_uuid(), null, v.key, v.name
from (values
  ('owner',    'Dono'),
  ('admin',    'Administrador'),
  ('manager',  'Encarregado'),
  ('operator', 'Operador')
) as v(key, name)
where not exists (
  select 1 from public.access_roles r where r.store_id is null and r.key = v.key
);

-- 3) Mapeamento papel → permissões.
--    owner/admin: todas; manager (≈ Encarregado): decisões operacionais;
--    operator: nenhuma chave sensível (o fluxo operacional básico não exige).
insert into public.role_permissions (id, role_id, permission_id)
select gen_random_uuid(), r.id, p.id
from public.access_roles r
join public.permissions p on (
  (r.key in ('owner', 'admin'))
  or (r.key = 'manager' and p.key in ('loss.approve', 'review.handle', 'incident.manage', 'audit.read'))
)
where r.store_id is null
  and not exists (
    select 1 from public.role_permissions rp
     where rp.role_id = r.id and rp.permission_id = p.id
  );
