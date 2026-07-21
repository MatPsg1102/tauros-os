// Capability oficial da abertura de sessão operacional (ADR-018).
// Registro de governança 7.1: as 6 permissions seedadas na infra-v1.0 não
// cobrem abertura de sessão; esta é a definição ÚNICA (sem variantes).
// A migration aditiva do seed correspondente acompanha esta etapa e será
// aplicada ao banco junto do deploy do backend real (pendência registrada).

export const CAPABILITY_SESSION_OPEN = 'session.open' as const;

/** Versão vigente do modelo de permissões (ADR-018 §versionamento). */
export const PERMISSION_MODEL_VERSION = 1 as const;
