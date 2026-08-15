// Transporte fake determinístico (7.1 §32, ampliado na 7.2) — substitui a
// Edge Function até o backend real, implementando o MESMO SyncTransportPort.
// Sem timers aleatórios. Cenários CONTRATUAIS explícitos: sucesso,
// indisponibilidade, replay, conflito, rejeição de regra, turno já fechado e
// tarefa já concluída em outro aparelho. Trocável pelo adapter real sem tocar
// UI, controllers ou use cases — nenhuma condicional de fake vaza para fora.

import type {
  AssignDailyTaskQueuePayload,
  ChangeWorkPeriodQueuePayload,
  CloseSessionQueuePayload,
  CreatePositionQueuePayload,
  CreateShiftDefinitionQueuePayload,
  CreateTemplateQueuePayload,
  EvidenceQueuePayload,
  OpenSessionQueuePayload,
  RegisterEmployeeQueuePayload,
  ReviewTaskExecutionQueuePayload,
  TaskExecutionQueuePayload,
} from '@tauros/contracts';
import {
  ENTITY_ATTACHMENT,
  ENTITY_DAILY_TASK,
  ENTITY_EMPLOYEE,
  ENTITY_EMPLOYEE_ASSIGNMENT,
  ENTITY_OPERATIONAL_POSITION,
  ENTITY_SHIFT_DEFINITION,
  ENTITY_TASK_EXECUTION,
  ENTITY_TASK_TEMPLATE,
} from '@tauros/contracts';
import type { QueueItem, SubmitOutcome, SyncTransportPort } from '@tauros/infrastructure';

interface ServerSession {
  readonly storeId: string;
  readonly actorEmployeeId: string;
  readonly idempotencyKey: string;
  readonly sessionId: string;
  readonly closed: boolean;
}

export class FakeSessionSyncTransport implements SyncTransportPort {
  /** "Servidor" em memória: sessões ativas por loja+funcionário. */
  private readonly serverSessions = new Map<string, ServerSession>();
  private readonly seenIdempotencyKeys = new Set<string>();
  /** Execuções aceitas por (loja, tarefa) — base do conflito entre aparelhos. */
  private readonly serverExecutions = new Map<string, string>();
  /** Posição responsável aceita por (loja, tarefa) — conflito de "assumir". */
  private readonly serverClaims = new Map<string, string>();
  /** Modo de indisponibilidade (cenário offline/backend fora). */
  available = true;
  submissions = 0;

  /** Pré-carrega um turno aberto "no dispositivo B" (cenário de conflito). */
  seedRemoteSession(session: Omit<ServerSession, 'closed'>): void {
    this.serverSessions.set(this.scopeKey(session.storeId, session.actorEmployeeId), {
      ...session,
      closed: false,
    });
    this.seenIdempotencyKeys.add(session.idempotencyKey);
  }

  /** Pré-carrega um turno JÁ FECHADO no servidor (cenário 7.2). */
  seedRemoteClosedSession(session: Omit<ServerSession, 'closed'>): void {
    this.serverSessions.set(this.scopeKey(session.storeId, session.actorEmployeeId), {
      ...session,
      closed: true,
    });
  }

  /** Pré-carrega uma tarefa concluída em OUTRO aparelho (cenário 7.2). */
  seedRemoteExecution(storeId: string, dailyTaskId: string, executionId: string): void {
    this.serverExecutions.set(this.taskKey(storeId, dailyTaskId), executionId);
  }

  /** Pré-carrega uma tarefa já ASSUMIDA em outro aparelho (concorrência). */
  seedRemoteClaim(storeId: string, dailyTaskId: string, positionId: string): void {
    this.serverClaims.set(this.taskKey(storeId, dailyTaskId), positionId);
  }

