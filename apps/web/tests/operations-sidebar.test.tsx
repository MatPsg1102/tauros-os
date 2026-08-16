// UI Operacional V1.1 — sidebar de triagem, filtros combináveis e alertas de
// prazo da OPERAÇÃO DE HOJE. Container REAL em memória; a escala vem da
// presença PLANEJADA (Escala V1 — 13/08 = Equipe A; Equipe B folga) e o prazo
// é DERIVADO de apresentação: isOverdue do domínio + tasks.dueSoonWindowMs do
// Configuration Engine. Filtrar é leitura pura — nada entra na fila/auditoria.

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';
import { storeDayStartFor } from '@tauros/application';
import type { EffectiveAuthorization } from '@tauros/contracts';
import { PERMISSION_MODEL_VERSION } from '@tauros/contracts';

import OperacaoPage from '../src/app/operacao/page.js';
import { AppProviders } from '../src/app/providers.js';
import { dueStateFor } from '../src/controllers/use-shared-operations.js';
import { APP_STATE_SCHEMA, MemoryEvidenceBlobStore } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FIXTURE_OPERATORS, FIXTURE_STORE } from '../src/wiring/fixtures.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { resetNavigations } from './setup-router.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 11:00 na loja; Equipe A escalada
const WORK_DATE = '2026-08-13';

let container: AppContainer;
let offlineStore: MemoryLocalStore;
let currentNow: Date;

