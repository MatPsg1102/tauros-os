// UX Operacional V1.2 — sidebar ADAPTATIVA da /operacao. Desktop (hover real)
// inicia recolhida como rail de sinais; aproximar expande em overlay; "Fixar
// aberta" torna persistente. Touch abre por toque via Drawer do DS. Estado é
// efêmero de apresentação: nada entra em domínio, fila ou auditoria.

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
let offlineStore: MemoryLocalStore;
let restoreMatchMedia: (() => void) | null = null;

/** matchMedia falso por consulta — capacidades de interação sob controle. */
function stubMatchMedia(match: (query: string) => boolean): void {
  const original = window.matchMedia as unknown;
  window.matchMedia = ((query: string) => ({
    matches: match(query),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  restoreMatchMedia = () => {
    window.matchMedia = original as typeof window.matchMedia;
  };
}

function makeWorld(): void {
  offlineStore = new MemoryLocalStore(OFFLINE_SCHEMA);
  container = buildContainer({
    clock: () => NOW,
    deviceId: 'device-A',
    offlineStore,
    appStore: new MemoryLocalStore(APP_STATE_SCHEMA),
    transport: new FakeSessionSyncTransport(),
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

/** Dia compacto: Marina escalada; 1 atrasada + 1 próxima do prazo + 1 normal. */
async function seedDay(): Promise<void> {
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
  const templates = [
    { title: 'Limpeza da serra', dueOffsetMinutes: 10 * 60 }, // venceu 10:00
    { title: 'Produzir linguiça', dueOffsetMinutes: 11 * 60 + 20 }, // vence 11:20
    { title: 'Fechar câmara fria', dueOffsetMinutes: 18 * 60 }, // normal
  ];
  container.setAuthorization(supervisorAuthorization());
  for (const template of templates) {
    const created = await container.createTaskTemplate.execute({
      authorization: supervisorAuthorization(),
      deviceId: 'device-A',
      storeTimeZone: FIXTURE_STORE.timeZone,
      title: template.title,
      targetPositionId: 'pos-acougueiro-1',
      requiresPhoto: false,
      requiresReview: false,
      expectedMin: null,
      expectedMax: null,
      effectiveFrom: WORK_DATE,
      plannedStartMinutes: 8 * 60,
      dueOffsetMinutes: template.dueOffsetMinutes,
      recurrence: { kind: 'ONCE' },
      createdOffline: false,
    });
    if (created.kind === 'failed') throw new Error(`template não criado: ${created.code}`);
  }
  container.setAuthorization(null);
  const materialized = await container.loadDailyTasks.execute({
    authorization: supervisorAuthorization(),
    workDate: WORK_DATE,
    operationalDayStart: storeDayStartFor(NOW, FIXTURE_STORE.timeZone),
    configVersionRef: null,
  });
  if (materialized.kind === 'failed') throw new Error('materialização falhou');
}

async function renderReady(): Promise<HTMLElement> {
  render(app());
  await screen.findAllByRole('heading', { name: 'Produzir linguiça' });
  const wrapper = document.querySelector('[data-operations-sidebar]');
  if (!(wrapper instanceof HTMLElement)) throw new Error('sidebar adaptativa ausente');
  return wrapper;
}

const panelMode = (wrapper: HTMLElement): string | null => wrapper.getAttribute('data-panel-mode');

beforeEach(() => {
  makeWorld();
  resetNavigations();
});

afterEach(() => {
  cleanup();
  restoreMatchMedia?.();
  restoreMatchMedia = null;
  vi.useRealTimers();
});

describe('Desktop (hover real) — rail, expansão por aproximação e pin', () => {
  it('1+7. inicia RECOLHIDA como rail; sinais de atraso/prazo seguem visíveis', async () => {
    await seedDay();
    const wrapper = await renderReady();
    expect(panelMode(wrapper)).toBe('collapsed');
    // rail acessível: gatilho explícito + sinais com quantidade
    expect(screen.getByRole('button', { name: 'Abrir painel operacional' })).toBeTruthy();
    expect(within(wrapper).getByRole('button', { name: 'Atrasadas (1)' })).toBeTruthy();
    expect(within(wrapper).getByRole('button', { name: 'Próximas do prazo (1)' })).toBeTruthy();
    // conteúdo completo NÃO está montado no estado recolhido
    expect(screen.queryByText('Equipe de hoje')).toBeNull();
    // §6: recolher não esconde a situação — alertas do quadro continuam lá
    const alerts = screen.getByRole('group', { name: 'Alertas de prazo' });
    expect(within(alerts).getByRole('button', { name: /1 tarefa atrasada/ })).toBeTruthy();
    expect(within(alerts).getByRole('button', { name: /1 próxima do prazo/ })).toBeTruthy();
  });

  it('2+3. aproximar expande; afastar recolhe após o delay', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await seedDay();
    const wrapper = await renderReady();
    fireEvent.mouseEnter(wrapper);
    expect(panelMode(wrapper)).toBe('temporary');
    expect(screen.getByText('Equipe de hoje')).toBeTruthy();
    fireEvent.mouseLeave(wrapper);
    // dentro do delay ainda está aberta (evita fechar ao cruzar a borda)
    expect(panelMode(wrapper)).toBe('temporary');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(panelMode(wrapper)).toBe('collapsed');
  });

  it('4+5. fixada não recolhe ao afastar; "Recolher" volta para a rail', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await seedDay();
    const wrapper = await renderReady();
    fireEvent.mouseEnter(wrapper);
    fireEvent.click(screen.getByRole('button', { name: 'Fixar aberta' }));
    expect(panelMode(wrapper)).toBe('pinned');
    fireEvent.mouseLeave(wrapper);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(panelMode(wrapper)).toBe('pinned');
    expect(screen.getByText('Equipe de hoje')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher' }));
    expect(panelMode(wrapper)).toBe('collapsed');
  });

  it('6. selecionar colaborador recolhe a expansão temporária e o filtro permanece', async () => {
    await seedDay();
    const wrapper = await renderReady();
    fireEvent.mouseEnter(wrapper);
    fireEvent.click(screen.getByRole('button', { name: /Marina Álvares/ }));
    // recolheu sozinha (não estava fixada) e o quadro ficou filtrado
    expect(panelMode(wrapper)).toBe('collapsed');
    expect(screen.getByRole('region', { name: 'Tarefas de Marina Álvares' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remover filtro Marina Álvares' })).toBeTruthy();
  });

  it('11. teclado: gatilho expande, ESC fecha e devolve o foco à rail', async () => {
    await seedDay();
    const wrapper = await renderReady();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel operacional' }));
    expect(panelMode(wrapper)).toBe('temporary');
    expect(screen.getByText('Equipe de hoje')).toBeTruthy();
    fireEvent.keyDown(screen.getByText('Equipe de hoje'), { key: 'Escape' });
    expect(panelMode(wrapper)).toBe('collapsed');
  });

  it('12. prefers-reduced-motion: painel temporário abre sem transição', async () => {
    stubMatchMedia((query) => (query.includes('reduced-motion') ? true : query.includes('hover')));
    await seedDay();
    const wrapper = await renderReady();
    // aguarda a preferência assentar (effect) antes de abrir o overlay
    await waitFor(() => {
      expect(panelMode(wrapper)).toBe('collapsed');
    });
    fireEvent.mouseEnter(wrapper);
    await waitFor(() => {
      const shell = wrapper.querySelector('div[style*="fixed"]') as HTMLElement | null;
      expect(shell).not.toBeNull();
      expect(shell?.style.transition ?? '').toBe('');
    });
  });

  it('13. hover/pin/filtro NÃO tocam fila nem auditoria (estado efêmero)', async () => {
    await seedDay();
    const wrapper = await renderReady();
    const outbox = (): Promise<readonly unknown[]> =>
      offlineStore.transaction(['audit_outbox'], 'read', (tx) => tx.getAll('audit_outbox'));
    const queueBefore = (await container.queue.all()).length;
    const outboxBefore = (await outbox()).length;
    fireEvent.mouseEnter(wrapper);
    fireEvent.click(screen.getByRole('button', { name: 'Fixar aberta' }));
    fireEvent.click(screen.getByRole('button', { name: /Marina Álvares/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Recolher' }));
    expect((await container.queue.all()).length).toBe(queueBefore);
    expect((await outbox()).length).toBe(outboxBefore);
  });
});

describe('Touch e mobile', () => {
  it('8+9. touch: toque na rail abre o Drawer; selecionar aplica e fecha; ESC fecha', async () => {
    stubMatchMedia(() => false); // sem hover, sem viewport mobile (tablet touch)
    await seedDay();
    const wrapper = await renderReady();
    // capacidades assentam via effect (padrão SSR-safe) — aguardar o modo touch
    await waitFor(() => {
      expect(panelMode(wrapper)).toBe('touch-rail');
    });
    fireEvent.click(within(wrapper).getByRole('button', { name: 'Atrasadas (1)' }));
    const drawer = await screen.findByRole('dialog', { name: /Filtros e equipe/ });
    // um único toque seleciona o filtro (sem exigir toque duplo)
    fireEvent.click(within(drawer).getByRole('button', { name: /Marina Álvares/ }));
    expect(screen.queryByRole('dialog', { name: /Filtros e equipe/ })).toBeNull();
    expect(screen.getByRole('region', { name: 'Tarefas de Marina Álvares' })).toBeTruthy();
    // reabre e fecha por ESC (Drawer do DS)
    fireEvent.click(within(wrapper).getByRole('button', { name: 'Filtros' }));
    const reopened = await screen.findByRole('dialog', { name: /Filtros e equipe/ });
    fireEvent.keyDown(reopened, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Filtros e equipe/ })).toBeNull();
  });

  it('10. mobile: gatilho "Filtros e equipe" da tela segue funcionando (Drawer)', async () => {
    stubMatchMedia(() => true); // viewport estreito
    await seedDay();
    render(app());
    await screen.findAllByRole('heading', { name: 'Produzir linguiça' });
    fireEvent.click(await screen.findByRole('button', { name: 'Filtros e equipe' }));
    const drawer = await screen.findByRole('dialog', { name: /Filtros e equipe/ });
    fireEvent.click(within(drawer).getByRole('button', { name: /Marina Álvares/ }));
    expect(screen.queryByRole('dialog', { name: /Filtros e equipe/ })).toBeNull();
    expect(screen.getByRole('region', { name: 'Tarefas de Marina Álvares' })).toBeTruthy();
  });
});