  submit(item: QueueItem): Promise<SubmitOutcome> {
    this.submissions += 1;
    if (!this.available) {
      return Promise.resolve({
        kind: 'transient',
        message: 'backend indisponível (fake)',
        authExpired: false,
      });
    }
    // replay idempotente: chave já aplicada ⇒ sucesso (dedupe = persisted)
    if (this.seenIdempotencyKeys.has(item.idempotencyKey)) {
      return Promise.resolve({ kind: 'persisted' });
    }
    if (item.entityType === ENTITY_TASK_EXECUTION) {
      return Promise.resolve(
        item.operation === 'update' ? this.submitExecutionReview(item) : this.submitExecution(item),
      );
    }
    if (item.entityType === ENTITY_DAILY_TASK) {
      return Promise.resolve(this.submitDailyTaskUpdate(item));
    }
    if (item.entityType === ENTITY_ATTACHMENT) {
      return Promise.resolve(this.submitEvidence(item));
    }
    if (item.entityType === ENTITY_TASK_TEMPLATE) {
      return Promise.resolve(this.submitTemplate(item));
    }
    if (item.entityType === ENTITY_EMPLOYEE) {
      return Promise.resolve(this.submitRegisterEmployee(item));
    }
    if (item.entityType === ENTITY_OPERATIONAL_POSITION) {
      return Promise.resolve(this.submitCreatePosition(item));
    }
    if (item.entityType === ENTITY_SHIFT_DEFINITION) {
      return Promise.resolve(this.submitCreateShiftDefinition(item));
    }
    if (item.entityType === ENTITY_EMPLOYEE_ASSIGNMENT) {
      return Promise.resolve(this.submitChangeWorkPeriod(item));
    }
    if (item.operation === 'update') {
      return Promise.resolve(this.submitSessionClose(item));
    }
    return Promise.resolve(this.submitSessionOpen(item));
  }

