// Capability oficial da abertura de sessão operacional (ADR-018).
// Registro de governança 7.1: as 6 permissions seedadas na infra-v1.0 não
// cobrem abertura de sessão; esta é a definição ÚNICA (sem variantes).
// A migration aditiva do seed correspondente acompanha esta etapa e será
// aplicada ao banco junto do deploy do backend real (pendência registrada).

export const CAPABILITY_SESSION_OPEN = 'session.open' as const;

/** Capacidade oficial de fechamento (7.2) — string única em todo o sistema. */
export const CAPABILITY_SESSION_CLOSE = 'session.close' as const;

/**
 * Capacidade oficial de escrita de configuração (catálogo congelado; RLS de
 * task_templates). Governa a Área do Encarregado: TaskTemplate é dado
 * configurável (ADR-019) — nenhuma string concorrente foi criada.
 */
export const CAPABILITY_CONFIG_WRITE = 'config.write' as const;

/**
 * Capacidade oficial de gestão de equipe: cadastro de colaboradores e seus
 * vínculos (employees + employee_assignments). É dado de RH OPERACIONAL —
 * não é configuração (ADR-019 cobre cargos/posições), por isso NÃO reutiliza
 * config.write. Mesmo mecanismo ADR-018 (string nas permissões efetivas);
 * nenhuma capability deriva da posição ocupada.
 */
export const CAPABILITY_WORKFORCE_WRITE = 'workforce.write' as const;

/** Versão vigente do modelo de permissões (ADR-018 §versionamento). */
export const PERMISSION_MODEL_VERSION = 1 as const;
