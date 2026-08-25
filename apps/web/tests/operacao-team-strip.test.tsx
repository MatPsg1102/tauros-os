// UX Operacional V1.3 — faixa "Equipe escalada hoje" no CORPO da /operacao e
// nomes do card por ESCALA (fallback honesto de ocupantes). Container REAL em
// memória, mesma escala oficial dos testes de triagem (13/08 = Equipe A;
// Equipe B de folga). Navegar por pessoa é LEITURA PURA — nada entra na fila
// nem na auditoria — e NUNCA autoriza: claim/start seguem do domínio.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
let offlineStore: MemoryLocalStore;

function makeWorld(options: { readonly demoWorkforce?: boolean } = {}): void {
  offlineStore = new MemoryLocalStore(OFFLINE_SCHEMA);
  container = buildContainer({
    clock: () => NOW,
    deviceId: 'device-A',
    offlineStore,
    appStore: new MemoryLocalStore(APP_STATE_SCHEMA),
    transport: new FakeSessionSyncTransport(),
    deviceOnline: () => true,
    evidenceBlobs: new MemoryEvidenceBlobStore(),
    // dia LIMPO: sem os templates DAILY de demonstração — os cards deste teste
    // são exatamente os semeados aqui
    templates: { activeTemplates: () => Promise.resolve([]) },
    ...(options.demoWorkforce === false ? { demoWorkforce: false } : {}),
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

interface SeedMember {
  readonly employeeId: string;
  readonly name: string;
  readonly teamId: string;
  readonly positionId: string;
}

async function registerMembers(members: readonly SeedMember[]): Promise<void> {
  for (const member of members) {
    await container.workforce.saveRegistration(
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
        teamId: member.teamId,
        operationalPositionId: member.positionId,
        shiftDefinitionId: 'def-0730-1930',
        validFrom: '2026-08-01',
        validUntil: null,
      },
    );
  }
}

/**
 * Elenco: Marina e Rita na Equipe A (ESCALADAS em 13/08); Caio na Equipe B
 * (FOLGA) mas OCUPANTE vigente da MESMA posição da Marina — é o caso que prova
 * "escalados primeiro"; Bruno na Equipe B, ocupante ÚNICO da sua posição — é o
 * caso que prova o fallback com rótulo honesto.
 */
async function seedWorkforce(): Promise<void> {
  await container.reconcileFromQueue(); // baseline: equipes/posições/jornadas/padrão
  await registerMembers([
    {
      employeeId: 'emp-0001',
      name: 'Marina Álvares',
      teamId: 'team-a',
      positionId: 'pos-acougueiro-1',
    },
    {
      employeeId: 'emp-0003',
      name: 'Rita Belmonte',
      teamId: 'team-a',
      positionId: 'pos-acougueiro-2',
    },
    {
      employeeId: 'emp-9002',
      name: 'Caio Folga',
      teamId: 'team-b',
      positionId: 'pos-acougueiro-1',
    },
    {
      employeeId: 'emp-9001',
      name: 'Bruno Folga',
      teamId: 'team-b',
      positionId: 'pos-auxiliar-acougue',
    },
  ]);
}

async function seedTemplate(
  title: string,
  positionId: string | null,
  dueOffsetMinutes: number,
): Promise<void> {
  container.setAuthorization(supervisorAuthorization());
  const created = await container.createTaskTemplate.execute({
    authorization: supervisorAuthorization(),
    deviceId: 'device-A',
    storeTimeZone: FIXTURE_STORE.timeZone,
    title,
    targetPositionId: positionId,
    requiresPhoto: false,
    requiresReview: false,
    expectedMin: null,
    expectedMax: null,
    effectiveFrom: WORK_DATE,
    plannedStartMinutes: 8 * 60,
    dueOffsetMinutes,
    recurrence: { kind: 'ONCE' },
    createdOffline: false,
  });
  if (created.kind === 'failed') throw new Error(`template não criado: ${created.code}`);
  container.setAuthorization(null);
}

async function materializeDay(): Promise<void> {
  const materialized = await container.loadDailyTasks.execute({
    authorization: supervisorAuthorization(),
    workDate: WORK_DATE,
    operationalDayStart: storeDayStartFor(NOW, FIXTURE_STORE.timeZone),
    configVersionRef: null,
  });
  if (materialized.kind === 'failed') throw new Error('materialização falhou');
}

/**
 *  - "Produzir linguiça"  Açougueiro 1  → Marina ESCALADA (Caio é ocupante de folga)
 *  - "Limpeza da serra"   Açougueiro 2  → Rita, venceu 10:00 (ATRASADA)
 *  - "Repor caixas"       Aux. açougue  → NINGUÉM escalado; Bruno é ocupante
 */
async function seedStandardDay(): Promise<void> {
  await seedWorkforce();
  await seedTemplate('Produzir linguiça', 'pos-acougueiro-1', 11 * 60 + 20);
  await seedTemplate('Limpeza da serra', 'pos-acougueiro-2', 10 * 60);
  await seedTemplate('Repor caixas', 'pos-auxiliar-acougue', 18 * 60);
  await materializeDay();
}

/** A faixa do CORPO do quadro (não a sidebar). */
function strip(): HTMLElement {
  return screen.getByRole('group', { name: 'Equipe escalada hoje' });
}

function cardTitles(): readonly string[] {
  const section = screen.getByRole('region', { name: /Tarefas d/ });
  return within(section)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

/** Card pelo título — para inspecionar a linha de responsáveis. */
function card(title: string): HTMLElement {
  const section = screen.getByRole('region', { name: /Tarefas d/ });
  const heading = within(section).getByRole('heading', { level: 3, name: title });
  return heading.closest('.t-card') as HTMLElement;
}

async function renderReady(): Promise<void> {
  render(app());
  await screen.findAllByRole('heading', { name: 'Produzir linguiça' });
}

function outbox(): Promise<readonly unknown[]> {
  return offlineStore.transaction(['audit_outbox'], 'read', (tx) => tx.getAll('audit_outbox'));
}

beforeEach(() => {
  makeWorld();
  resetNavigations();
});

afterEach(() => {
  cleanup();
});

describe('Faixa "Equipe escalada hoje" — navegação por pessoa no corpo do quadro', () => {
  it('lista SOMENTE os escalados do dia; ocupante de folga não vira opção', async () => {
    await seedStandardDay();
    await renderReady();
    const bar = strip();
    expect(within(bar).getByRole('button', { name: /Marina/ })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: /Rita/ })).toBeTruthy();
    // Equipe B de folga: nem Caio (ocupante da posição da Marina) nem Bruno
    expect(within(bar).queryByRole('button', { name: /Caio/ })).toBeNull();
    expect(within(bar).queryByRole('button', { name: /Bruno/ })).toBeNull();
    // "Toda a equipe" é o estado inicial (nenhum colaborador filtrado)
    expect(
      within(bar)
        .getByRole('button', { name: /Toda a equipe/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('a faixa carrega o MESMO sinal da sidebar (pendências por pessoa)', async () => {
    await seedStandardDay();
    await renderReady();
    const bar = strip();
    expect(within(bar).getByRole('button', { name: /Rita/ }).textContent).toContain('1 atrasada');
    expect(within(bar).getByRole('button', { name: /Marina/ }).textContent).toContain('1 aberta');
  });

  it('um toque filtra o quadro, mostra posição/jornada e outro toque restaura', async () => {
    await seedStandardDay();
    await renderReady();
    fireEvent.click(within(strip()).getByRole('button', { name: /Marina/ }));
    expect(screen.getByRole('region', { name: 'Tarefas de Marina Álvares' })).toBeTruthy();
    expect(cardTitles()).toEqual(['Produzir linguiça']);
    // contexto de quem está selecionado, sem abrir a sidebar
    expect(screen.getByText('Marina Álvares · Açougueiro 1 · 07:30–19:30')).toBeTruthy();
    // o MESMO chip desmarca (alternância) — quadro da loja de volta
    fireEvent.click(within(strip()).getByRole('button', { name: /Marina/ }));
    expect(screen.getByRole('region', { name: 'Tarefas da loja' })).toBeTruthy();
    expect(cardTitles().length).toBe(3);
  });

  it('"Toda a equipe" limpa o colaborador sem tocar nos demais filtros', async () => {
    await seedStandardDay();
    await renderReady();
    fireEvent.click(screen.getByRole('button', { name: /1 tarefa atrasada/ }));
    fireEvent.click(within(strip()).getByRole('button', { name: /Rita/ }));
    expect(cardTitles()).toEqual(['Limpeza da serra']);
    fireEvent.click(within(strip()).getByRole('button', { name: /Toda a equipe/ }));
    // colaborador saiu; o filtro de PRAZO continua ativo (atrasadas)
    expect(screen.getByRole('region', { name: 'Tarefas da loja' })).toBeTruthy();
    expect(cardTitles()).toEqual(['Limpeza da serra']);
    expect(screen.getByRole('button', { name: 'Remover filtro Atrasadas' })).toBeTruthy();
  });

  it('faixa e sidebar escrevem no MESMO filtro (uma fonte de verdade)', async () => {
    await seedStandardDay();
    await renderReady();
    fireEvent.click(within(strip()).getByRole('button', { name: /Rita/ }));
    // UX V1.2: o painel inicia RECOLHIDO como rail — abrir e fixar para ler o
    // conteúdo da triagem (o filtro já está aplicado antes disso)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel operacional' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fixar aberta' }));
    const nav = screen.getAllByRole('navigation', {
      name: 'Triagem da operação',
    })[0] as HTMLElement;
    const item = within(nav).getByText('Rita Belmonte').closest('button') as HTMLElement;
    expect(item.getAttribute('data-active')).toBe('true');
  });

  it('navegar pela faixa é LEITURA PURA: nada entra na fila nem na auditoria', async () => {
    await seedStandardDay();
    await renderReady();
    const queueBefore = (await container.queue.all()).length;
    const outboxBefore = (await outbox()).length;
    fireEvent.click(within(strip()).getByRole('button', { name: /Marina/ }));
    fireEvent.click(within(strip()).getByRole('button', { name: /Rita/ }));
    fireEvent.click(within(strip()).getByRole('button', { name: /Toda a equipe/ }));
    expect((await container.queue.all()).length).toBe(queueBefore);
    expect((await outbox()).length).toBe(outboxBefore);
  });

  it('a11y limpa com a faixa presente', async () => {
    await seedStandardDay();
    await renderReady();
    expect((await axe(document.body)).violations).toEqual([]);
  });
});

describe('Nomes do card — ESCALADOS da posição primeiro, ocupantes só como fallback', () => {
  it('posição com escalado ignora o ocupante de folga e não rotula nada', async () => {
    await seedStandardDay();
    await renderReady();
    const linguica = card('Produzir linguiça');
    expect(linguica.textContent).toContain('Marina Álvares');
    // Caio ocupa a MESMA posição, mas está de folga: não é nomeado
    expect(linguica.textContent).not.toContain('Caio Folga');
    expect(linguica.textContent).not.toContain('fora da escala de hoje');
  });

  it('posição SEM ninguém escalado cai no ocupante — e diz que ele está fora da escala', async () => {
    await seedStandardDay();
    await renderReady();
    const caixas = card('Repor caixas');
    expect(caixas.textContent).toContain('Bruno Folga');
    expect(caixas.textContent).toContain('fora da escala de hoje');
  });
});

describe('Sem escalados — vazio operacional claro (nunca uma faixa muda)', () => {
  it('escala vigente sem ninguém na data explica e aponta para a gestão', async () => {
    makeWorld({ demoWorkforce: false });
    await container.reconcileFromQueue();
    await seedTemplate('Repor caixas', 'pos-auxiliar-acougue', 18 * 60);
    await materializeDay();
    render(app());
    await screen.findAllByRole('heading', { name: 'Repor caixas' });
    expect(screen.getByRole('heading', { name: 'Ninguém escalado para hoje' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver escala e equipe' })).toBeTruthy();
    // o quadro NÃO some: as tarefas seguem visíveis pela posição responsável
    expect(cardTitles()).toEqual(['Repor caixas']);
  });
});

describe('Interseção vazia — vazio que explica e oferece saída', () => {
  it('diz QUAL combinação esvaziou e "Limpar todos os filtros" restaura o quadro', async () => {
    await seedStandardDay();
    await renderReady();
    // Marina (Açougueiro 1) × atrasadas → interseção vazia (a atrasada é da Rita)
    fireEvent.click(within(strip()).getByRole('button', { name: /Marina/ }));
    fireEvent.click(screen.getByRole('button', { name: /1 tarefa atrasada/ }));
    expect(
      screen.getByRole('heading', { name: 'Nenhuma tarefa nesta combinação de filtros' }),
    ).toBeTruthy();
    expect(screen.getByText(/Marina Álvares \+ atrasadas/)).toBeTruthy();
    // saída dedicada: manter a pessoa e soltar o resto
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas de Marina Álvares' }));
    expect(cardTitles()).toEqual(['Produzir linguiça']);
    // e a saída total
    fireEvent.click(screen.getByRole('button', { name: /1 tarefa atrasada/ }));
    expect(screen.getByRole('button', { name: 'Limpar todos os filtros' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar todos os filtros' }));
    expect(cardTitles().length).toBe(3);
  });
});
