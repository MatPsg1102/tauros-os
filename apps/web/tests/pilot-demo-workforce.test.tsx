// Bug de piloto (Vercel): card mostrava "Produção — Carlos Nunes" mas o
// domínio recusava INICIAR com "outra posição" — a UI lia o diretório
// fixture enquanto a elegibilidade lia employee_assignments do cadastro
// real, onde o time demo NÃO existia. Invariante restaurada na ORIGEM:
// ensureDemoWorkforce semeia o time demo como cadastro real (idempotente,
// nunca sobrescreve a loja). Estes testes provam o repro exato, a proteção
// de posição preservada e a semântica do seed.
//
// SEGUNDO bug de piloto, exposto APÓS o primeiro: destravada a elegibilidade,
// Carlos assumia e INICIAVA mas falhava ao FINALIZAR ("Não foi possível abrir
// seu turno para registrar a execução"). Registrar execução resolve/abre o
// PRÓPRIO turno, que exige session.open — e a fixture DEV do Carlos só tinha
// audit.read, divergindo do PilotBridgeAuthorizationSource (caminho de
// credencial real), que concede session.open + session.close. O buraco de
// cobertura era exatamente este: Carlos só era testado até INICIAR. A jornada
// fixture COMPLETA (iniciar → executar → finalizar) passa a ser coberta aqui.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CAPABILITY_CONFIG_WRITE,
  CAPABILITY_SESSION_CLOSE,
  CAPABILITY_SESSION_OPEN,
  CAPABILITY_TASK_REVIEW,
  CAPABILITY_WORKFORCE_WRITE,
  PERMISSION_MODEL_VERSION,
  type EffectiveAuthorization,
  type TaskExecutionRecord,
} from '@tauros/contracts';
import { currentAssignmentFor } from '@tauros/domain';
import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import OperacaoPage from '../src/app/operacao/page.js';
import { AppProviders } from '../src/app/providers.js';
import { APP_STATE_SCHEMA, MemoryEvidenceBlobStore } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FIXTURE_OPERATORS, FIXTURE_STORE, type FixtureOperator } from '../src/wiring/fixtures.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { resetNavigations } from './setup-router.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 11:00 na loja

let container: AppContainer;
let appStore: MemoryLocalStore;

function makeWorld(): void {
  appStore = new MemoryLocalStore(APP_STATE_SCHEMA);
  container = buildContainer({
    clock: () => NOW,
    deviceId: 'device-A',
    offlineStore: new MemoryLocalStore(OFFLINE_SCHEMA),
    appStore,
    transport: new FakeSessionSyncTransport(),
    deviceOnline: () => true,
    evidenceBlobs: new MemoryEvidenceBlobStore(),
  });
}

function app(): ReactElement {
  return (
    <AppProviders container={container}>
      <OperacaoPage />
    </AppProviders>
  );
}

// ADR-021: employeeId identifica (seleção), PIN verifica.
const OPERATOR_BY_PIN: Readonly<Record<string, string>> = {
  '123456': 'Elber',
  '224466': 'Marina Álvares',
  '113355': 'Carlos Nunes',
};

async function enterPinAndConfirm(pin: string): Promise<HTMLElement> {
  const dialog = await screen.findByRole('dialog');
  const name = OPERATOR_BY_PIN[pin];
  if (name !== undefined) {
    fireEvent.change(within(dialog).getByRole('combobox'), {
      target: {
        value: (within(dialog).getByRole('option', { name }) as HTMLOptionElement).value,
      },
    });
  }
  const cells = within(dialog).getAllByLabelText(/Dígito \d de 6/);
  pin.split('').forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
  fireEvent.click(within(dialog).getByRole('button', { name: /Confirmar/ }));
  return dialog;
}

async function openDay(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir o dia' }));
  await enterPinAndConfirm('123456'); // Elber abre o dia
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
}

async function findCard(title: string): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: title });
  return heading.closest('div[class]') as HTMLElement;
}

/** Autorização efêmera do encarregado — só para semear pela via oficial. */
function supervisorAuthorization(): EffectiveAuthorization {
  const elber = FIXTURE_OPERATORS.find((operator) =>
    operator.permissions.includes(CAPABILITY_TASK_REVIEW),
  );
  if (elber === undefined) throw new Error('fixture de encarregado ausente');
  return {
    operatorProfileId: elber.profileId,
    operatorEmployeeId: elber.employeeId,
    membershipId: elber.membershipId,
    storeId: FIXTURE_STORE.id,
    sessionId: `platform:${elber.profileId}`,
    permissions: elber.permissions,
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: undefined,
    validUntil: new Date(NOW.getTime() + 3_600_000),
    origin: 'online',
  };
}

