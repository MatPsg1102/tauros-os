// Testes dos use cases da Operação Compartilhada — assumir, iniciar,
// enviar p/ conferência (com evidência real), aprovar/devolver. Foco:
// orquestração, capability efetiva (UI hiding ≠ authorization), idempotência
// e preservação de histórico. Sem relógio real, sem infraestrutura.

import { describe, expect, it } from 'vitest';

import type {
  DailyTaskRecord,
  EffectiveAuthorization,
  EvidenceRecord,
  TaskExecutionRecord,
  TaskExecutionReview,
  WorkforceAuditInput,
} from '@tauros/contracts';
import { CAPABILITY_TASK_REVIEW, PERMISSION_MODEL_VERSION } from '@tauros/contracts';

import { ClaimDailyTaskUseCase } from './claim-daily-task.js';
import { StartDailyTaskUseCase } from './start-daily-task.js';
import { RecordTaskOutcomeUseCase } from './record-task-outcome.js';
import { ReviewTaskExecutionUseCase } from './review-task-execution.js';
import { AddTaskEvidenceUseCase } from './add-task-evidence.js';

const NOW = new Date('2026-08-14T13:00:00.000Z');
const WORK_DATE = '2026-08-14';

function auth(overrides: Partial<EffectiveAuthorization> = {}): EffectiveAuthorization {
  return {
    operatorProfileId: 'prof-1',
    operatorEmployeeId: 'emp-1',
    storeId: 'store-1',
    sessionId: 'platform:prof-1',
    permissions: ['session.open', 'session.close'],
    permissionModelVersion: PERMISSION_MODEL_VERSION,
    configVersionRef: undefined,
    validUntil: new Date(NOW.getTime() + 3_600_000),
    origin: 'online',
    ...overrides,
  };
}

const reviewerAuth = (): EffectiveAuthorization =>
  auth({
    operatorProfileId: 'prof-9',
    operatorEmployeeId: 'emp-9',
    sessionId: 'platform:prof-9',
    permissions: ['session.open', CAPABILITY_TASK_REVIEW],
  });

function baseTask(overrides: Partial<DailyTaskRecord> = {}): DailyTaskRecord {
  return {
    id: 'task-1',
    storeId: 'store-1',
    templateId: 'tpl-1',
    workDate: WORK_DATE,
    plannedStartAt: null,
    dueAt: '2026-08-14T20:00:00.000Z',
    status: 'PENDING',
    assignedPositionId: null,
    expectedMinSnapshot: null,
    expectedMaxSnapshot: null,
    configVersionRef: null,
    template: {
      templateId: 'tpl-1',
      title: 'Limpeza da serra',
      frequency: 'DAILY',
      requiresPhoto: true,
      requiresReview: true,
      expectedMin: null,
      expectedMax: null,
      targetPositionId: null,
      dueOffsetMinutes: 600,
    },
    lastExecutionId: null,
    syncStatus: null,
    startedAt: null,
    startedByEmployeeId: null,
    ...overrides,
  };
}

interface World {
  tasks: Map<string, DailyTaskRecord>;
  executions: Map<string, TaskExecutionRecord>;
  evidence: Map<string, EvidenceRecord>;
  blobs: Map<string, Blob>;
  enqueued: string[];
  audits: WorkforceAuditInput[];
  claim: ClaimDailyTaskUseCase;
  start: StartDailyTaskUseCase;
  record: RecordTaskOutcomeUseCase;
  review: ReviewTaskExecutionUseCase;
  addEvidence: AddTaskEvidenceUseCase;
}

