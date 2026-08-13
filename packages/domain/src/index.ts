// @tauros/domain — regras puras (7.1+).
export { decideOpenSession } from './operator-session/open-session.js';
export type {
  ActiveSessionView,
  OpenedSession,
  OpenSessionCommand,
  OpenSessionDecision,
  OpenSessionRejectionCode,
} from './operator-session/open-session.js';
export { decideCloseSession } from './operator-session/close-session.js';
export type {
  ClosableSessionView,
  ClosedSession,
  CloseSessionCommand,
  CloseSessionDecision,
  CloseSessionRejectionCode,
  SessionEndReason,
} from './operator-session/close-session.js';
export { decideCreateTemplate } from './task-template/create-template.js';
export type {
  CreatedTemplate,
  CreateTemplateCommand,
  CreateTemplateDecision,
  CreateTemplateRejectionCode,
  TemplateFrequency,
} from './task-template/create-template.js';
export { EVERY_DAY, shouldMaterialize, weekdayOf } from './task-template/materialization.js';
export type {
  MaterializationContext,
  MaterializationRule,
} from './task-template/materialization.js';
export { decideAssignDailyTask } from './daily-task/assign-task.js';
export type {
  AssignableDailyTask,
  AssignDailyTaskCommand,
  AssignDailyTaskDecision,
  AssignDailyTaskRejectionCode,
} from './daily-task/assign-task.js';
export { decideRegisterEmployee } from './workforce/register-employee.js';
export type {
  RegisteredAssignment,
  RegisteredEmployee,
  RegisterEmployeeCommand,
  RegisterEmployeeDecision,
  RegisterEmployeeRejectionCode,
} from './workforce/register-employee.js';
export { decideCreatePosition } from './workforce/create-position.js';
export type {
  CreatedPosition,
  CreatePositionCommand,
  CreatePositionDecision,
  CreatePositionRejectionCode,
} from './workforce/create-position.js';
export { decideTaskOutcome, isOverdue } from './daily-task/task-outcome.js';
export type {
  DailyTaskStatus,
  DailyTaskView,
  ExecutionResult,
  RecordedExecution,
  TaskOutcomeCommand,
  TaskOutcomeDecision,
  TaskOutcomeKind,
  TaskOutcomeRejectionCode,
} from './daily-task/task-outcome.js';
