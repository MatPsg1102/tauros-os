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
export {
  activePatternFor,
  currentAssignmentFor,
  daysBetweenCivil,
  resolvePlannedDay,
  teamWorksOn,
} from './schedule/resolve-planned-day.js';
export type {
  CyclePatternView,
  PlannedAssignmentInput,
  PlannedDayDecision,
  PlannedDayEmployee,
  PlannedMemberInput,
  ResolvePlannedDayInput,
  RotatingTeamView,
} from './schedule/resolve-planned-day.js';
export { decideCreateShiftDefinition } from './schedule/create-shift-definition.js';
export type {
  CreatedShiftDefinition,
  CreateShiftDefinitionCommand,
  CreateShiftDefinitionDecision,
  CreateShiftDefinitionRejectionCode,
} from './schedule/create-shift-definition.js';
export { decideChangeWorkPeriod, previousCivilDay } from './schedule/change-work-period.js';
export type {
  ChangeWorkPeriodCommand,
  ChangeWorkPeriodDecision,
  ChangeWorkPeriodRejectionCode,
  ClosedAssignmentPatch,
  CurrentAssignmentView,
  OpenedAssignment,
} from './schedule/change-work-period.js';
export { decideClaimDailyTask } from './daily-task/claim-task.js';
export type {
  ClaimableTaskView,
  ClaimDailyTaskCommand,
  ClaimDailyTaskDecision,
  ClaimDailyTaskRejectionCode,
} from './daily-task/claim-task.js';
export { decideStartDailyTask } from './daily-task/start-task.js';
export type {
  StartableTaskView,
  StartDailyTaskCommand,
  StartDailyTaskDecision,
  StartDailyTaskRejectionCode,
  StartedTaskPatch,
} from './daily-task/start-task.js';
export { decideReviewExecution } from './daily-task/review-execution.js';
export type {
  RecordedReview,
  ReviewableExecutionView,
  ReviewableTaskView,
  ReviewExecutionCommand,
  ReviewExecutionDecision,
  ReviewExecutionRejectionCode,
  TaskReviewOutcome,
} from './daily-task/review-execution.js';
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
