// @tauros/contracts — contratos compartilhados entre camadas (7.1+).
export {
  CAPABILITY_CONFIG_WRITE,
  CAPABILITY_SESSION_CLOSE,
  CAPABILITY_SESSION_OPEN,
  CAPABILITY_TASK_REVIEW,
  CAPABILITY_WORKFORCE_WRITE,
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
  AssignDailyTaskQueuePayload,
  DailyTaskRecord,
  DailyTaskStatus,
  ExecutionResult,
  ExecutionSource,
  ReviewTaskExecutionQueuePayload,
  StartDailyTaskQueuePayload,
  TaskExecutionQueuePayload,
  TaskExecutionRecord,
  TaskExecutionReview,
  TaskFrequency,
  TaskReviewOutcome,
  TaskSyncStatus,
  TaskTemplateSnapshot,
} from './daily-task/record.js';
export type {
  DailyTaskAssignEnqueueInput,
  DailyTaskAssignEnqueuePort,
  DailyTaskAuditInput,
  DailyTaskAuditPort,
  DailyTaskRepositoryPort,
  ReviewTaskExecutionEnqueueInput,
  SharedOperationEnqueuePort,
  ShiftSchedulePort,
  StartDailyTaskEnqueueInput,
  TaskExecutionEnqueueInput,
  TaskExecutionEnqueuePort,
  TaskTemplateSourcePort,
} from './daily-task/ports.js';
export { ENTITY_ATTACHMENT } from './evidence/record.js';
export type {
  EvidenceQueuePayload,
  EvidenceRecord,
  EvidenceSyncStatus,
} from './evidence/record.js';
export type { EvidenceBlobStorePort, EvidenceRepositoryPort } from './evidence/ports.js';
export { ALL_WEEKDAYS } from './task-template/recurrence.js';
export type { RecurrenceKind, TaskRecurrence, Weekday } from './task-template/recurrence.js';
export { ENTITY_TASK_TEMPLATE } from './task-template/record.js';
export type {
  CreateTemplateQueuePayload,
  TaskTemplateRecord,
  TemplateSyncStatus,
} from './task-template/record.js';
export type {
  OperationalPositionView,
  TaskTemplateRepositoryPort,
  TeamDirectoryPort,
  TeamMemberView,
  TemplateAuditInput,
  TemplateAuditPort,
  TemplateEnqueueInput,
  TemplateEnqueuePort,
} from './task-template/ports.js';
export { ENTITY_EMPLOYEE, ENTITY_OPERATIONAL_POSITION } from './workforce/record.js';
export type {
  CreatePositionQueuePayload,
  EmployeeAssignmentRecord,
  EmployeeRecord,
  OperationalPositionRecord,
  RegisterEmployeeQueuePayload,
  TeamRecord,
  WorkforceSyncStatus,
} from './workforce/record.js';
export type {
  CreatePositionEnqueueInput,
  RegisterEmployeeEnqueueInput,
  WorkforceAuditInput,
  WorkforceAuditPort,
  WorkforceEnqueuePort,
  WorkforceRepositoryPort,
} from './workforce/ports.js';
export { ENTITY_EMPLOYEE_ASSIGNMENT, ENTITY_SHIFT_DEFINITION } from './schedule/record.js';
export type {
  ChangeWorkPeriodQueuePayload,
  CreateShiftDefinitionQueuePayload,
  ScheduleSyncStatus,
  ShiftDefinitionRecord,
  ShiftPatternDayView,
  ShiftPatternRecord,
} from './schedule/record.js';
export type {
  ChangeWorkPeriodEnqueueInput,
  CreateShiftDefinitionEnqueueInput,
  PlannedEmployeeView,
  PlannedScheduleDay,
  PlannedTeamView,
  PlannedWorkPeriodView,
  ScheduleEnqueuePort,
  ScheduleRepositoryPort,
  ScheduleResolutionSources,
} from './schedule/ports.js';
export { ENTITY_OPERATIONAL_CREDENTIAL, ENTITY_PIN_LOCKOUT } from './identity/record.js';
export type {
  CredentialStatus,
  OperationalCredentialRecord,
  PinLockoutState,
} from './identity/record.js';
export type {
  CredentialProvisioningPort,
  CredentialVerification,
  IdentityRejectionCode,
  IdentityResult,
  IdentityVerificationInput,
  OperationalCredentialPort,
  OperatorIdentityPort,
  PinLockoutStorePort,
  PinPolicy,
  PinPolicyPort,
  ProvisioningResult,
  UpsertCredentialInput,
} from './identity/ports.js';