/** Definição de Produção que EXIGE conferência (via oficial: config.write). */
async function seedProductionReviewTemplate(title: string): Promise<void> {
  const auth = supervisorAuthorization();
  container.setAuthorization(auth);
  const created = await container.createTaskTemplate.execute({
    authorization: auth,
    deviceId: 'device-A',
    storeTimeZone: FIXTURE_STORE.timeZone,
    title,
    targetPositionId: 'pos-producao',
    requiresPhoto: true,
    requiresReview: true,
    expectedMin: null,
    expectedMax: null,
    effectiveFrom: '2026-08-13',
    plannedStartMinutes: 8 * 60,
    dueOffsetMinutes: 20 * 60,
    recurrence: { kind: 'ONCE' },
    createdOffline: false,
  });
  if (created.kind === 'failed') throw new Error(`template não criado: ${created.code}`);
  container.setAuthorization(null);
}

function photo(name = 'bancada.jpg'): File {
  return new File([`conteudo-${name}`], name, { type: 'image/jpeg' });
}

/** Anexa e CONFIRMA a foto no drawer aberto (preview → "Usar foto"). */
async function attachPhoto(): Promise<void> {
  fireEvent.change(screen.getByLabelText('Adicionar foto'), { target: { files: [photo()] } });
  await screen.findByAltText('Pré-visualização da foto');
  fireEvent.click(screen.getByRole('button', { name: 'Usar foto' }));
  await screen.findByAltText('Evidência registrada');
}

/** Execuções persistidas da tarefa (append-only) — leitura direta do store. */
async function executionsOf(dailyTaskId: string): Promise<readonly TaskExecutionRecord[]> {
  const rows = await appStore.transaction(['task_executions'], 'read', (tx) =>
    tx.getAll('task_executions'),
  );
  return (rows as TaskExecutionRecord[]).filter(
    (execution) => execution.dailyTaskId === dailyTaskId,
  );
}

/** Turnos persistidos do ator — o registro de execução abre no máximo UM. */
async function sessionsOf(employeeId: string): Promise<readonly { actorEmployeeId: string }[]> {
  const rows = await appStore.transaction(['operator_sessions'], 'read', (tx) =>
    tx.getAll('operator_sessions'),
  );
  return (rows as { actorEmployeeId: string }[]).filter(
    (session) => session.actorEmployeeId === employeeId,
  );
}

async function taskByTitle(title: string) {
  const tasks = await container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-13');
  const task = tasks.find((record) => record.template.title === title);
  if (task === undefined) throw new Error(`tarefa não materializada: ${title}`);
  return task;
}

beforeEach(() => {
  makeWorld();
  resetNavigations();
  URL.createObjectURL = (() => 'blob:fake-preview') as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
});

afterEach(cleanup);

