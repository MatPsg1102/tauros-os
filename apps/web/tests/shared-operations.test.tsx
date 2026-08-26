// Operação Compartilhada V1 — jornada vertical da OPERAÇÃO DE HOJE com
// container REAL em memória. Cobre os fluxos obrigatórios: A (tarefa simples
// assumir→iniciar→concluir→reload), B (foto+review: bloqueio sem foto →
// evidência → conferência → aprovar), C (devolução→correção→reenvio→
// aprovação), D (segurança: operador comum não confere; executor não
// confere o próprio trabalho) e E' (PIN nunca persistido; evidência
// sobrevive reload). A identidade JIT usa as fixtures oficiais; o vínculo
// dos operadores no workforce é semeado pelo teste (pendência de identidade
// real registrada).

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';
import type { EffectiveAuthorization } from '@tauros/contracts';
import { PERMISSION_MODEL_VERSION } from '@tauros/contracts';

import OperacaoPage from '../src/app/operacao/page.js';
import { AppProviders } from '../src/app/providers.js';
import { APP_STATE_SCHEMA, MemoryEvidenceBlobStore } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FIXTURE_OPERATORS, FIXTURE_STORE } from '../src/wiring/fixtures.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { resetNavigations } from './setup-router.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 13/08: Equipe A escalada

interface World {
  container: AppContainer;
  transport: FakeSessionSyncTransport;
  online: boolean;
  offlineStore: MemoryLocalStore;
  appStore: MemoryLocalStore;
  blobs: MemoryEvidenceBlobStore;
}

let world: World;

function makeWorld(
  previous?: Pick<World, 'offlineStore' | 'appStore' | 'transport' | 'blobs'>,
): World {
  const transport = previous?.transport ?? new FakeSessionSyncTransport();
  const offlineStore = previous?.offlineStore ?? new MemoryLocalStore(OFFLINE_SCHEMA);
  const appStore = previous?.appStore ?? new MemoryLocalStore(APP_STATE_SCHEMA);
  const blobs = previous?.blobs ?? new MemoryEvidenceBlobStore();
  const w: World = {
    transport,
    online: true,
    offlineStore,
    appStore,
    blobs,
    container: undefined as unknown as AppContainer,
  };
  w.container = buildContainer({
    clock: () => NOW,
    deviceId: 'device-A',
    offlineStore,
    appStore,
    transport,
    deviceOnline: () => w.online,
    evidenceBlobs: blobs,
  });
  return w;
}

