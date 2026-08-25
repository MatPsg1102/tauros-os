// FIXTURES DE DESENVOLVIMENTO (7.1 §8/§33) — identidade e loja fictícias
// para o vertical slice ANTES do backend real. NÃO É AUTENTICAÇÃO:
// nenhum segredo real, nenhuma falsa garantia. Bloqueadas em produção
// (guard explícito — impossíveis de ativar por acidente).

import {
  CAPABILITY_CONFIG_WRITE,
  CAPABILITY_SESSION_CLOSE,
  CAPABILITY_SESSION_OPEN,
  CAPABILITY_TASK_REVIEW,
  CAPABILITY_WORKFORCE_WRITE,
  PERMISSION_MODEL_VERSION,
  type EffectiveAuthorization,
  type EmployeeAssignmentRecord,
  type EmployeeRecord,
  type IdentityResult,
  type IdentityVerificationInput,
  type OperatorIdentityPort,
  type PinLockoutStorePort,
  type PinPolicyPort,
} from '@tauros/contracts';

import type { LocalWorkforceRepository } from './adapters.js';

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
  /**
   * Âncora da rotação de escala DA LOJA (stores.shift_anchor_date):
   * dia em que a equipe de offset 0 trabalha. Dado da loja — nunca regra.
   */
  readonly shiftAnchorDate: string;
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
  shiftAnchorDate: '2026-08-17',
};

/**
 * Operadores DEV do piloto. Todo EXECUTOR carrega o mesmo mínimo operacional
 * — session.open + session.close — porque concluir tarefa registra execução e
 * o registro resolve/abre o próprio turno. Este é exatamente o conjunto que o
 * PilotBridgeAuthorizationSource concede à credencial local real: o caminho
 * DEV e o caminho real NÃO podem divergir (a divergência fazia o executor
 * assumir e iniciar por elegibilidade e falhar só ao finalizar).
 *
 * O ENCARREGADO é também operador: soma ao mínimo as capacidades de gestão
 * (config.write — capability oficial que governa task_templates na RLS
 * congelada — workforce.write e task.review). Nenhum executor recebe
 * capability gerencial: conferir o próprio trabalho continua impossível.
 *
 * A autorização vem SEMPRE das permissões efetivas (ADR-018), nunca de
 * nome/cargo. O PIN é fixture de desenvolvimento: comparado apenas em
 * memória e descartado.
 */