describe('Piloto — time demo é cadastro real (invariante UI × domínio)', () => {
  it('repro exato: tarefa de Produção mostra Carlos e Carlos INICIA com sucesso', async () => {
    render(app());
    await openDay();

    // a UI apresenta Carlos como ocupante da posição responsável…
    const card = await findCard('Higienizar bancada de manipulação');
    expect(within(card).getAllByText(/Carlos Nunes/).length).toBeGreaterThan(0);

    // …e o DOMÍNIO concorda: PIN válido → iniciar → sucesso (antes do fix:
    // NOT_ELIGIBLE "outra posição", pois emp-0002 não tinha vínculo real)
    fireEvent.click(within(card).getByRole('button', { name: 'Iniciar' }));
    await enterPinAndConfirm('113355');
    await screen.findByText('Tarefa iniciada.');
  });

  it('proteção preservada: Marina (Atendimento) segue NEGADA na tarefa de Produção', async () => {
    render(app());
    await openDay();

    const card = await findCard('Higienizar bancada de manipulação');
    fireEvent.click(within(card).getByRole('button', { name: 'Iniciar' }));
    const dialog = await enterPinAndConfirm('224466');

    // o erro é de ELEGIBILIDADE (pós-verificação do PIN), não de credencial
    await within(dialog).findByText('Esta tarefa é da responsabilidade de outra posição.');
    expect(screen.queryByText('Tarefa iniciada.')).toBeNull();
  });

  it('seed é idempotente e NUNCA compete com vínculo criado pela loja', async () => {
    await container.reconcileFromQueue();
    await container.reconcileFromQueue(); // segundo boot: nada duplica

    const assignments = await container.workforce.assignments(FIXTURE_STORE.id);
    expect(assignments.filter((a) => a.employeeId === 'emp-0002')).toHaveLength(1);

    // loja realoca Carlos (vigência mais nova) — novo boot não recoloca o
    // seed nem disputa: a regra única de vigência resolve a favor da loja
    await container.workforce.saveAssignment({
      id: 'asg-loja-carlos',
      storeId: FIXTURE_STORE.id,
      employeeId: 'emp-0002',
      teamId: 'team-a',
      operationalPositionId: 'pos-acougueiro-1',
      shiftDefinitionId: 'def-0730-1930',
      // vigente já na data do relógio do container (13/08) — o diretório
      // resolve "hoje" pelo clock, não por data futura
      validFrom: '2026-08-13',
      validUntil: null,
    });
    await container.reconcileFromQueue();

    const after = await container.workforce.assignments(FIXTURE_STORE.id);
    const carlos = after.filter((a) => a.employeeId === 'emp-0002');
    expect(carlos).toHaveLength(2);
    expect(currentAssignmentFor(carlos, 'emp-0002', '2026-08-24')?.operationalPositionId).toBe(
      'pos-acougueiro-1',
    );

    // a METADE DA UI da invariante: o diretório (nomes dos cards) enxerga a
    // realocação da loja — nunca a fixture congelada por cima do cadastro
    const members = await container.team.members(FIXTURE_STORE.id);
    expect(members.find((m) => m.employeeId === 'emp-0002')?.positionId).toBe('pos-acougueiro-1');

    const positions = await container.workforce.positions(FIXTURE_STORE.id);
    const ids = positions.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // posições nunca duplicam
  });

  it('aparelho que contornou o bug à mão: homônimo ativo da loja bloqueia o seed', async () => {
    // ANTES do primeiro boot pós-fix, a loja já tinha um "Carlos Nunes" real
    await container.workforce.saveRegistration(
      {
        id: 'emp-loja-0001',
        storeId: FIXTURE_STORE.id,
        registration: 'emp-loja-0001',
        fullName: 'Carlos Nunes',
        active: true,
        clientCreatedAt: NOW.toISOString(),
        idempotencyKey: `manual:${FIXTURE_STORE.id}:emp-loja-0001`,
        syncStatus: 'synced',
        auditCorrelationId: 'emp-loja-0001',
      },
      {
        id: 'asg-loja-0001',
        storeId: FIXTURE_STORE.id,
        employeeId: 'emp-loja-0001',
        teamId: 'team-a',
        operationalPositionId: 'pos-acougueiro-1',
        shiftDefinitionId: 'def-0730-1930',
        validFrom: '2026-08-10',
        validUntil: null,
      },
    );
    await container.reconcileFromQueue();

    const employees = await container.workforce.employees(FIXTURE_STORE.id);
    // o seed respeita o cadastro da loja: UM Carlos (o real), sem emp-0002
    expect(employees.filter((e) => e.fullName === 'Carlos Nunes')).toHaveLength(1);
    expect(employees.some((e) => e.id === 'emp-0002')).toBe(false);
    // os demais membros demo seguem semeados normalmente
    expect(employees.some((e) => e.fullName === 'Marina Álvares')).toBe(true);
    expect(employees.some((e) => e.fullName === 'Rita Belmonte')).toBe(true);
  });
});

describe('Piloto — jornada fixture COMPLETA do executor (iniciar → executar → finalizar)', () => {
  const BANCADA = 'Higienizar bancada de manipulação';

  /** Iniciar → Finalizar → foto confirmada: o drawer fica pronto para enviar. */
  async function executeUntilDrawer(title: string): Promise<void> {
    const card = await findCard(title);
    fireEvent.click(within(card).getByRole('button', { name: 'Iniciar' }));
    await enterPinAndConfirm('113355');
    await screen.findByText('Tarefa iniciada.');
    fireEvent.click(within(card).getByRole('button', { name: 'Finalizar' }));
    await enterPinAndConfirm('113355');
    await screen.findByRole('button', { name: 'Abrir câmera' });
    await attachPhoto();
  }

  it('repro do bug: Carlos inicia, anexa a foto obrigatória e FINALIZA com sucesso', async () => {
    render(app());
    await openDay();
    await executeUntilDrawer(BANCADA);

    fireEvent.click(screen.getByRole('button', { name: 'Concluir tarefa' }));
    // ANTES do fix: "Não foi possível abrir seu turno para registrar a execução."
    await screen.findByText('Tarefa concluída.');

    const task = await taskByTitle(BANCADA);
    expect(task.status).toBe('DONE');
    expect(task.lastExecutionId).not.toBeNull();
  });

  it('autoria, turno resolvido e evidência vinculada são do PRÓPRIO Carlos', async () => {
    render(app());
    await openDay();
    await executeUntilDrawer(BANCADA);
    fireEvent.click(screen.getByRole('button', { name: 'Concluir tarefa' }));
    await screen.findByText('Tarefa concluída.');

    const task = await taskByTitle(BANCADA);
    const executions = await executionsOf(task.id);
    expect(executions).toHaveLength(1);
    const execution = executions[0] as TaskExecutionRecord;

    // autoria operacional REAL (ADR-021) — nunca o encarregado que abriu o dia
    expect(execution.performedByEmployeeId).toBe('emp-0002');
    expect(task.startedByEmployeeId).toBe('emp-0002');

    // a OperatorSession foi de fato resolvida e é a do próprio Carlos, no dia
    const session = await container.sessions.findActive(FIXTURE_STORE.id, 'emp-0002');
    expect(session).not.toBeNull();
    expect(session?.id).toBe(execution.operatorSessionId);
    expect(session?.actorEmployeeId).toBe('emp-0002');
    expect(session?.operationalDate).toBe('2026-08-13');

    // evidência: capturada por Carlos e AMARRADA a esta execução
    const evidence = await container.evidence.byDailyTask(FIXTURE_STORE.id, task.id);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.capturedByEmployeeId).toBe('emp-0002');
    expect(evidence[0]?.executionId).toBe(execution.id);
    expect(execution.hasEvidence).toBe(true);
  });

  it('duplo toque em "Concluir tarefa" NÃO duplica execução nem turno', async () => {
    render(app());
    await openDay();
    await executeUntilDrawer(BANCADA);

    // dedo pesado no tablet: dois toques antes de qualquer await
    const concluir = screen.getByRole('button', { name: 'Concluir tarefa' });
    fireEvent.click(concluir);
    fireEvent.click(concluir);
    await screen.findByText('Tarefa concluída.');

    const task = await taskByTitle(BANCADA);
    expect(await executionsOf(task.id)).toHaveLength(1);
    expect(await sessionsOf('emp-0002')).toHaveLength(1);
  });
});