function app(): ReactElement {
  return (
    <AppProviders container={world.container}>
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

/**
 * Semeia o VÍNCULO dos operadores fixture no workforce local (Marina =
 * Açougueiro 1/Equipe A — escalada em 13/08; Rita = Açougueiro 2/Equipe A).
 * Ponte de desenvolvimento até a identidade real unificar PIN ↔ cadastro
 * (pendência pré-piloto registrada no relatório).
 */
async function seedFixtureWorkforceLinks(): Promise<void> {
  await world.container.reconcileFromQueue(); // baseline de equipes/posições
  const seed = [
    { employeeId: 'emp-0001', name: 'Marina Álvares', positionId: 'pos-acougueiro-1' },
    { employeeId: 'emp-0003', name: 'Rita Belmonte', positionId: 'pos-acougueiro-2' },
  ];
  for (const member of seed) {
    await world.container.workforce.saveRegistration(
      {
        id: member.employeeId,
        storeId: FIXTURE_STORE.id,
        registration: member.employeeId,
        fullName: member.name,
        active: true,
        clientCreatedAt: NOW.toISOString(),
        idempotencyKey: `seed:${member.employeeId}`,
        syncStatus: 'synced',
        auditCorrelationId: member.employeeId,
      },
      {
        id: `asg-${member.employeeId}`,
        storeId: FIXTURE_STORE.id,
        employeeId: member.employeeId,
        teamId: 'team-a',
        operationalPositionId: member.positionId,
        shiftDefinitionId: 'def-0730-1930',
        validFrom: '2026-08-01',
        validUntil: null,
      },
    );
  }
}

/** Cria uma definição de tarefa pela via oficial (config.write do Elber). */
async function seedTemplate(input: {
  title: string;
  positionId: string | null;
  requiresPhoto: boolean;
  requiresReview: boolean;
}): Promise<void> {
  // autorização efêmera só para o seed (o adapter da fila captura snapshot)
  world.container.setAuthorization(supervisorAuthorization());
  const created = await world.container.createTaskTemplate.execute({
    authorization: supervisorAuthorization(),
    deviceId: 'device-A',
    storeTimeZone: FIXTURE_STORE.timeZone,
    title: input.title,
    targetPositionId: input.positionId,
    requiresPhoto: input.requiresPhoto,
    requiresReview: input.requiresReview,
    expectedMin: null,
    expectedMax: null,
    effectiveFrom: '2026-08-13',
    plannedStartMinutes: 8 * 60,
    dueOffsetMinutes: 20 * 60,
    recurrence: { kind: 'ONCE' },
    createdOffline: false,
  });
  if (created.kind === 'failed') throw new Error(`template não criado: ${created.code}`);
  world.container.setAuthorization(null);
}

async function openDay(): Promise<void> {
  // sem templates de fixture: o dia abre com as definições reais criadas
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir o dia' }));
  await enterPinAndConfirm('123456'); // Elber abre o dia
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
}

// Mapa DEV pin→colaborador: na Operação Compartilhada o ator SELECIONA quem é
// e prova o PIN daquele employeeId (ADR-021: employeeId identifica, PIN verifica).
const OPERATOR_BY_PIN: Readonly<Record<string, string>> = {
  '123456': 'Elber',
  '224466': 'Marina Álvares',
  '997755': 'Rita Belmonte',
  '113355': 'Carlos Nunes',
};

async function enterPinAndConfirm(pin: string): Promise<void> {
  const dialog = await screen.findByRole('dialog');
  const name = OPERATOR_BY_PIN[pin];
  if (name !== undefined) {
    // V2 glove-first: a identidade é um RadioGroup (alvos 64px), não Select
    fireEvent.click(within(dialog).getByRole('radio', { name }));
  }
  const cells = within(dialog).getAllByLabelText(/Dígito \d de 6/);
  pin.split('').forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
  fireEvent.click(within(dialog).getByRole('button', { name: /Confirmar/ }));
}

async function actOnCard(title: string, action: string, pin: string): Promise<void> {
  const heading = await screen.findByRole('heading', { name: title });
  const card = heading.closest('article') as HTMLElement;
  fireEvent.click(within(card).getByRole('button', { name: action }));
  await enterPinAndConfirm(pin);
}

/** Drawer contextual da tarefa (nome acessível = título) após o PIN. */
async function findTaskDialog(title: string): Promise<HTMLElement> {
  return await screen.findByRole('dialog', { name: new RegExp(title) });
}

function attachPhoto(): void {
  // Foto V1.1: seleção abre PREVIEW; só "Usar foto" persiste a evidência
  const input = screen.getByLabelText('Adicionar foto') as HTMLInputElement;
  const file = new File(['foto-da-serra'], 'serra.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Usar foto' }));
}

beforeEach(() => {
  world = makeWorld();
  resetNavigations();
  // jsdom não implementa object URLs — stub estável para renderizar <img>
  URL.createObjectURL = (() => 'blob:fake-evidence') as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
});

