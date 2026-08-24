// Bug de piloto (Vercel): card mostrava "Produção — Carlos Nunes" mas o
// domínio recusava INICIAR com "outra posição" — a UI lia o diretório
// fixture enquanto a elegibilidade lia employee_assignments do cadastro
// real, onde o time demo NÃO existia. Invariante restaurada na ORIGEM:
// ensureDemoWorkforce semeia o time demo como cadastro real (idempotente,
// nunca sobrescreve a loja). Estes testes provam o repro exato, a proteção
// de posição preservada e a semântica do seed.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { currentAssignmentFor } from '@tauros/domain';
import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import OperacaoPage from '../src/app/operacao/page.js';
import { AppProviders } from '../src/app/providers.js';
import { APP_STATE_SCHEMA, MemoryEvidenceBlobStore } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FIXTURE_STORE } from '../src/wiring/fixtures.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { resetNavigations } from './setup-router.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 11:00 na loja

let container: AppContainer;

function makeWorld(): void {
  container = buildContainer({
    clock: () => NOW,
    deviceId: 'device-A',
    offlineStore: new MemoryLocalStore(OFFLINE_SCHEMA),
    appStore: new MemoryLocalStore(APP_STATE_SCHEMA),
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

beforeEach(() => {
  makeWorld();
  resetNavigations();
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