describe('Piloto — o mínimo operacional NÃO vira capability gerencial', () => {
  const CONFERIVEL = 'Sanitizar moedor (com conferência)';

  function carlos(): FixtureOperator {
    const operator = FIXTURE_OPERATORS.find((entry) => entry.employeeId === 'emp-0002');
    if (operator === undefined) throw new Error('fixture emp-0002 ausente');
    return operator;
  }

  it('a fixture do executor tem SÓ o mínimo operacional — nada de gestão', () => {
    const permissions = carlos().permissions;
    expect(permissions).toContain(CAPABILITY_SESSION_OPEN);
    expect(permissions).toContain(CAPABILITY_SESSION_CLOSE);
    expect(permissions).not.toContain(CAPABILITY_TASK_REVIEW);
    expect(permissions).not.toContain(CAPABILITY_CONFIG_WRITE);
    expect(permissions).not.toContain(CAPABILITY_WORKFORCE_WRITE);
  });

  it('todo EXECUTOR do piloto carrega o mesmo mínimo (caminho DEV == PilotBridge)', () => {
    // o encarregado é o único perfil gerencial; os demais são executores
    const executors = FIXTURE_OPERATORS.filter(
      (operator) => !operator.permissions.includes(CAPABILITY_TASK_REVIEW),
    );
    expect(executors.length).toBeGreaterThan(0);
    for (const executor of executors) {
      expect(executor.permissions).toContain(CAPABILITY_SESSION_OPEN);
      expect(executor.permissions).toContain(CAPABILITY_SESSION_CLOSE);
      expect(executor.permissions).not.toContain(CAPABILITY_CONFIG_WRITE);
      expect(executor.permissions).not.toContain(CAPABILITY_WORKFORCE_WRITE);
    }
  });

  it('Carlos executa, mas é NEGADO ao tentar conferir o próprio trabalho', async () => {
    await seedProductionReviewTemplate(CONFERIVEL);
    render(app());
    await openDay();

    const card = await findCard(CONFERIVEL);
    fireEvent.click(within(card).getByRole('button', { name: 'Iniciar' }));
    await enterPinAndConfirm('113355');
    await screen.findByText('Tarefa iniciada.');
    fireEvent.click(within(card).getByRole('button', { name: 'Finalizar' }));
    await enterPinAndConfirm('113355');
    await screen.findByRole('button', { name: 'Abrir câmera' });
    await attachPhoto();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para conferência' }));
    await screen.findByText('Execução enviada para conferência.');

    // finalizar NÃO deu poder de conferir: a capability é outra
    const awaiting = await findCard(CONFERIVEL);
    fireEvent.click(within(awaiting).getByRole('button', { name: 'Conferir' }));
    await enterPinAndConfirm('113355');
    // o PIN fecha e dá lugar ao drawer de conferência: identificar-se PROVA
    // quem é, nunca O QUE PODE — a recusa vem do use case, não da UI
    const aprovar = await screen.findByRole('button', { name: 'Aprovar' });
    fireEvent.click(aprovar);
    await screen.findByText('Seu perfil não permite conferir execuções.');

    // e a execução segue AGUARDANDO conferência — nada foi aprovado
    const task = await taskByTitle(CONFERIVEL);
    expect(task.status).toBe('AWAITING_REVIEW');
  });
});
