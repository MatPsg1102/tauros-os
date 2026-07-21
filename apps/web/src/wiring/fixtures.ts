// FIXTURES DE DESENVOLVIMENTO (7.1 §8/§33) — identidade e loja fictícias
// para o vertical slice ANTES do backend real. NÃO É AUTENTICAÇÃO:
// nenhum segredo real, nenhuma falsa garantia. Bloqueadas em produção
// (guard explícito — impossíveis de ativar por acidente).

export class FixturesDisabledError extends Error {
  constructor() {
    super(
      'Fixtures de desenvolvimento desabilitadas neste ambiente. ' +
        'A identificação real chega com o adapter de backend (pendência 7.x).',
    );
    this.name = 'FixturesDisabledError';
  }
}

export function fixturesEnabled(): boolean {
  // build de produção nunca ativa por acidente: exige opt-in explícito
  if (process.env.NODE_ENV === 'production') {
    return process.env['NEXT_PUBLIC_TAUROS_FIXTURES'] === 'demo';
  }
  return true;
}

export interface FixtureStore {
  readonly id: string;
  readonly name: string;
  /** Fuso IANA oficial da LOJA (dado da loja — nunca literal na lógica). */
  readonly timeZone: string;
}

export interface FixtureOperator {
  readonly employeeId: string;
  readonly profileId: string;
  readonly membershipId: string;
  readonly name: string;
  /** PIN de demonstração (fixture) — comparado apenas em memória. */
  readonly pin: string;
  readonly permissions: readonly string[];
}

export const FIXTURE_STORE: FixtureStore = {
  id: 'store-centro-0001',
  name: 'Casa de Carnes Modelo — Centro',
  timeZone: 'America/Sao_Paulo',
};

/**
 * Três operadores cobrindo os cenários reais de autorização (7.2):
 * completo, sem abertura e COM abertura mas SEM fechamento.
 */
export const FIXTURE_OPERATORS: readonly FixtureOperator[] = [
  {
    employeeId: 'emp-0001',
    profileId: 'prof-0001',
    membershipId: 'memb-0001',
    name: 'Marina Álvares',
    pin: '2468',
    permissions: ['session.open', 'session.close', 'audit.read'],
  },
  {
    employeeId: 'emp-0002',
    profileId: 'prof-0002',
    membershipId: 'memb-0002',
    name: 'Carlos Nunes',
    pin: '1357',
    permissions: ['audit.read'],
  },
  {
    employeeId: 'emp-0003',
    profileId: 'prof-0003',
    membershipId: 'memb-0003',
    name: 'Rita Belmonte',
    pin: '9753',
    permissions: ['session.open', 'audit.read'],
  },
];

/**
 * Definições de tarefa da loja (task_templates vigentes). Fixture porque o
 * cadastro real chega com o backend; a FORMA é a congelada, incluindo
 * requires_photo e a faixa esperada que decide PASS/FAIL.
 */
export const FIXTURE_TASK_TEMPLATES: readonly FixtureTaskTemplate[] = [
  {
    templateId: 'tpl-camara-fria',
    title: 'Registrar temperatura da câmara fria',
    frequency: 'DAILY',
    requiresPhoto: false,
    expectedMin: -2,
    expectedMax: 4,
    targetPositionId: null,
    dueOffsetMinutes: 90,
  },
  {
    templateId: 'tpl-bancada',
    title: 'Higienizar bancada de manipulação',
    frequency: 'DAILY',
    requiresPhoto: true,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: null,
    dueOffsetMinutes: 240,
  },
  {
    templateId: 'tpl-vitrine',
    title: 'Conferir reposição da vitrine',
    frequency: 'DAILY',
    requiresPhoto: false,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: null,
    dueOffsetMinutes: 360,
  },
  {
    templateId: 'tpl-fechamento',
    title: 'Checar limpeza final do salão',
    frequency: 'DAILY',
    requiresPhoto: true,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: null,
    dueOffsetMinutes: 660,
  },
];

export interface FixtureTaskTemplate {
  readonly templateId: string;
  readonly title: string;
  readonly frequency: 'ONCE' | 'DAILY' | 'PER_SHIFT' | 'HOURLY' | 'CUSTOM';
  readonly requiresPhoto: boolean;
  readonly expectedMin: number | null;
  readonly expectedMax: number | null;
  readonly targetPositionId: string | null;
  readonly dueOffsetMinutes: number;
}

export interface IdentifiedOperator {
  readonly operator: FixtureOperator;
}

/**
 * Identificação de demonstração: compara o PIN em memória e o DESCARTA.
 * Mensagem não revela se o operador existe (enumeração — §8).
 */
export function identifyOperator(
  operatorEmployeeId: string,
  pin: string,
): IdentifiedOperator | null {
  if (!fixturesEnabled()) throw new FixturesDisabledError();
  const operator = FIXTURE_OPERATORS.find(
    (candidate) => candidate.employeeId === operatorEmployeeId,
  );
  if (operator === undefined || operator.pin !== pin) return null;
  return { operator };
}

/**
 * Fonte de definições de tarefa (TaskTemplateSourcePort) sobre as fixtures —
 * substituível pelo adapter real sem tocar aplicação nem UI.
 */
export class FixtureTaskTemplateSource {
  /** A loja é ignorada nas fixtures: há uma única loja de demonstração. */
  activeTemplates(): Promise<readonly FixtureTaskTemplate[]> {
    if (!fixturesEnabled()) throw new FixturesDisabledError();
    return Promise.resolve(FIXTURE_TASK_TEMPLATES);
  }
}