export const FIXTURE_OPERATORS: readonly FixtureOperator[] = [
  {
    employeeId: 'emp-0001',
    profileId: 'prof-0001',
    membershipId: 'memb-0001',
    name: 'Marina Álvares',
    // PINs DEV de 6 dígitos = comprimento do Baseline (auth.pin.length). DEV:
    // comparados em memória, nunca persistidos, bloqueados em produção.
    pin: '224466',
    permissions: [CAPABILITY_SESSION_OPEN, CAPABILITY_SESSION_CLOSE, 'audit.read'],
  },
  {
    employeeId: 'emp-0002',
    profileId: 'prof-0002',
    membershipId: 'memb-0002',
    name: 'Carlos Nunes',
    pin: '113355',
    // mínimo operacional do piloto: executar tarefa registra execução, e o
    // registro resolve/abre o PRÓPRIO turno (session.open/close). Mesmo
    // conjunto que o PilotBridgeAuthorizationSource concede à credencial
    // local real — o caminho DEV não pode divergir dele. NENHUMA capability
    // gerencial: conferência/configuração seguem só com o encarregado.
    permissions: [CAPABILITY_SESSION_OPEN, CAPABILITY_SESSION_CLOSE, 'audit.read'],
  },
  {
    employeeId: 'emp-0003',
    profileId: 'prof-0003',
    membershipId: 'memb-0003',
    name: 'Rita Belmonte',
    pin: '997755',
    // mesmo mínimo operacional dos demais executores (ver emp-0002)
    permissions: [CAPABILITY_SESSION_OPEN, CAPABILITY_SESSION_CLOSE, 'audit.read'],
  },
  {
    employeeId: 'emp-0004',
    profileId: 'prof-0004',
    membershipId: 'memb-0004',
    name: 'Elber',
    pin: '123456',
    permissions: [
      CAPABILITY_SESSION_OPEN,
      CAPABILITY_SESSION_CLOSE,
      CAPABILITY_CONFIG_WRITE,
      CAPABILITY_WORKFORCE_WRITE,
      CAPABILITY_TASK_REVIEW,
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
  /** Equipe da escala (teams do baseline) — vínculo demo COMPLETO. */
  readonly teamId: string | null;
  /** Jornada declarada (shift_definitions do baseline). */
  readonly shiftDefinitionId: string | null;
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
 * como responsável automático. Equipes alternadas (12x36 A/B do baseline):
 * em qualquer data alguém do time demo está escalado.
 */
export const FIXTURE_TEAM: readonly FixtureTeamMember[] = [
  {
    employeeId: 'emp-0001',
    fullName: 'Marina Álvares',
    positionId: 'pos-atendimento',
    teamId: 'team-a',
    shiftDefinitionId: 'def-0730-1930',
  },
  {
    employeeId: 'emp-0002',
    fullName: 'Carlos Nunes',
    positionId: 'pos-producao',
    teamId: 'team-b',
    shiftDefinitionId: 'def-0830-2030',
  },
  {
    employeeId: 'emp-0003',
    fullName: 'Rita Belmonte',
    positionId: 'pos-apoio',
    teamId: 'team-a',
    shiftDefinitionId: 'def-0730-1930',
  },
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

// Época dos dados demo — ANTERIOR a qualquer vigência criada pela loja ou
// por teste: quem cadastrar/realocar depois vence pela regra única de
// vigência (currentAssignmentFor), sem o seed competir.
const DEMO_EPOCH_DATE = '2026-07-01';
const DEMO_EPOCH_AT = '2026-07-01T00:00:00.000Z';

/**
 * INVARIANTE DO PILOTO: quem a UI apresenta como responsável precisa ser
 * elegível no DOMÍNIO. Elegibilidade (claim/start) lê employee_assignments do
 * cadastro REAL (workforce) — nunca este diretório fixture. Portanto o time
 * demo é SEMEADO como cadastro real (posições + pessoas + vínculos com
 * vigência), idempotente e sem sobrescrever nada criado pela loja: fixtures
 * obedecem às MESMAS invariantes da operação real. Roda no boot (composition
 * root), somente com fixtures habilitadas; como o baseline, não nasce da fila.
 */
export async function ensureDemoWorkforce(
  workforce: LocalWorkforceRepository,
  storeId: string,
): Promise<void> {
  if (!fixturesEnabled()) return;
  const [employees, assignments, positions] = await Promise.all([
    workforce.employees(storeId),
    workforce.assignments(storeId),
    workforce.positions(storeId),
  ]);

  const positionIds = new Set(positions.map((position) => position.id));
  for (const position of FIXTURE_POSITIONS) {
    if (positionIds.has(position.id)) continue;
    await workforce.savePosition({
      id: position.id,
      storeId,
      key: position.key,
      name: position.name,
      clientCreatedAt: DEMO_EPOCH_AT,
      idempotencyKey: `position-fixture:${storeId}:${position.key}`,
      syncStatus: 'synced',
      auditCorrelationId: position.id,
    });
  }

  const employeeIds = new Set(employees.map((employee) => employee.id));
  const assignedEmployeeIds = new Set(assignments.map((assignment) => assignment.employeeId));
  // aparelho que CONTORNOU o bug pré-fix cadastrando o homônimo à mão: o
  // cadastro da loja vale; o seed não cria um segundo (não há inativação na
  // gestão — um duplicado seria permanente). Regra geral por nome ativo.
  const activeNames = new Set(
    employees
      .filter((employee) => employee.active)
      .map((employee) => employee.fullName.trim().toLocaleLowerCase('pt-BR')),
  );
  for (const member of FIXTURE_TEAM) {
    if (member.positionId === null) continue;
    const hasEmployee = employeeIds.has(member.employeeId);
    const hasAssignment = assignedEmployeeIds.has(member.employeeId);
    if (!hasEmployee && activeNames.has(member.fullName.trim().toLocaleLowerCase('pt-BR'))) {
      continue;
    }
    // vínculo criado/alterado pela loja NUNCA é tocado (vigência mais nova
    // vence pela regra única currentAssignmentFor — o seed não compete)
    if (hasAssignment) continue;
    const employee: EmployeeRecord = {
      id: member.employeeId,
      storeId,
      registration: member.employeeId,
      fullName: member.fullName,
      active: true,
      clientCreatedAt: DEMO_EPOCH_AT,
      idempotencyKey: `employee-fixture:${storeId}:${member.employeeId}`,
      syncStatus: 'synced',
      auditCorrelationId: member.employeeId,
    };
    const assignment: EmployeeAssignmentRecord = {
      id: `assign-fixture-${member.employeeId}`,
      storeId,
      employeeId: member.employeeId,
      teamId: member.teamId,
      operationalPositionId: member.positionId,
      shiftDefinitionId: member.shiftDefinitionId,
      validFrom: DEMO_EPOCH_DATE,
      validUntil: null,
    };
    if (hasEmployee) await workforce.saveAssignment(assignment);
    else await workforce.saveRegistration(employee, assignment);
  }
}

// A antiga FixtureShiftSchedule ("dia ímpar escalado") foi APOSENTADA na
// Recorrência V1: o veredito "posição escalada?" agora vem do resolver real
// da Escala Operacional (PlannedScheduleAdapter no wiring) — exatamente a
// substituição prevista quando ela foi criada. Nenhum teste depende mais dela.

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

// A identificação DEV agora acontece SOMENTE via FixtureOperatorIdentity (o
// mesmo OperatorIdentityPort dos adapters reais). As antigas funções
// identifyOperator/identifyByPin — importadas direto pelos controllers — foram
// removidas na Fase 4B: nenhum controller conhece mais a origem da identidade.

/**
 * Roster de identidades DEV para a lista de seleção (nome + employeeId), sem
 * expor PIN nem permissões. Vazio quando as fixtures estão desabilitadas —
 * em produção a seleção mostra apenas colaboradores reais cadastrados.
 */
export function fixtureOperatorRoster(): readonly { employeeId: string; name: string }[] {
  if (!fixturesEnabled()) return [];
  return FIXTURE_OPERATORS.map((operator) => ({
    employeeId: operator.employeeId,
    name: operator.name,
  }));
}

/** Dependências do adapter de identidade DEV (relógio + janela + conectividade). */
export interface FixtureIdentityDeps {
  readonly now: () => Date;
  readonly offlineValidityMs: () => Promise<number>;
  readonly online: () => Promise<boolean>;
  /**
   * Lockout OBRIGATÓRIO também para identidades DEV: o encarregado do piloto
   * usa uma fixture com capacidades de gestão — sem escada, o PIN dela seria
   * força-brutável no tablet compartilhado. Mesmos stores/política do adapter
   * real (employee×device).
   */
  readonly lockouts: PinLockoutStorePort;
  readonly policy: PinPolicyPort;
}

/**
 * Adapter de identidade de DESENVOLVIMENTO que obedece ao MESMO
 * OperatorIdentityPort do adapter real (ADR-021 §11): os controllers futuros
 * não precisarão saber se a identidade veio de fixture, credencial local ou
 * backend. Compara o PIN da fixture EM MEMÓRIA (DEV — sem verifier persistido)
 * e o descarta. Bloqueado em produção pelo mesmo guard das fixtures.
 */
export class FixtureOperatorIdentity implements OperatorIdentityPort {
  constructor(private readonly deps: FixtureIdentityDeps) {}

  async verify(input: IdentityVerificationInput): Promise<IdentityResult> {
    if (!fixturesEnabled()) throw new FixturesDisabledError();
    const policy = await this.deps.policy.resolve(input.storeId);
    const nowMs = this.deps.now().getTime();

    // mesma escada de lockout do adapter real (Baseline §3)
    const lock = await this.deps.lockouts.get(input.storeId, input.employeeId, input.deviceId);
    if (lock?.lockedUntil != null) {
      const until = new Date(lock.lockedUntil).getTime();
      if (until > nowMs) {
        return { kind: 'rejected', code: 'LOCKED_OUT', retryAfterMs: until - nowMs };
      }
    }

    const operator = FIXTURE_OPERATORS.find(
      (candidate) => candidate.employeeId === input.employeeId,
    );
    // mensagem neutra: não revela se o funcionário/credencial existe (§8)
    if (operator === undefined || operator.pin !== input.pin) {
      const state = await this.deps.lockouts.registerFailure(
        input.storeId,
        input.employeeId,
        input.deviceId,
        policy,
      );
      // MESMA escada do adapter real, degrau a degrau (inclusive hard reauth)
      if (state.totalFailures >= policy.hardReauthAfter) {
        return { kind: 'rejected', code: 'REAUTH_REQUIRED' };
      }
      if (state.lockedUntil != null) {
        const retry = new Date(state.lockedUntil).getTime() - nowMs;
        return { kind: 'rejected', code: 'LOCKED_OUT', retryAfterMs: Math.max(0, retry) };
      }
      return { kind: 'rejected', code: 'INVALID_PIN' };
    }
    await this.deps.lockouts.reset(input.storeId, input.employeeId, input.deviceId);
    const online = await this.deps.online();
    const validityMs = await this.deps.offlineValidityMs();
    const now = this.deps.now();
    const authorization: EffectiveAuthorization = {
      operatorEmployeeId: operator.employeeId,
      operatorProfileId: operator.profileId,
      membershipId: operator.membershipId,
      storeId: input.storeId,
      // identidade PRÓPRIA da sessão — nunca platform:<profileId> (ADR-021 §10)
      sessionId: `fixture-identity:${input.storeId}:${operator.employeeId}`,
      permissions: operator.permissions,
      permissionModelVersion: PERMISSION_MODEL_VERSION,
      configVersionRef: undefined,
      validUntil: new Date(now.getTime() + validityMs),
      origin: online ? 'online' : 'offline-snapshot',
    };
    return { kind: 'verified', authorization };
  }
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
