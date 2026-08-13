// FIXTURES DE DESENVOLVIMENTO (7.1 §8/§33) — identidade e loja fictícias
// para o vertical slice ANTES do backend real. NÃO É AUTENTICAÇÃO:
// nenhum segredo real, nenhuma falsa garantia. Bloqueadas em produção
// (guard explícito — impossíveis de ativar por acidente).

import {
  CAPABILITY_CONFIG_WRITE,
  CAPABILITY_SESSION_CLOSE,
  CAPABILITY_SESSION_OPEN,
} from '@tauros/contracts';

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
 * Operadores cobrindo os cenários reais de autorização: completo, sem
 * abertura, com abertura mas sem fechamento, e o ENCARREGADO — que também é
 * operador: abre o próprio turno (session.open) além das capacidades de
 * encarregado (config.write — capability oficial que governa task_templates
 * na RLS congelada). A autorização vem SEMPRE das permissões efetivas
 * (ADR-018), nunca de nome/cargo. O PIN é fixture de desenvolvimento:
 * comparado apenas em memória e descartado.
 */
export const FIXTURE_OPERATORS: readonly FixtureOperator[] = [
  {
    employeeId: 'emp-0001',
    profileId: 'prof-0001',
    membershipId: 'memb-0001',
    name: 'Marina Álvares',
    pin: '2468',
    permissions: [CAPABILITY_SESSION_OPEN, CAPABILITY_SESSION_CLOSE, 'audit.read'],
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
    permissions: [CAPABILITY_SESSION_OPEN, 'audit.read'],
  },
  {
    employeeId: 'emp-0004',
    profileId: 'prof-0004',
    membershipId: 'memb-0004',
    name: 'Elber',
    pin: '1234',
    permissions: [
      CAPABILITY_SESSION_OPEN,
      CAPABILITY_SESSION_CLOSE,
      CAPABILITY_CONFIG_WRITE,
      'audit.read',
    ],
  },
];

// ===== Equipe (workforce congelado: posições + atribuições vigentes) =====

export interface FixturePosition {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

export interface FixtureTeamMember {
  readonly employeeId: string;
  readonly fullName: string;
  readonly positionId: string | null;
}

/** Posições operacionais da loja (operational_positions). */
export const FIXTURE_POSITIONS: readonly FixturePosition[] = [
  { id: 'pos-atendimento', key: 'atendimento', name: 'Atendimento' },
  { id: 'pos-producao', key: 'producao', name: 'Produção' },
  { id: 'pos-apoio', key: 'apoio', name: 'Apoio' },
];

/**
 * Atribuições vigentes (employee_assignments). Elber (encarregado) não ocupa
 * posição atribuível — o modelo atribui tarefa a POSIÇÃO, e ele não aparece
 * como responsável automático.
 */
export const FIXTURE_TEAM: readonly FixtureTeamMember[] = [
  { employeeId: 'emp-0001', fullName: 'Marina Álvares', positionId: 'pos-atendimento' },
  { employeeId: 'emp-0002', fullName: 'Carlos Nunes', positionId: 'pos-producao' },
  { employeeId: 'emp-0003', fullName: 'Rita Belmonte', positionId: 'pos-apoio' },
];

/** Diretório de equipe (TeamDirectoryPort) sobre as fixtures. */
export class FixtureTeamDirectory {
  positions(): Promise<readonly FixturePosition[]> {
    if (!fixturesEnabled()) throw new FixturesDisabledError();
    return Promise.resolve(FIXTURE_POSITIONS);
  }

  members(): Promise<readonly FixtureTeamMember[]> {
    if (!fixturesEnabled()) throw new FixturesDisabledError();
    return Promise.resolve(FIXTURE_TEAM);
  }
}

/**
 * Definições de tarefa da loja (task_templates vigentes). Fixture porque o
 * cadastro real chega com o backend; a FORMA é a congelada, incluindo
 * requires_photo, a faixa esperada que decide PASS/FAIL e a posição
 * responsável. dueOffsetMinutes conta do INÍCIO DO DIA operacional da loja
 * (meia-noite civil) — ex.: 600 = 10:00.
 */
export const FIXTURE_TASK_TEMPLATES: readonly FixtureTaskTemplate[] = [
  {
    templateId: 'tpl-camara-fria',
    title: 'Registrar temperatura da câmara fria',
    frequency: 'DAILY',
    requiresPhoto: false,
    expectedMin: -2,
    expectedMax: 4,
    targetPositionId: 'pos-producao',
    dueOffsetMinutes: 600, // 10:00
  },
  {
    templateId: 'tpl-bancada',
    title: 'Higienizar bancada de manipulação',
    frequency: 'DAILY',
    requiresPhoto: true,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: 'pos-producao',
    dueOffsetMinutes: 840, // 14:00
  },
  {
    templateId: 'tpl-vitrine',
    title: 'Conferir reposição da vitrine',
    frequency: 'DAILY',
    requiresPhoto: false,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: 'pos-atendimento',
    dueOffsetMinutes: 960, // 16:00
  },
  {
    templateId: 'tpl-fechamento',
    title: 'Checar limpeza final do salão',
    frequency: 'DAILY',
    requiresPhoto: true,
    expectedMin: null,
    expectedMax: null,
    targetPositionId: 'pos-apoio',
    dueOffsetMinutes: 1140, // 19:00
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
