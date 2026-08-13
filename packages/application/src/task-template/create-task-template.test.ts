// Testes do use case de criação de definição de tarefa — autorização efetiva
// (config.write da RLS congelada), equipe oficial, ordem de efeitos e
// recuperação. Sem relógio real, sem infraestrutura.

import { describe, expect, it } from 'vitest';

import type {
  EffectiveAuthorization,
  OperationalPositionView,
  TaskTemplateRecord,
  TemplateAuditInput,
  TemplateEnqueueInput,
} from '@tauros/contracts';
import { CAPABILITY_CONFIG_WRITE, PERMISSION_MODEL_VERSION } from '@tauros/contracts';

import { storeDayStartFor } from '../shared/operational-day.js';
import { CreateTaskTemplateUseCase, templateIdempotencyKeyFor } from './create-task-template.js';

const NOW = new Date('2026-08-13T14:00:00.000Z');
const TZ = 'America/Sao_Paulo';

const POSITIONS: readonly OperationalPositionView[] = [
  { id: 'pos-atendimento', key: 'atendimento', name: 'Atendimento' },
  { id: 'pos-producao', key: 'producao', name: 'Produção' },
];

function authorization(overrides: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-0004',
    operatorEmployeeId: 'emp-0004',
    storeId: 'store-1',
    sessionId: 'platform:prof-0004',
    permissions: [CAPABILITY_CONFIG_WRITE, 'audit.read'],
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: undefined,
    validUntil: new Date(NOW.getTime() + 3_600_000),
    origin: 'online',
    ...overrides,
  };
}

interface Harness {
  useCase: CreateTaskTemplateUseCase;
  saved: TaskTemplateRecord[];
  enqueued: TemplateEnqueueInput[];
  audits: TemplateAuditInput[];
  failEnqueue: boolean;
  failSave: boolean;
}

function makeHarness(): Harness {
  const harness: Harness = {
    saved: [],
    enqueued: [],
    audits: [],
    failEnqueue: false,
    failSave: false,
    useCase: undefined as unknown as CreateTaskTemplateUseCase,
  };
  let counter = 0;
  harness.useCase = new CreateTaskTemplateUseCase(
    { now: () => NOW },
    { uuid: () => `uuid-${String(++counter).padStart(2, '0')}` },
    {
      positions: () => Promise.resolve(POSITIONS),
      members: () => Promise.resolve([]),
    },
    {
      byStore: () => Promise.resolve(harness.saved),
      byIdempotencyKey: (storeId, key) =>
        Promise.resolve(
          harness.saved.find(
            (record) => record.storeId === storeId && record.idempotencyKey === key,
          ) ?? null,
        ),
      save: (record) => {
        if (harness.failSave) return Promise.reject(new Error('disk full'));
        harness.saved.push(record);
        return Promise.resolve();
      },
      updateSyncStatus: () => Promise.resolve(),
    },
    {
      enqueueCreateTemplate: (input) => {
        if (harness.failEnqueue) return Promise.reject(new Error('queue down'));
        harness.enqueued.push(input);
        return Promise.resolve();
      },
    },
    {
      record: (input) => {
        harness.audits.push(input);
        return Promise.resolve();
      },
    },
  );
  return harness;
}

const input = {
  deviceId: 'device-A',
  storeTimeZone: TZ,
  title: 'Organizar câmara fria',
  targetPositionId: 'pos-producao',
  requiresPhoto: false,
  expectedMin: null,
  expectedMax: null,
  dueOffsetMinutes: 15 * 60,
  frequency: 'ONCE' as const,
  createdOffline: false,
};

describe('CreateTaskTemplateUseCase — caminho autorizado', () => {
  it('cria, enfileira e audita config.changed', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.template.title).toBe('Organizar câmara fria');
    expect(result.template.targetPositionId).toBe('pos-producao');
    expect(result.template.active).toBe(true);
    expect(result.template.syncStatus).toBe('queued');
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.saved).toHaveLength(1);
    expect(harness.audits.at(-1)).toMatchObject({
      eventType: 'config.changed',
      result: 'success',
      templateId: result.template.id,
    });
  });

  it('usa chave de idempotência determinística (sem timestamp)', async () => {
    const harness = makeHarness();
    await harness.useCase.execute({ authorization: authorization(), ...input });
    const expected = templateIdempotencyKeyFor(
      'store-1',
      '2026-08-13',
      'emp-0004',
      'Organizar câmara fria',
      'pos-producao',
    );
    expect(harness.enqueued[0]?.template.idempotencyKey).toBe(expected);
    expect(expected).toBe(
      'task-template-create:store-1:2026-08-13:emp-0004:pos-producao:organizar-camara-fria',
    );
  });

  it('dupla submissão converge para a MESMA criação (replay)', async () => {
    const harness = makeHarness();
    const first = await harness.useCase.execute({ authorization: authorization(), ...input });
    const second = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(first.kind).toBe('created');
    expect(second.kind).toBe('already-created');
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.saved).toHaveLength(1);
  });

  it('criação offline marca a origem na auditoria', async () => {
    const harness = makeHarness();
    await harness.useCase.execute({
      authorization: authorization({ origin: 'offline-snapshot' }),
      ...input,
      createdOffline: true,
    });
    expect(harness.audits.at(-1)?.source).toBe('client-offline');
  });
});

