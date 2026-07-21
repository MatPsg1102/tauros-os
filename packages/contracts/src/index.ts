// @tauros/contracts — contratos compartilhados entre camadas (7.1+).
export {
  CAPABILITY_SESSION_CLOSE,
  CAPABILITY_SESSION_OPEN,
  PERMISSION_MODEL_VERSION,
} from './operator-session/capabilities.js';
export type {
  ClockPort,
  EffectiveAuthorization,
  IdGeneratorPort,
  OperatorSessionRepositoryPort,
  SessionAuditInput,
  SessionAuditPort,
  SessionCloseEnqueueInput,
  SessionClosingPolicy,
  SessionEnqueueInput,
  SessionEnqueuePort,
  SessionOpeningPolicy,
  SessionPolicyPort,
} from './operator-session/ports.js';
export { ENTITY_OPERATOR_SESSION } from './operator-session/record.js';
export type {
  CloseSessionQueuePayload,
  OpenSessionQueuePayload,
  OperatorSessionRecord,
  OperatorSessionStatus,
  SessionEndReason,
  SessionSyncStatus,
} from './operator-session/record.js';
export type { LocalSyncStatus } from './sync/status.js';
export { ENTITY_DAILY_TASK, ENTITY_TASK_EXECUTION } from './daily-task/record.js';
export type {
  DailyTaskRecord,
  DailyTaskStatus,
  ExecutionResult,
  ExecutionSource,
  TaskExecutionQueuePayload,
  TaskExecutionRecord,
  TaskFrequency,
  TaskSyncStatus,
  TaskTemplateSnapshot,
} from './daily-task/record.js';
export type {
  DailyTaskRepositoryPort,
  TaskExecutionEnqueueInput,
  TaskExecutionEnqueuePort,
  TaskTemplateSourcePort,
} from './daily-task/ports.js';
