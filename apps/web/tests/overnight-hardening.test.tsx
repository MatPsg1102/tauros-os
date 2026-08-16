// Overnight Hardening — regressões das correções P0/P1 da auditoria
// adversarial pré-piloto. Cada teste prova UM comportamento endurecido:
// contenção de autoria no unmount, UI nunca congela em busy, sync real ao
// reconectar, redefinição de PIN reabre acesso, virada do dia guarda o turno.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';
import { storeDayStartFor } from '@tauros/application';
import type { EffectiveAuthorization } from '@tauros/contracts';
import { PERMISSION_MODEL_VERSION } from '@tauros/contracts';

import OperacaoPage from '../src/app/operacao/page.js';
import { AppProviders } from '../src/app/providers.js';
import { APP_STATE_SCHEMA, MemoryEvidenceBlobStore } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FIXTURE_OPERATORS, FIXTURE_STORE } from '../src/wiring/fixtures.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { resetNavigations } from './setup-router.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 11:00 na loja; Equipe A escalada
const WORK_DATE = '2026-08-13';

let container: AppContainer;
let appStore: MemoryLocalStore;
let offlineStore: MemoryLocalStore;
let transport: FakeSessionSyncTransport;
let currentNow: Date;

function makeWorld(): void {
  currentNow = NOW;
  offlineStore = new MemoryLocalStore(OFFLINE_SCHEMA);
  appStore = new MemoryLocalStore(APP_STATE_SCHEMA);
  transport = new FakeSessionSyncTransport();
  container = buildContainer({
    clock: () => currentNow,
    deviceId: 'device-A',
    offlineStore,
    appStore,
    transport,
    deviceOnline: () => true,
    evidenceBlobs: new MemoryEvidenceBlobStore(),
    templates: { activeTemplates: () => Promise.resolve([]) },
  });
}

function app(): ReactElement {
  return (
    <AppProviders container={container}>
      <OperacaoPage />
    </AppProviders>
  );
}

function supervisorAuthorization(): EffectiveAuthorization {
  const elber = FIXTURE_OPERATORS.find((operator) => operator.permissions.includes('task.review'));
  if (elber === undefined) throw new Error('fixture de encarregado ausente');
  return {
    operatorProfileId: elber.profileId,
    operatorEmployeeId: elber.employeeId,
    storeId: FIXTURE_STORE.id,
    sessionId: `platform:${elber.profileId}`,
    permissions: elber.permissions,
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: undefined,
    validUntil: new Date(NOW.getTime() + 3_600_000),
    origin: 'online',
  };
}

async function seedMarinaWithTask(): Promise<void> {
  await container.reconcileFromQueue();
  await container.workforce.saveRegistration(
    {
      id: 'emp-0001',
      storeId: FIXTURE_STORE.id,
      registration: 'emp-0001',
      fullName: 'Marina Álvares',
      active: true,
      clientCreatedAt: NOW.toISOString(),
      idempotencyKey: 'seed:emp-0001',
      syncStatus: 'synced',
      auditCorrelationId: 'emp-0001',
    },
    {
      id: 'asg-emp-0001',
      storeId: FIXTURE_STORE.id,
      employeeId: 'emp-0001',
      teamId: 'team-a',
      operationalPositionId: 'pos-acougueiro-1',
      shiftDefinitionId: 'def-0730-1930',
      validFrom: '2026-08-01',
      validUntil: null,
    },
  );
  container.setAuthorization(supervisorAuthorization());
  const created = await container.createTaskTemplate.execute({
    authorization: supervisorAuthorization(),
    deviceId: 'device-A',
    storeTimeZone: FIXTURE_STORE.timeZone,
    title: 'Higienizar bancada',
    targetPositionId: 'pos-acougueiro-1',
    requiresPhoto: false,
    requiresReview: true,
    expectedMin: null,
    expectedMax: null,
    effectiveFrom: WORK_DATE,
    plannedStartMinutes: 8 * 60,
    dueOffsetMinutes: 18 * 60,
    recurrence: { kind: 'ONCE' },
    createdOffline: false,
  });
  if (created.kind === 'failed') throw new Error('template não criado');
  container.setAuthorization(null);
  const materialized = await container.loadDailyTasks.execute({
    authorization: supervisorAuthorization(),
    workDate: WORK_DATE,
    operationalDayStart: storeDayStartFor(currentNow, FIXTURE_STORE.timeZone),
    configVersionRef: null,
  });
  if (materialized.kind === 'failed') throw new Error('materialização falhou');
}

/** Identifica no diálogo do quadro (select + PIN + confirmar). */
async function identifyInDialog(name: string, pin: string): Promise<void> {
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('combobox'), {
    target: {
      value: (within(dialog).getByRole('option', { name }) as HTMLOptionElement).value,
    },
  });
  const cells = within(dialog).getAllByLabelText(/Dígito \d de 6/);
  pin.split('').forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
  fireEvent.click(within(dialog).getByRole('button', { name: /Confirmar/ }));
}