function makeWorld(task: DailyTaskRecord, actorScheduled = true): World {
  const world: World = {
    tasks: new Map([[task.id, task]]),
    executions: new Map(),
    evidence: new Map(),
    blobs: new Map(),
    enqueued: [],
    audits: [],
    claim: undefined as unknown as ClaimDailyTaskUseCase,
    start: undefined as unknown as StartDailyTaskUseCase,
    record: undefined as unknown as RecordTaskOutcomeUseCase,
    review: undefined as unknown as ReviewTaskExecutionUseCase,
    addEvidence: undefined as unknown as AddTaskEvidenceUseCase,
  };
  const repository = {
    byWorkDate: () => Promise.resolve([...world.tasks.values()]),
    byId: (id: string) => Promise.resolve(world.tasks.get(id) ?? null),
    saveAll: () => Promise.resolve(),
    save: (record: DailyTaskRecord) => {
      world.tasks.set(record.id, record);
      return Promise.resolve();
    },
    executionByIdempotencyKey: (storeId: string, key: string) =>
      Promise.resolve(
        [...world.executions.values()].find(
          (execution) => execution.storeId === storeId && execution.idempotencyKey === key,
        ) ?? null,
      ),
    executionById: (id: string) => Promise.resolve(world.executions.get(id) ?? null),
    saveExecution: (execution: TaskExecutionRecord) => {
      world.executions.set(execution.id, execution);
      return Promise.resolve();
    },
    updateExecutionSyncStatus: () => Promise.resolve(),
    attachExecutionReview: (id: string, review: TaskExecutionReview) => {
      const current = world.executions.get(id);
      if (current !== undefined) world.executions.set(id, { ...current, review });
      return Promise.resolve();
    },
  };
  const workforce = {
    employees: () => Promise.resolve([]),
    employeeByIdempotencyKey: () => Promise.resolve(null),
    assignments: () =>
      Promise.resolve([
        {
          id: 'asg-1',
          storeId: 'store-1',
          employeeId: 'emp-1',
          teamId: 'team-a',
          operationalPositionId: 'pos-1',
          shiftDefinitionId: null,
          validFrom: '2026-08-01',
          validUntil: null,
        },
      ]),
    saveRegistration: () => Promise.resolve(),
    saveAssignment: () => Promise.resolve(),
    updateEmployeeSyncStatus: () => Promise.resolve(),
    teams: () => Promise.resolve([]),
    saveTeam: () => Promise.resolve(),
    positions: () => Promise.resolve([]),
    positionByKey: () => Promise.resolve(null),
    savePosition: () => Promise.resolve(),
    updatePositionSyncStatus: () => Promise.resolve(),
  };
  const evidenceRepo = {
    byDailyTask: (storeId: string, dailyTaskId: string) =>
      Promise.resolve(
        [...world.evidence.values()].filter(
          (record) => record.storeId === storeId && record.dailyTaskId === dailyTaskId,
        ),
      ),
    byIds: (ids: readonly string[]) =>
      Promise.resolve(
        ids
          .map((id) => world.evidence.get(id))
          .filter((record): record is EvidenceRecord => record !== undefined),
      ),
    save: (record: EvidenceRecord) => {
      world.evidence.set(record.id, record);
      return Promise.resolve();
    },
    updateSyncStatus: () => Promise.resolve(),
  };
  const blobStore = {
    put: (key: string, blob: Blob) => {
      world.blobs.set(key, blob);
      return Promise.resolve();
    },
    get: (key: string) => Promise.resolve(world.blobs.get(key) ?? null),
    remove: (key: string) => {
      world.blobs.delete(key);
      return Promise.resolve();
    },
  };
  const sharedQueue = {
    enqueueStartDailyTask: (input: { idempotencyKey: string }) => {
      world.enqueued.push(input.idempotencyKey);
      return Promise.resolve();
    },
    enqueueReviewExecution: (input: { idempotencyKey: string }) => {
      world.enqueued.push(input.idempotencyKey);
      return Promise.resolve();
    },
    enqueueEvidence: (input: { evidence: EvidenceRecord }) => {
      world.enqueued.push(`evidence:${input.evidence.id}`);
      return Promise.resolve();
    },
  };
  const assignQueue = {
    enqueueAssignDailyTask: (input: { dailyTask: DailyTaskRecord }) => {
      world.enqueued.push(`assign:${input.dailyTask.id}`);
      return Promise.resolve();
    },
  };
  const executionQueue = {
    enqueueTaskExecution: (input: { execution: TaskExecutionRecord }) => {
      world.enqueued.push(`execution:${input.execution.idempotencyKey}`);
      return Promise.resolve();
    },
  };
  const audit = {
    record: (input: WorkforceAuditInput) => {
      world.audits.push(input);
      return Promise.resolve();
    },
  };
  const schedule = { isPositionScheduled: () => Promise.resolve(actorScheduled) };
  let counter = 0;
  const clock = { now: () => NOW };
  const ids = { uuid: () => `uuid-${String(++counter).padStart(2, '0')}` };
  world.claim = new ClaimDailyTaskUseCase(clock, ids, repository, workforce, schedule, assignQueue);
  world.start = new StartDailyTaskUseCase(clock, ids, repository, workforce, sharedQueue);
  world.record = new RecordTaskOutcomeUseCase(clock, ids, repository, executionQueue, evidenceRepo);
  world.review = new ReviewTaskExecutionUseCase(clock, ids, repository, sharedQueue, audit);
  world.addEvidence = new AddTaskEvidenceUseCase(
    clock,
    ids,
    repository,
    evidenceRepo,
    blobStore,
    sharedQueue,
  );
  return world;
}