describe('FLUXO A — tarefa simples no quadro compartilhado', () => {
  it('assumir → iniciar → concluir sem review; reload preserva; sem PIN persistido', async () => {
    await seedFixtureWorkforceLinks();
    await seedTemplate({
      title: 'Reposição da ilha',
      positionId: null,
      requiresPhoto: false,
      requiresReview: false,
    });
    const first = render(app());
    await openDay();

    // sem responsável → ASSUMIR com PIN da Marina (escalada hoje). O texto
    // existe no card E na sidebar de triagem (V1.1) — basta aguardar ambos.
    await screen.findAllByText('Sem responsável');
    await actOnCard('Reposição da ilha', 'Assumir', '224466');
    await screen.findByText('Tarefa assumida.');
    expect(screen.getAllByText(/Açougueiro 1/).length).toBeGreaterThan(0);

    await actOnCard('Reposição da ilha', 'Iniciar', '224466');
    await screen.findByText('Tarefa iniciada.');
    expect(screen.getAllByText('Em execução').length).toBeGreaterThan(0);
    expect(screen.getByText(/Iniciada 11:00/)).toBeTruthy();

    // finalizar SEM review → concluída direto (sem gargalo de encarregado)
    await actOnCard('Reposição da ilha', 'Finalizar', '224466');
    const drawer = await findTaskDialog('Reposição da ilha');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Concluir tarefa' }));
    await screen.findByText('Tarefa concluída.');
    fireEvent.click(screen.getByRole('radio', { name: 'Concluídas' }));
    await screen.findByRole('heading', { name: 'Reposição da ilha' });

    // autoria real registrada (não só na UI)
    const tasks = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-13');
    const done = tasks.find((task) => task.template.title === 'Reposição da ilha');
    expect(done?.status).toBe('DONE');
    expect(done?.startedByEmployeeId).toBe('emp-0001');

    // a credencial JIT foi DESCARTADA: nenhum enfileiramento posterior herda
    // a autorização da Marina — o adapter da fila exige identificação nova
    const leaked = await world.container.createTaskTemplate.execute({
      authorization: supervisorAuthorization(),
      deviceId: 'device-A',
      storeTimeZone: FIXTURE_STORE.timeZone,
      title: 'Prova de credencial residual',
      targetPositionId: null,
      requiresPhoto: false,
      requiresReview: false,
      expectedMin: null,
      expectedMax: null,
      effectiveFrom: '2026-08-13',
      plannedStartMinutes: 8 * 60,
      dueOffsetMinutes: 20 * 60,
      recurrence: { kind: 'ONCE' },
      createdOffline: false,
    });
    expect(leaked).toMatchObject({ kind: 'failed', code: 'ENQUEUE_FAILED' });
    const execution = await world.container.tasks.executionById(done?.lastExecutionId ?? '');
    expect(execution?.performedByEmployeeId).toBe('emp-0001');
    expect(execution?.startedAt).toBe(NOW.toISOString());

    // reload preserva
    first.unmount();
    world = makeWorld(world);
    render(app());
    fireEvent.click(await screen.findByRole('radio', { name: 'Concluídas' }));
    await screen.findByRole('heading', { name: 'Reposição da ilha' });

    // PIN nunca persistido em fila/auditoria/storage/localStorage
    const dump: unknown[] = [];
    for (const [schema, store] of [
      [OFFLINE_SCHEMA, world.offlineStore],
      [APP_STATE_SCHEMA, world.appStore],
    ] as const) {
      for (const name of schema.migrations.flatMap((m) => m.stores.map((s) => s.name))) {
        dump.push(...(await store.transaction([name], 'read', (tx) => tx.getAll(name))));
      }
    }
    const serialized = JSON.stringify(dump);
    expect(serialized.includes('"2468"')).toBe(false);
    expect(serialized.includes('"1234"')).toBe(false);
    expect(serialized.toLowerCase().includes('pin')).toBe(false);
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('224466');
  });
});