describe('CreateTaskTemplateUseCase — autorização (ADR-018)', () => {
  it('nega sem config.write e audita access.denied', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ permissions: ['session.open', 'audit.read'] }),
      ...input,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(harness.audits.at(-1)).toMatchObject({
      eventType: 'access.denied',
      errorCode: CAPABILITY_CONFIG_WRITE,
    });
    expect(harness.enqueued).toHaveLength(0);
    expect(harness.saved).toHaveLength(0);
  });

  it('rejeita snapshot expirado', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ validUntil: new Date(NOW.getTime() - 1) }),
      ...input,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_EXPIRED' });
  });

  it('rejeita versão de modelo de permissão incompatível', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization({ permissionModelVersion: PERMISSION_MODEL_VERSION + 1 }),
      ...input,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'SNAPSHOT_VERSION_INCOMPATIBLE' });
  });
});

describe('CreateTaskTemplateUseCase — equipe e domínio', () => {
  it('rejeita posição inexistente na loja (ID oficial obrigatório)', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      ...input,
      targetPositionId: 'pos-inventada',
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'UNKNOWN_POSITION' });
    expect(harness.enqueued).toHaveLength(0);
  });

  it('rejeita título vazio', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      ...input,
      title: '   ',
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'TITLE_REQUIRED' });
  });

  it('rejeita criação sem posição responsável', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      ...input,
      targetPositionId: '',
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'ASSIGNMENT_REQUIRED' });
  });

  it('rejeita horário limite fora do dia', async () => {
    const harness = makeHarness();
    const result = await harness.useCase.execute({
      authorization: authorization(),
      ...input,
      dueOffsetMinutes: 24 * 60 + 30,
    });
    expect(result).toMatchObject({ kind: 'failed', code: 'INVALID_DUE_TIME' });
  });
});

describe('CreateTaskTemplateUseCase — falhas intermediárias e recuperação', () => {
  it('falha de fila não persiste nada e audita a falha', async () => {
    const harness = makeHarness();
    harness.failEnqueue = true;
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(result).toMatchObject({ kind: 'failed', code: 'ENQUEUE_FAILED' });
    expect(harness.saved).toHaveLength(0);
    expect(harness.audits.at(-1)).toMatchObject({ result: 'failure', errorCode: 'ENQUEUE_FAILED' });
  });

  it('falha de persistência mantém a intenção durável enfileirada (recuperável)', async () => {
    const harness = makeHarness();
    harness.failSave = true;
    const result = await harness.useCase.execute({ authorization: authorization(), ...input });
    expect(result).toMatchObject({ kind: 'failed', code: 'PERSISTENCE_FAILED' });
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.enqueued[0]?.template.title).toBe('Organizar câmara fria');
  });
});

describe('storeDayStartFor', () => {
  it('devolve a meia-noite civil da loja como instante UTC', () => {
    // São Paulo (UTC-3): 2026-08-13T14:00Z = 11:00 local ⇒ dia 2026-08-13,
    // meia-noite local = 03:00Z
    const start = storeDayStartFor(NOW, TZ);
    expect(start.toISOString()).toBe('2026-08-13T03:00:00.000Z');
  });

  it('vira o dia operacional na meia-noite da LOJA, não do dispositivo', () => {
    // 2026-08-14T01:00Z = 22:00 do dia 13 em São Paulo ⇒ ainda dia 13
    const lateNight = storeDayStartFor(new Date('2026-08-14T01:00:00.000Z'), TZ);
    expect(lateNight.toISOString()).toBe('2026-08-13T03:00:00.000Z');
  });

  it('é determinística', () => {
    expect(storeDayStartFor(NOW, TZ).getTime()).toBe(storeDayStartFor(NOW, TZ).getTime());
  });
});