  private submitSessionOpen(item: QueueItem): SubmitOutcome {
    const payload = item.payload as OpenSessionQueuePayload;
    const record = payload.record;
    const scope = this.scopeKey(record.storeId, record.actorEmployeeId);
    const existing = this.serverSessions.get(scope);
    if (existing !== undefined && existing.idempotencyKey !== record.idempotencyKey) {
      return {
        kind: 'conflict',
        classification: 'idempotency_divergence',
        remoteEvidence: { sessionId: existing.sessionId },
        message: 'turno já aberto em outro dispositivo',
      };
    }
    this.serverSessions.set(scope, {
      storeId: record.storeId,
      actorEmployeeId: record.actorEmployeeId,
      idempotencyKey: record.idempotencyKey,
      sessionId: record.id,
      closed: false,
    });
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitSessionClose(item: QueueItem): SubmitOutcome {
    const payload = item.payload as CloseSessionQueuePayload;
    const scope = this.scopeKey(payload.storeId, payload.actorEmployeeId);
    const existing = this.serverSessions.get(scope);
    if (existing === undefined) {
      // rejeição de regra: nunca reenviar (o servidor não conhece este turno)
      return { kind: 'rejected', message: 'turno inexistente no servidor' };
    }
    if (existing.closed) {
      // já fechado lá: desfecho de conflito, o local é preservado p/ revisão
      return {
        kind: 'conflict',
        classification: 'idempotency_divergence',
        remoteEvidence: { sessionId: existing.sessionId },
        message: 'turno já fechado em outro dispositivo',
      };
    }
    this.serverSessions.set(scope, { ...existing, closed: true });
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitTemplate(item: QueueItem): SubmitOutcome {
    const payload = item.payload as CreateTemplateQueuePayload;
    // config.write é revalidada pelo SERVIDOR (RLS congelada): o snapshot de
    // autorização do item precisa carregar a capacidade.
    if (!item.authorization.permissions.includes('config.write')) {
      return { kind: 'rejected', message: 'sem permissão para criar definição de tarefa' };
    }
    if (payload.template.title.trim() === '') {
      return { kind: 'rejected', message: 'definição inválida' };
    }
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitRegisterEmployee(item: QueueItem): SubmitOutcome {
    const payload = item.payload as RegisterEmployeeQueuePayload;
    // workforce.write é revalidada pelo SERVIDOR: o snapshot de autorização
    // do item precisa carregar a capacidade (ADR-018).
    if (!item.authorization.permissions.includes('workforce.write')) {
      return { kind: 'rejected', message: 'sem permissão para cadastrar colaborador' };
    }
    if (payload.employee.fullName.trim() === '') {
      return { kind: 'rejected', message: 'cadastro inválido' };
    }
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitCreatePosition(item: QueueItem): SubmitOutcome {
    const payload = item.payload as CreatePositionQueuePayload;
    // posição é dado configurável (ADR-019): config.write na RLS congelada
    if (!item.authorization.permissions.includes('config.write')) {
      return { kind: 'rejected', message: 'sem permissão para criar posição' };
    }
    if (payload.position.name.trim() === '') {
      return { kind: 'rejected', message: 'posição inválida' };
    }
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitCreateShiftDefinition(item: QueueItem): SubmitOutcome {
    const payload = item.payload as CreateShiftDefinitionQueuePayload;
    // jornada é dado configurável (ADR-019): config.write na RLS congelada
    if (!item.authorization.permissions.includes('config.write')) {
      return { kind: 'rejected', message: 'sem permissão para criar jornada' };
    }
    if (payload.definition.startTime.trim() === '' || payload.definition.endTime.trim() === '') {
      return { kind: 'rejected', message: 'jornada inválida' };
    }
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitChangeWorkPeriod(item: QueueItem): SubmitOutcome {
    const payload = item.payload as ChangeWorkPeriodQueuePayload;
    // vínculo do colaborador é RH operacional: workforce.write no servidor
    if (!item.authorization.permissions.includes('workforce.write')) {
      return { kind: 'rejected', message: 'sem permissão para alterar vínculo' };
    }
    if (payload.openedAssignment.shiftDefinitionId === null) {
      return { kind: 'rejected', message: 'troca de jornada sem jornada' };
    }
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitExecution(item: QueueItem): SubmitOutcome {
    const payload = item.payload as TaskExecutionQueuePayload;
    const execution = payload.execution;
    const key = this.taskKey(execution.storeId, execution.dailyTaskId);
    const remote = this.serverExecutions.get(key);
    // reenvio pós-devolução declara a execução que substitui — não conflita
    if (
      remote !== undefined &&
      remote !== execution.id &&
      (execution.supersedesExecutionId ?? null) !== remote
    ) {
      return {
        kind: 'conflict',
        classification: 'idempotency_divergence',
        remoteEvidence: { executionId: remote },
        message: 'tarefa já concluída em outro dispositivo',
      };
    }
    this.serverExecutions.set(key, execution.id);
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  /** Conferência (update): o servidor revalida a capability oficial. */
  private submitExecutionReview(item: QueueItem): SubmitOutcome {
    const payload = item.payload as ReviewTaskExecutionQueuePayload;
    if (!item.authorization.permissions.includes('task.review')) {
      return { kind: 'rejected', message: 'sem permissão para conferir execução' };
    }
    if (payload.execution.review == null) {
      return { kind: 'rejected', message: 'conferência sem desfecho' };
    }
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  /**
   * Update da OCORRÊNCIA (atribuição situacional, assumir, iniciar).
   * Conflito contratual: dois aparelhos assumindo a MESMA tarefa para
   * posições diferentes divergem — preserva dados e pede revisão.
   */
  private submitDailyTaskUpdate(item: QueueItem): SubmitOutcome {
    const payload = item.payload as AssignDailyTaskQueuePayload;
    const task = payload.dailyTask;
    const key = this.taskKey(task.storeId, task.id);
    const claimed = this.serverClaims.get(key);
    const incoming = task.assignedPositionId ?? null;
    if (claimed !== undefined && incoming !== null && claimed !== incoming) {
      return {
        kind: 'conflict',
        classification: 'idempotency_divergence',
        remoteEvidence: { assignedPositionId: claimed },
        message: 'tarefa já assumida em outro dispositivo',
      };
    }
    if (incoming !== null) this.serverClaims.set(key, incoming);
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private submitEvidence(item: QueueItem): SubmitOutcome {
    const payload = item.payload as EvidenceQueuePayload;
    if (!payload.evidence.mimeType.startsWith('image/')) {
      return { kind: 'rejected', message: 'evidência inválida' };
    }
    this.seenIdempotencyKeys.add(item.idempotencyKey);
    return { kind: 'persisted' };
  }

  private scopeKey(storeId: string, employeeId: string): string {
    return `${storeId}::${employeeId}`;
  }

  private taskKey(storeId: string, dailyTaskId: string): string {
    return `${storeId}::${dailyTaskId}`;
  }
}