describe('FLUXO B — foto obrigatória + conferência', () => {
  async function submitSerraWithPhoto(): Promise<void> {
    await actOnCard('Limpeza da serra', 'Iniciar', '224466');
    await screen.findByText('Tarefa iniciada.');
    await actOnCard('Limpeza da serra', 'Finalizar', '224466');
    const drawer = await findTaskDialog('Limpeza da serra');
    // tenta enviar SEM foto → bloqueado com mensagem operacional
    fireEvent.click(within(drawer).getByRole('button', { name: 'Enviar para conferência' }));
    await screen.findByText('Adicione a foto solicitada antes de enviar para conferência.');
    attachPhoto();
    await screen.findByAltText('Evidência registrada');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Enviar para conferência' }));
    await screen.findByText('Execução enviada para conferência.');
  }

  it('bloqueia sem foto, envia com evidência, encarregado confere e aprova; evidência sobrevive reload', async () => {
    await seedFixtureWorkforceLinks();
    await seedTemplate({
      title: 'Limpeza da serra',
      positionId: 'pos-acougueiro-1',
      requiresPhoto: true,
      requiresReview: true,
    });
    const first = render(app());
    await openDay();
    await submitSerraWithPhoto();

    // concluir ≠ aprovar: aguarda conferência, não concluída
    expect(screen.getAllByText('Aguardando conferência').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('radio', { name: 'Concluídas' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Limpeza da serra' })).toBeNull();
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Conferir' }));
    await screen.findByRole('heading', { name: 'Limpeza da serra' });

    // reload ANTES da conferência: evidência não desaparece
    first.unmount();
    world = makeWorld(world);
    render(app());
    fireEvent.click(await screen.findByRole('radio', { name: 'Conferir' }));
    await screen.findByRole('heading', { name: 'Limpeza da serra' });
    expect(screen.getByText(/📷 1 evidência/)).toBeTruthy();

    // conferência do encarregado (PIN Elber) com evidência visível
    await actOnCard('Limpeza da serra', 'Conferir', '123456');
    const review = await findTaskDialog('Limpeza da serra');
    // V2: rótulo e valor em linhas separadas (fatos escaneáveis da decisão)
    expect(within(review).getByText('Executor')).toBeTruthy();
    expect(within(review).getByText('Marina Álvares')).toBeTruthy();
    expect(within(review).getByAltText('Evidência da execução')).toBeTruthy();
    fireEvent.click(within(review).getByRole('button', { name: 'Aprovar' }));
    await screen.findByText('Execução aprovada.');
    fireEvent.click(screen.getByRole('radio', { name: 'Concluídas' }));
    await screen.findByRole('heading', { name: 'Limpeza da serra' });

    // reviewer registrado no modelo (não só na tela)
    const tasks = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-13');
    const serra = tasks.find((task) => task.template.title === 'Limpeza da serra');
    const execution = await world.container.tasks.executionById(serra?.lastExecutionId ?? '');
    expect(execution?.review).toMatchObject({
      outcome: 'APPROVED',
      reviewedByEmployeeId: 'emp-0004',
    });
  });

  it('FLUXO C — devolução com motivo, correção preservando histórico e aprovação final', async () => {
    await seedFixtureWorkforceLinks();
    await seedTemplate({
      title: 'Limpeza da serra',
      positionId: 'pos-acougueiro-1',
      requiresPhoto: true,
      requiresReview: true,
    });
    render(app());
    await openDay();
    await submitSerraWithPhoto();

    // encarregado devolve com motivo obrigatório
    await actOnCard('Limpeza da serra', 'Conferir', '123456');
    const review = await findTaskDialog('Limpeza da serra');
    fireEvent.click(within(review).getByRole('button', { name: 'Devolver para correção' }));
    await within(review).findByText('Informe o motivo da devolução.');
    fireEvent.change(
      within(review).getByLabelText('Motivo da devolução (obrigatório ao devolver)'),
      { target: { value: 'Limpar novamente a parte inferior do equipamento.' } },
    );
    fireEvent.click(within(review).getByRole('button', { name: 'Devolver para correção' }));
    await screen.findByText('Devolvida para correção.');

    // card mostra CORREÇÃO NECESSÁRIA com o motivo
    await screen.findByText('Correção necessária');
    expect(screen.getByText('Limpar novamente a parte inferior do equipamento.')).toBeTruthy();

    // operador corrige: retomar → nova foto → reenviar
    await actOnCard('Limpeza da serra', 'Corrigir', '224466');
    await screen.findByText('Tarefa iniciada.');
    await actOnCard('Limpeza da serra', 'Finalizar', '224466');
    const resubmit = await findTaskDialog('Limpeza da serra');
    attachPhoto();
    // ESCOPO honesto (hardening): o drawer de reenvio mostra SÓ a foto NOVA
    // pendente do ator — a da rodada devolvida pertence à execução anterior
    // (não conta para requiresPhoto e não deve enganar quem envia)
    await waitFor(() => {
      expect(within(resubmit).getAllByAltText('Evidência registrada').length).toBe(1);
    });
    fireEvent.click(within(resubmit).getByRole('button', { name: 'Enviar para conferência' }));
    await screen.findByText('Execução enviada para conferência.');

    // histórico preservado: DUAS execuções encadeadas + evidências mantidas
    const tasks = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-13');
    const serra = tasks.find((task) => task.template.title === 'Limpeza da serra');
    const second = await world.container.tasks.executionById(serra?.lastExecutionId ?? '');
    expect(second?.supersedesExecutionId).not.toBeNull();
    const firstExecution = await world.container.tasks.executionById(
      second?.supersedesExecutionId ?? '',
    );
    expect(firstExecution?.review).toMatchObject({ outcome: 'RETURNED' });
    const evidence = await world.container.evidence.byDailyTask(FIXTURE_STORE.id, serra?.id ?? '');
    expect(evidence.length).toBe(2);

    // aprovação final — e o MOTIVO da devolução anterior NÃO vazou p/ cá
    await actOnCard('Limpeza da serra', 'Conferir', '123456');
    const finalReview = await findTaskDialog('Limpeza da serra');
    expect(
      (
        within(finalReview).getByLabelText(
          'Motivo da devolução (obrigatório ao devolver)',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('');
    fireEvent.click(within(finalReview).getByRole('button', { name: 'Aprovar' }));
    await screen.findByText('Execução aprovada.');
  });
});

describe('FLUXO D — segurança da conferência', () => {
  it('operador comum não confere; executor não confere o próprio trabalho; a11y da Home', async () => {
    await seedFixtureWorkforceLinks();
    await seedTemplate({
      title: 'Limpeza da serra',
      positionId: 'pos-acougueiro-1',
      requiresPhoto: false,
      requiresReview: true,
    });
    const { container } = render(app());
    await openDay();
    await actOnCard('Limpeza da serra', 'Iniciar', '224466');
    await screen.findByText('Tarefa iniciada.');
    await actOnCard('Limpeza da serra', 'Finalizar', '224466');
    const drawer = await findTaskDialog('Limpeza da serra');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Enviar para conferência' }));
    await screen.findByText('Execução enviada para conferência.');

    // Marina (executora, SEM task.review) tenta conferir → negada no PIN JIT
    await actOnCard('Limpeza da serra', 'Conferir', '224466');
    const detail = await findTaskDialog('Limpeza da serra');
    fireEvent.click(within(detail).getByRole('button', { name: 'Aprovar' }));
    await within(detail).findByText('Seu perfil não permite conferir execuções.');
    fireEvent.keyDown(detail, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    // e a tarefa segue aguardando conferência (nada mudou)
    const tasks = await world.container.tasks.byWorkDate(FIXTURE_STORE.id, '2026-08-13');
    const serra = tasks.find((task) => task.template.title === 'Limpeza da serra');
    expect(serra?.status).toBe('AWAITING_REVIEW');

    expect((await axe(container)).violations).toEqual([]);
  });
});