const deviceId = 'device-A';

async function runFullExecution(world: World): Promise<TaskExecutionRecord> {
  await world.claim.execute({
    authorization: auth(),
    deviceId,
    dailyTaskId: 'task-1',
    workDate: WORK_DATE,
    claimedOffline: false,
  });
  await world.start.execute({
    authorization: auth(),
    deviceId,
    dailyTaskId: 'task-1',
    workDate: WORK_DATE,
    startedOffline: false,
  });
  const added = await world.addEvidence.execute({
    authorization: auth(),
    deviceId,
    dailyTaskId: 'task-1',
    blob: new Blob(['foto'], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    capturedOffline: false,
  });
  if (added.kind !== 'added') throw new Error('evidência não adicionada');
  const recorded = await world.record.execute({
    authorization: auth(),
    dailyTaskId: 'task-1',
    operatorSessionId: 'sess-1',
    deviceId,
    kind: 'complete',
    numericValue: null,
    notes: 'Produto armazenado na câmara 2.',
    hasEvidence: false,
    evidenceIds: [added.evidence.id],
    performedOffline: false,
  });
  if (recorded.kind !== 'recorded') throw new Error(`esperava recorded: ${recorded.kind}`);
  return recorded.execution;
}

describe('assumir → iniciar → evidência → enviar (ciclo do operador)', () => {
  it('cobre autoria, horário real, evidência vinculada e AGUARDANDO CONFERÊNCIA', async () => {
    const world = makeWorld(baseTask());
    const execution = await runFullExecution(world);

    const task = world.tasks.get('task-1');
    expect(task?.assignedPositionId).toBe('pos-1'); // assumida pela posição do ator
    expect(task?.status).toBe('AWAITING_REVIEW'); // requiresReview=true
    expect(task?.startedAt).toBe(NOW.toISOString());
    expect(task?.startedByEmployeeId).toBe('emp-1');
    expect(execution.performedByEmployeeId).toBe('emp-1');
    expect(execution.startedAt).toBe(NOW.toISOString());
    expect(execution.resultingStatus).toBe('AWAITING_REVIEW');
    expect(execution.notes).toBe('Produto armazenado na câmara 2.');
    // evidência vinculada à execução no envio
    const evidence = [...world.evidence.values()][0];
    expect(evidence?.executionId).toBe(execution.id);
    expect(world.blobs.size).toBe(1);
  });

  it('sem escalação o claim é negado; duplo start/claim convergem', async () => {
    const notScheduled = makeWorld(baseTask(), false);
    expect(
      await notScheduled.claim.execute({
        authorization: auth(),
        deviceId,
        dailyTaskId: 'task-1',
        workDate: WORK_DATE,
        claimedOffline: false,
      }),
    ).toMatchObject({ kind: 'failed', code: 'ACTOR_NOT_SCHEDULED' });

    const world = makeWorld(baseTask());
    await runFullExecution(world);
    // replays não duplicam nada
    const claimAgain = await world.claim.execute({
      authorization: auth(),
      deviceId,
      dailyTaskId: 'task-1',
      workDate: WORK_DATE,
      claimedOffline: false,
    });
    expect(claimAgain.kind).toBe('already-claimed');
    const submitAgain = await world.record.execute({
      authorization: auth(),
      dailyTaskId: 'task-1',
      operatorSessionId: 'sess-1',
      deviceId,
      kind: 'complete',
      numericValue: null,
      notes: null,
      hasEvidence: true,
      performedOffline: false,
    });
    expect(submitAgain.kind).toBe('already-recorded');
    expect(world.executions.size).toBe(1);
  });

  it('requiresPhoto bloqueia envio sem evidência; requiresReview=false conclui direto', async () => {
    const world = makeWorld(baseTask({ assignedPositionId: 'pos-1' }));
    await world.start.execute({
      authorization: auth(),
      deviceId,
      dailyTaskId: 'task-1',
      workDate: WORK_DATE,
      startedOffline: false,
    });
    expect(
      await world.record.execute({
        authorization: auth(),
        dailyTaskId: 'task-1',
        operatorSessionId: 'sess-1',
        deviceId,
        kind: 'complete',
        numericValue: null,
        notes: null,
        hasEvidence: false,
        performedOffline: false,
      }),
    ).toMatchObject({ kind: 'failed', code: 'EVIDENCE_REQUIRED' });

    const simple = makeWorld(
      baseTask({
        assignedPositionId: 'pos-1',
        template: {
          ...baseTask().template,
          requiresPhoto: false,
          requiresReview: false,
        },
      }),
    );
    const done = await simple.record.execute({
      authorization: auth(),
      dailyTaskId: 'task-1',
      operatorSessionId: 'sess-1',
      deviceId,
      kind: 'complete',
      numericValue: null,
      notes: null,
      hasEvidence: false,
      performedOffline: false,
    });
    expect(done.kind).toBe('recorded');
    expect(simple.tasks.get('task-1')?.status).toBe('DONE'); // sem gargalo de review
  });
});

describe('conferência do encarregado (capability + segurança)', () => {
  it('operador comum NÃO aprova mesmo chamando o use case (access.denied auditado)', async () => {
    const world = makeWorld(baseTask());
    await runFullExecution(world);
    const denied = await world.review.execute({
      authorization: auth({ operatorEmployeeId: 'emp-2', operatorProfileId: 'prof-2' }),
      deviceId,
      dailyTaskId: 'task-1',
      outcome: 'APPROVED',
      note: null,
      reviewedOffline: false,
    });
    expect(denied).toMatchObject({ kind: 'failed', code: 'PERMISSION_DENIED' });
    expect(world.audits.at(-1)).toMatchObject({
      eventType: 'access.denied',
      errorCode: CAPABILITY_TASK_REVIEW,
    });
    expect(world.tasks.get('task-1')?.status).toBe('AWAITING_REVIEW'); // intacto
  });

  it('encarregado aprova → DONE com reviewer registrado; reaprovação converge', async () => {
    const world = makeWorld(baseTask());
    const execution = await runFullExecution(world);
    const approved = await world.review.execute({
      authorization: reviewerAuth(),
      deviceId,
      dailyTaskId: 'task-1',
      outcome: 'APPROVED',
      note: null,
      reviewedOffline: false,
    });
    expect(approved.kind).toBe('reviewed');
    expect(world.tasks.get('task-1')?.status).toBe('DONE');
    expect(world.executions.get(execution.id)?.review).toMatchObject({
      outcome: 'APPROVED',
      reviewedByEmployeeId: 'emp-9',
      reviewedAt: NOW.toISOString(),
    });
    expect(world.audits.at(-1)).toMatchObject({ eventType: 'admin.action', result: 'success' });

    const again = await world.review.execute({
      authorization: reviewerAuth(),
      deviceId,
      dailyTaskId: 'task-1',
      outcome: 'APPROVED',
      note: null,
      reviewedOffline: false,
    });
    expect(again.kind).toBe('already-reviewed'); // aprovação idempotente
  });

  it('executor com capability ainda NÃO confere o próprio trabalho', async () => {
    const world = makeWorld(baseTask());
    await runFullExecution(world);
    const selfReview = await world.review.execute({
      // mesmo employee do executor, agora com task.review
      authorization: auth({ permissions: ['session.open', CAPABILITY_TASK_REVIEW] }),
      deviceId,
      dailyTaskId: 'task-1',
      outcome: 'APPROVED',
      note: null,
      reviewedOffline: false,
    });
    expect(selfReview).toMatchObject({ kind: 'failed', code: 'REVIEWER_IS_EXECUTOR' });
  });

  it('devolução exige motivo, preserva execução/evidência e reenvio cria NOVA execução', async () => {
    const world = makeWorld(baseTask());
    const first = await runFullExecution(world);

    expect(
      await world.review.execute({
        authorization: reviewerAuth(),
        deviceId,
        dailyTaskId: 'task-1',
        outcome: 'RETURNED',
        note: '   ',
        reviewedOffline: false,
      }),
    ).toMatchObject({ kind: 'failed', code: 'REASON_REQUIRED' });

    const returned = await world.review.execute({
      authorization: reviewerAuth(),
      deviceId,
      dailyTaskId: 'task-1',
      outcome: 'RETURNED',
      note: 'Limpar novamente a parte inferior.',
      reviewedOffline: false,
    });
    expect(returned.kind).toBe('reviewed');
    expect(world.tasks.get('task-1')?.status).toBe('NEEDS_CORRECTION');
    // primeira submissão preservada com o motivo registrado
    expect(world.executions.get(first.id)?.review).toMatchObject({
      outcome: 'RETURNED',
      note: 'Limpar novamente a parte inferior.',
    });
    expect(world.evidence.size).toBe(1);

    // correção: retomar → reenviar (nova execução encadeada, histórico intacto)
    await world.start.execute({
      authorization: auth(),
      deviceId,
      dailyTaskId: 'task-1',
      workDate: WORK_DATE,
      startedOffline: false,
    });
    const resubmitted = await world.record.execute({
      authorization: auth(),
      dailyTaskId: 'task-1',
      operatorSessionId: 'sess-1',
      deviceId,
      kind: 'complete',
      numericValue: null,
      notes: null,
      hasEvidence: true,
      performedOffline: false,
    });
    expect(resubmitted.kind).toBe('recorded');
    if (resubmitted.kind !== 'recorded') return;
    expect(resubmitted.execution.id).not.toBe(first.id);
    expect(resubmitted.execution.supersedesExecutionId).toBe(first.id);
    expect(world.executions.size).toBe(2); // primeira NÃO desapareceu
    expect(world.tasks.get('task-1')?.status).toBe('AWAITING_REVIEW');

    // aprovação final fecha o ciclo
    const finalApproval = await world.review.execute({
      authorization: reviewerAuth(),
      deviceId,
      dailyTaskId: 'task-1',
      outcome: 'APPROVED',
      note: null,
      reviewedOffline: false,
    });
    expect(finalApproval.kind).toBe('reviewed');
    expect(world.tasks.get('task-1')?.status).toBe('DONE');
  });
});

describe('auto-reparo dos replays (falha entre execução e atualização da tarefa)', () => {
  it('reenvio replay repara a tarefa presa em NEEDS_CORRECTION', async () => {
    const world = makeWorld(baseTask());
    const first = await runFullExecution(world);
    await world.review.execute({
      authorization: reviewerAuth(),
      deviceId,
      dailyTaskId: 'task-1',
      outcome: 'RETURNED',
      note: 'Refazer.',
      reviewedOffline: false,
    });
    await world.start.execute({
      authorization: auth(),
      deviceId,
      dailyTaskId: 'task-1',
      workDate: WORK_DATE,
      startedOffline: false,
    });
    const second = await world.record.execute({
      authorization: auth(),
      dailyTaskId: 'task-1',
      operatorSessionId: 'sess-1',
      deviceId,
      kind: 'complete',
      numericValue: null,
      notes: null,
      hasEvidence: true,
      performedOffline: false,
    });
    if (second.kind !== 'recorded') throw new Error('esperava recorded');
    // simula a falha: execução E2 persistiu, mas a tarefa perdeu o save
    const stuck = world.tasks.get('task-1');
    world.tasks.set('task-1', {
      ...(stuck as NonNullable<typeof stuck>),
      status: 'NEEDS_CORRECTION',
      lastExecutionId: first.id,
    });
    // retry do operador converge E repara o estado da ocorrência
    const retry = await world.record.execute({
      authorization: auth(),
      dailyTaskId: 'task-1',
      operatorSessionId: 'sess-1',
      deviceId,
      kind: 'complete',
      numericValue: null,
      notes: null,
      hasEvidence: true,
      performedOffline: false,
    });
    expect(retry.kind).toBe('already-recorded');
    expect(world.tasks.get('task-1')).toMatchObject({
      status: 'AWAITING_REVIEW',
      lastExecutionId: second.execution.id,
    });
    expect(world.executions.size).toBe(2); // nada duplicado
  });

  it('reconferência replay repara a tarefa presa em AWAITING_REVIEW', async () => {
    const world = makeWorld(baseTask());
    await runFullExecution(world);
    await world.review.execute({
      authorization: reviewerAuth(),
      deviceId,
      dailyTaskId: 'task-1',
      outcome: 'APPROVED',
      note: null,
      reviewedOffline: false,
    });
    // simula a falha: review anexada, tarefa perdeu o save
    const stuck = world.tasks.get('task-1');
    world.tasks.set('task-1', {
      ...(stuck as NonNullable<typeof stuck>),
      status: 'AWAITING_REVIEW',
    });
    const retry = await world.review.execute({
      authorization: reviewerAuth(),
      deviceId,
      dailyTaskId: 'task-1',
      outcome: 'APPROVED',
      note: null,
      reviewedOffline: false,
    });
    expect(retry.kind).toBe('already-reviewed');
    expect(world.tasks.get('task-1')?.status).toBe('DONE'); // reparada
  });
});

describe('evidência — validações', () => {
  it('recusa tipo não-imagem e blob vazio', async () => {
    const world = makeWorld(baseTask());
    expect(
      await world.addEvidence.execute({
        authorization: auth(),
        deviceId,
        dailyTaskId: 'task-1',
        blob: new Blob(['x'], { type: 'application/pdf' }),
        mimeType: 'application/pdf',
        capturedOffline: false,
      }),
    ).toMatchObject({ kind: 'failed', code: 'INVALID_TYPE' });
    expect(
      await world.addEvidence.execute({
        authorization: auth(),
        deviceId,
        dailyTaskId: 'task-1',
        blob: new Blob([], { type: 'image/png' }),
        mimeType: 'image/png',
        capturedOffline: false,
      }),
    ).toMatchObject({ kind: 'failed', code: 'TOO_LARGE' });
  });
});