beforeEach(() => {
  makeWorld();
  resetNavigations();
  URL.createObjectURL = (() => 'blob:fake') as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('P0 — contenção de autoria', () => {
  it('desmontar o quadro com drawer identificado aberto DESCARTA a autorização do ator', async () => {
    await seedMarinaWithTask();
    const view = render(app());
    await screen.findAllByRole('heading', { name: 'Higienizar bancada' });

    // Marina assume e inicia; depois abre o drawer de finalização (ator retido)
    const heading = screen.getAllByRole('heading', {
      name: 'Higienizar bancada',
    })[0] as HTMLElement;
    const card = heading.closest('div[class]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Iniciar' }));
    await identifyInDialog('Marina Álvares', '224466');
    await screen.findByText('Tarefa iniciada.');
    const started = screen.getAllByRole('heading', {
      name: 'Higienizar bancada',
    })[0] as HTMLElement;
    const startedCard = started.closest('div[class]') as HTMLElement;
    fireEvent.click(within(startedCard).getByRole('button', { name: 'Finalizar' }));
    await identifyInDialog('Marina Álvares', '224466');
    await screen.findByRole('dialog', { name: /Higienizar bancada/ });

    // navegação abrupta: unmount com o drawer aberto
    view.unmount();

    // a autoria retida NÃO pode sobreviver: um enqueue posterior sem nova
    // identificação falha (o snapshot de autoria do container foi limpo)
    const result = await container.registerEmployee.execute({
      authorization: supervisorAuthorization(),
      deviceId: 'device-A',
      storeTimeZone: FIXTURE_STORE.timeZone,
      fullName: 'Teste Pós-Unmount',
      startDate: WORK_DATE,
      positionId: 'pos-acougueiro-2',
      teamId: 'team-a',
      shiftDefinitionId: null,
      createdOffline: true,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'ENQUEUE_FAILED' });
  });
});

describe('P1 — a UI nunca congela em busy', () => {
  it('exceção inesperada durante a ação devolve o diálogo com erro e cancelável', async () => {
    await seedMarinaWithTask();
    render(app());
    await screen.findAllByRole('heading', { name: 'Higienizar bancada' });

    // sabotagem: o use case de iniciar explode (ex.: IndexedDB morreu)
    const broken = container as { startDailyTask: { execute: () => Promise<never> } };
    broken.startDailyTask.execute = () => Promise.reject(new Error('boom'));

    const heading = screen.getAllByRole('heading', {
      name: 'Higienizar bancada',
    })[0] as HTMLElement;
    const card = heading.closest('div[class]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Iniciar' }));
    await identifyInDialog('Marina Álvares', '224466');

    // o diálogo volta com mensagem operacional e o Cancelar FUNCIONA
    await screen.findByText('Algo deu errado neste aparelho. Tente novamente.');
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

describe('P1 — reconexão sincroniza de verdade', () => {
  it("evento 'online' drena a fila (a promessa do banner é real)", async () => {
    await seedMarinaWithTask();
    const drained = vi.fn().mockResolvedValue(undefined);
    (container as { drainAndReflect: () => Promise<void> }).drainAndReflect = drained;
    render(app());
    await screen.findAllByRole('heading', { name: 'Higienizar bancada' });

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(drained).toHaveBeenCalled();
  });
});

describe('P1 — redefinir PIN reabre o acesso', () => {
  it('upsert de novo PIN + reset de lockout: o colaborador volta a se identificar', async () => {
    await seedMarinaWithTask();
    // credencial real para Marina; erra até travar o aparelho
    await container.credentials.upsert({
      storeId: FIXTURE_STORE.id,
      employeeId: 'emp-0001',
      pin: '111222',
      status: 'LOCAL_PENDING_PROVISIONING',
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await container.identity.verify({
        storeId: FIXTURE_STORE.id,
        employeeId: 'emp-0001',
        pin: '000000',
        deviceId: container.deviceId,
      });
    }
    const locked = await container.identity.verify({
      storeId: FIXTURE_STORE.id,
      employeeId: 'emp-0001',
      pin: '111222',
      deviceId: container.deviceId,
    });
    expect(locked).toMatchObject({ kind: 'rejected', code: 'LOCKED_OUT' });

    // gestão redefine o PIN (mesmo caminho da UI: upsert + reset do lockout)
    await container.credentials.upsert({
      storeId: FIXTURE_STORE.id,
      employeeId: 'emp-0001',
      pin: '333444',
      status: 'LOCAL_PENDING_PROVISIONING',
    });
    await container.lockouts.reset(FIXTURE_STORE.id, 'emp-0001', container.deviceId);

    const ok = await container.identity.verify({
      storeId: FIXTURE_STORE.id,
      employeeId: 'emp-0001',
      pin: '333444',
      deviceId: container.deviceId,
    });
    expect(ok.kind).toBe('verified');
  });
});

describe('P1 — regressão de estado no reload (ordem do reconcile)', () => {
  it('duas atribuições em sequência: após reload vale a ÚLTIMA', async () => {
    await seedMarinaWithTask();
    const auth = supervisorAuthorization();
    container.setAuthorization(auth);
    const tasks = await container.tasks.byWorkDate(FIXTURE_STORE.id, WORK_DATE);
    const task = tasks[0];
    if (task === undefined) throw new Error('tarefa ausente');

    const first = await container.assignDailyTask.execute({
      authorization: auth,
      deviceId: 'device-A',
      dailyTaskId: task.id,
      positionId: 'pos-acougueiro-2',
      assignedOffline: true,
    });
    expect(first.kind).toBe('assigned');
    const second = await container.assignDailyTask.execute({
      authorization: auth,
      deviceId: 'device-A',
      dailyTaskId: task.id,
      positionId: 'pos-auxiliar-acougue',
      assignedOffline: true,
    });
    expect(second.kind).toBe('assigned');

    // "reload": novo container sobre os MESMOS stores reconcilia pela fila
    const reloaded = buildContainer({
      clock: () => currentNow,
      deviceId: 'device-A',
      offlineStore,
      appStore,
      transport,
      deviceOnline: () => true,
      evidenceBlobs: new MemoryEvidenceBlobStore(),
      templates: { activeTemplates: () => Promise.resolve([]) },
    });
    await reloaded.reconcileFromQueue();
    const after = await reloaded.tasks.byId(task.id);
    expect(after?.assignedPositionId).toBe('pos-auxiliar-acougue');
    await reloaded.close();
  });
});