function makeWorld(): void {
  currentNow = NOW;
  offlineStore = new MemoryLocalStore(OFFLINE_SCHEMA);
  container = buildContainer({
    clock: () => currentNow,
    deviceId: 'device-A',
    offlineStore,
    appStore: new MemoryLocalStore(APP_STATE_SCHEMA),
    transport: new FakeSessionSyncTransport(),
    deviceOnline: () => true,
    evidenceBlobs: new MemoryEvidenceBlobStore(),
    // dia LIMPO: sem os templates DAILY de demonstração — as contagens do
    // read model são o objeto do teste, então só as definições semeadas contam
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

/** Vínculos do dia: Marina/Rita na Equipe A (escaladas 13/08); Bruno na B (folga). */
async function seedWorkforce(): Promise<void> {
  await container.reconcileFromQueue(); // baseline: equipes/posições/jornadas/padrão
  const members = [
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
      employeeId: 'emp-9001',
      name: 'Bruno Folga',
      teamId: 'team-b',
      positionId: 'pos-auxiliar-acougue',
    },
  ];
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

/** Definição via caminho oficial; vencimento = minutos após a abertura do dia. */
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

/** Materializa o dia pela via oficial (sem UI) — leitura fica pronta. */
async function materializeDay(): Promise<void> {
  const materialized = await container.loadDailyTasks.execute({
    authorization: supervisorAuthorization(),
    workDate: WORK_DATE,
    operationalDayStart: storeDayStartFor(currentNow, FIXTURE_STORE.timeZone),
    configVersionRef: null,
  });
  if (materialized.kind === 'failed') throw new Error('materialização falhou');
}

/**
 * Cenário padrão (11:00 da loja):
 *  - "Produzir linguiça"  Açougueiro 1 → vence 11:20 (PRÓXIMA DO PRAZO)
 *  - "Fechar câmara fria" Açougueiro 1 → vence 18:00 (NORMAL)
 *  - "Limpeza da serra"   Açougueiro 2 → venceu 10:00 (ATRASADA)
 *  - "Higienizar bancada" sem posição  → vence 20:00 (SEM RESPONSÁVEL)
 */
async function seedStandardDay(): Promise<void> {
  await seedWorkforce();
  await seedTemplate('Produzir linguiça', 'pos-acougueiro-1', 11 * 60 + 20);
  await seedTemplate('Fechar câmara fria', 'pos-acougueiro-1', 18 * 60);
  await seedTemplate('Limpeza da serra', 'pos-acougueiro-2', 10 * 60);
  await seedTemplate('Higienizar bancada', null, 20 * 60);
  await materializeDay();
}

function sidebarNav(): HTMLElement {
  // sidebar persistente (AppShell) + possivelmente a do Drawer — a primeira
  return screen.getAllByRole('navigation', { name: 'Triagem da operação' })[0] as HTMLElement;
}

/** Sublista de um grupo da sidebar (aria-label = título do grupo). */
function group(name: 'Situação' | 'Posições' | 'Equipe de hoje'): HTMLElement {
  return within(sidebarNav()).getByRole('list', { name });
}

async function renderReady(): Promise<void> {
  render(app());
  await screen.findAllByRole('heading', { name: 'Produzir linguiça' });
}

/** Títulos dos cards visíveis no quadro principal (ordem do dia). */
function cardTitles(): readonly string[] {
  const section = screen.getByRole('region', { name: /Tarefas d/ });
  return within(section)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

beforeEach(() => {
  makeWorld();
  resetNavigations();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('dueStateFor — estados de prazo DERIVADOS (nunca persistidos)', () => {
  const due = new Date('2026-08-13T13:00:00.000Z');
  const before = new Date('2026-08-13T12:45:00.000Z'); // 15 min antes
  const after = new Date('2026-08-13T13:30:00.000Z'); // 30 min depois
  const window = 30 * 60_000;

  it('vencida e ainda exigindo ação → OVERDUE (PENDING e IN_PROGRESS)', () => {
    expect(dueStateFor('PENDING', due, after, window)).toBe('OVERDUE');
    expect(dueStateFor('IN_PROGRESS', due, after, window)).toBe('OVERDUE');
    expect(dueStateFor('NEEDS_CORRECTION', due, after, window)).toBe('OVERDUE');
  });

  it('DONE/SKIPPED nunca contam atraso nem aviso', () => {
    expect(dueStateFor('DONE', due, after, window)).toBe('NORMAL');
    expect(dueStateFor('SKIPPED', due, after, window)).toBe('NORMAL');
    expect(dueStateFor('DONE', due, before, window)).toBe('NORMAL');
  });

  it('AWAITING_REVIEW não é atraso do operador (trabalho entregue)', () => {
    expect(dueStateFor('AWAITING_REVIEW', due, after, window)).toBe('NORMAL');
    expect(dueStateFor('AWAITING_REVIEW', due, before, window)).toBe('NORMAL');
  });

  it('dentro da janela oficial → DUE_SOON; fora → NORMAL', () => {
    expect(dueStateFor('PENDING', due, before, window)).toBe('DUE_SOON');
    expect(dueStateFor('PENDING', due, new Date('2026-08-13T12:00:00.000Z'), window)).toBe(
      'NORMAL',
    );
    // janela vem do parâmetro (não hardcode): janela menor muda o veredito
    expect(dueStateFor('PENDING', due, before, 10 * 60_000)).toBe('NORMAL');
  });
});

describe('Sidebar de triagem — equipe escalada e contadores', () => {
  it('mostra SOMENTE escalados do dia (com posição/jornada); Equipe B de folga não aparece', async () => {
    await seedStandardDay();
    await renderReady();
    const nav = sidebarNav();
    expect(within(nav).getByText('Marina Álvares')).toBeTruthy();
    expect(within(nav).getByText('Rita Belmonte')).toBeTruthy();
    // não escalado hoje (team-b folga em 13/08) NUNCA aparece na equipe do dia
    expect(within(nav).queryByText('Bruno Folga')).toBeNull();
    // posição + jornada planejada como contexto secundário
    expect(within(nav).getByText('Açougueiro 1 · 07:30–19:30')).toBeTruthy();
  });

  it('contadores por posição e por colaborador derivam do read model', async () => {
    await seedStandardDay();
    await renderReady();
    // Marina (Açougueiro 1): 2 abertas; Rita (Açougueiro 2): 1 atrasada
    const team = group('Equipe de hoje');
    const marina = within(team).getByText('Marina Álvares').closest('li') as HTMLElement;
    expect(within(marina).getByText('2 abertas')).toBeTruthy();
    const rita = within(team).getByText('Rita Belmonte').closest('li') as HTMLElement;
    expect(within(rita).getByText('1 atrasada')).toBeTruthy();
    // posições: Todas=4 abertas; Sem responsável=1
    const positions = group('Posições');
    const todas = within(positions).getByText('Todas').closest('li') as HTMLElement;
    expect(within(todas).getByText('4')).toBeTruthy();
    const unassigned = within(positions).getByText('Sem responsável').closest('li') as HTMLElement;
    expect(within(unassigned).getByText('1')).toBeTruthy();
  });
});

describe('Filtros combináveis — leitura pura', () => {
  it('clicar no colaborador filtra o quadro e o chip remove o filtro', async () => {
    await seedStandardDay();
    await renderReady();
    fireEvent.click(
      within(group('Equipe de hoje')).getByRole('button', { name: /Marina Álvares/ }),
    );
    expect(screen.getByRole('region', { name: 'Tarefas de Marina Álvares' })).toBeTruthy();
    expect(cardTitles()).toEqual(['Produzir linguiça', 'Fechar câmara fria']);
    // remover via chip de filtro ativo restaura o quadro da loja
    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro Marina Álvares' }));
    expect(screen.getByRole('region', { name: 'Tarefas da loja' })).toBeTruthy();
    // ordem aprovada do quadro preservada: por vencimento (dueAt)
    expect(cardTitles()).toEqual([
      'Limpeza da serra',
      'Produzir linguiça',
      'Fechar câmara fria',
      'Higienizar bancada',
    ]);
  });

  it('"Sem responsável" mostra apenas tarefas aguardando distribuição', async () => {
    await seedStandardDay();
    await renderReady();
    fireEvent.click(within(group('Posições')).getByRole('button', { name: /Sem responsável/ }));
    expect(cardTitles()).toEqual(['Higienizar bancada']);
  });

  it('posição filtra; posição+colaborador+prazo combinam por interseção; limpar restaura', async () => {
    await seedStandardDay();
    await renderReady();
    fireEvent.click(within(group('Posições')).getByRole('button', { name: /^Açougueiro 1/ }));
    expect(cardTitles()).toEqual(['Produzir linguiça', 'Fechar câmara fria']);
    // + colaborador (mesma interseção) + prazo DUE_SOON → só a linguiça
    fireEvent.click(
      within(group('Equipe de hoje')).getByRole('button', { name: /Marina Álvares/ }),
    );
    fireEvent.click(within(group('Situação')).getByRole('button', { name: /Próximas do prazo/ }));
    expect(cardTitles()).toEqual(['Produzir linguiça']);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(cardTitles()).toHaveLength(4);
  });

  it('filtrar NÃO gera fila nem auditoria nova (leitura pura)', async () => {
    await seedStandardDay();
    await renderReady();
    const outbox = (): Promise<readonly unknown[]> =>
      offlineStore.transaction(['audit_outbox'], 'read', (tx) => tx.getAll('audit_outbox'));
    const queueBefore = (await container.queue.all()).length;
    const outboxBefore = (await outbox()).length;
    fireEvent.click(
      within(group('Equipe de hoje')).getByRole('button', { name: /Marina Álvares/ }),
    );
    fireEvent.click(within(group('Situação')).getByRole('button', { name: /Atrasadas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect((await container.queue.all()).length).toBe(queueBefore);
    expect((await outbox()).length).toBe(outboxBefore);
  });
});

describe('Alertas de prazo — topo do quadro', () => {
  it('cards destacam ATRASADA/PRÓXIMA e os alertas do topo filtram ao toque', async () => {
    await seedStandardDay();
    await renderReady();
    // destaque no card: ícone + texto (nunca só cor)
    expect(screen.getByText(/🔴 Atrasada há 1 h/)).toBeTruthy();
    expect(screen.getByText(/⚠ Vence em 20 min/)).toBeTruthy();
    // alerta "atrasadas" filtra OVERDUE
    fireEvent.click(screen.getByRole('button', { name: /1 tarefa atrasada/ }));
    expect(cardTitles()).toEqual(['Limpeza da serra']);
    // alterna para "próximas do prazo" → DUE_SOON
    fireEvent.click(screen.getByRole('button', { name: /1 próxima do prazo/ }));
    expect(cardTitles()).toEqual(['Produzir linguiça']);
  });

  it('relógio avançando muda NORMAL→DUE_SOON→OVERDUE sem mutation no registro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await seedStandardDay();
    await renderReady();
    expect(screen.getByText(/⚠ Vence em 20 min/)).toBeTruthy();

    // 11:00 → 11:25 (5 min após o vencimento das 11:20) + tick de minuto
    currentNow = new Date('2026-08-13T14:25:00.000Z');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText(/🔴 Atrasada há 5 min/)).toBeTruthy();
    expect(screen.queryByText(/⚠ Vence em/)).toBeNull();

    // NENHUMA mutation: o status persistido segue PENDING (derivação pura)
    const tasks = await container.tasks.byWorkDate(FIXTURE_STORE.id, WORK_DATE);
    const linguica = tasks.find((task) => task.template.title === 'Produzir linguiça');
    expect(linguica?.status).toBe('PENDING');
  });
});

describe('Responsivo — Drawer no mobile, sidebar no tablet', () => {
  it('tablet/desktop: sidebar persistente funcional ao lado do quadro', async () => {
    await seedStandardDay();
    await renderReady();
    // sem gatilho móvel; navegação de triagem presente e operável por teclado
    expect(screen.queryByRole('button', { name: 'Filtros e equipe' })).toBeNull();
    const nav = sidebarNav();
    expect(within(nav).getByText('Situação')).toBeTruthy();
    expect(within(nav).getByText('Posições')).toBeTruthy();
    expect(within(nav).getByText('Equipe de hoje')).toBeTruthy();
    // funcional: um toque filtra o quadro ao lado
    fireEvent.click(within(group('Posições')).getByRole('button', { name: /^Açougueiro 2/ }));
    expect(cardTitles()).toEqual(['Limpeza da serra']);
  });

  it('mobile: triagem vira Drawer; selecionar colaborador filtra e fecha', async () => {
    // stub de matchMedia: viewport estreito (jsdom não implementa media query)
    const originalMatchMedia = window.matchMedia as unknown;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      await seedStandardDay();
      await renderReady();
      fireEvent.click(screen.getByRole('button', { name: 'Filtros e equipe' }));
      const drawer = await screen.findByRole('dialog', { name: /Filtros e equipe/ });
      fireEvent.click(within(drawer).getByRole('button', { name: /Marina Álvares/ }));
      // Drawer fecha após a seleção; filtro ativo legível como chip
      expect(screen.queryByRole('dialog', { name: /Filtros e equipe/ })).toBeNull();
      expect(screen.getByRole('region', { name: 'Tarefas de Marina Álvares' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Remover filtro Marina Álvares' })).toBeTruthy();
    } finally {
      window.matchMedia = originalMatchMedia as typeof window.matchMedia;
    }
  });
});

describe('Acessibilidade', () => {
  it('quadro com sidebar, alertas e filtros passa no axe', async () => {
    await seedStandardDay();
    const { container: dom } = render(app());
    await screen.findAllByRole('heading', { name: 'Produzir linguiça' });
    expect((await axe(dom)).violations).toEqual([]);
  }, 30_000);
});
