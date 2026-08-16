// @tauros/application — casos de uso (7.1+).
export {
  OpenOperatorSessionUseCase,
  operationalDateFor,
} from './operator-session/open-operator-session.js';
export type {
  OpenOperatorSessionFailureCode,
  OpenOperatorSessionInput,
  OpenOperatorSessionResult,
} from './operator-session/open-operator-session.js';
export {
  closeIdempotencyKeyFor,
  CloseOperatorSessionUseCase,
} from './operator-session/close-operator-session.js';
export type {
  CloseOperatorSessionFailureCode,
  CloseOperatorSessionInput,
  CloseOperatorSessionResult,
} from './operator-session/close-operator-session.js';
export { dailyTaskIdFor, LoadDailyTasksUseCase } from './daily-task/load-daily-tasks.js';
export type {
  LoadDailyTasksFailureCode,
  LoadDailyTasksInput,
  LoadDailyTasksResult,
} from './daily-task/load-daily-tasks.js';
export { AssignDailyTaskUseCase } from './daily-task/assign-daily-task.js';
export type {
  AssignDailyTaskFailureCode,
  AssignDailyTaskInput,
  AssignDailyTaskResult,
} from './daily-task/assign-daily-task.js';
export {
  RecordTaskOutcomeUseCase,
  taskOutcomeIdempotencyKeyFor,
} from './daily-task/record-task-outcome.js';
export { ClaimDailyTaskUseCase } from './daily-task/claim-daily-task.js';
export type {
  ClaimDailyTaskFailureCode,
  ClaimDailyTaskInput,
  ClaimDailyTaskResult,
} from './daily-task/claim-daily-task.js';
export {
  StartDailyTaskUseCase,
  taskStartIdempotencyKeyFor,
} from './daily-task/start-daily-task.js';
export type {
  StartDailyTaskFailureCode,
  StartDailyTaskInput,
  StartDailyTaskResult,
} from './daily-task/start-daily-task.js';
export { ReviewTaskExecutionUseCase } from './daily-task/review-task-execution.js';
export type {
  ReviewTaskExecutionFailureCode,
  ReviewTaskExecutionInput,
  ReviewTaskExecutionResult,
} from './daily-task/review-task-execution.js';
export { AddTaskEvidenceUseCase } from './daily-task/add-task-evidence.js';
export type {
  AddTaskEvidenceFailureCode,
  AddTaskEvidenceInput,
  AddTaskEvidenceResult,
} from './daily-task/add-task-evidence.js';
export { storeDayStartFor } from './shared/operational-day.js';
export {
  CreateTaskTemplateUseCase,
  templateIdempotencyKeyFor,
} from './task-template/create-task-template.js';
export type {
  CreateTaskTemplateFailureCode,
  CreateTaskTemplateInput,
  CreateTaskTemplateResult,
} from './task-template/create-task-template.js';
export type {
  RecordTaskOutcomeFailureCode,
  RecordTaskOutcomeInput,
  RecordTaskOutcomeResult,
} from './daily-task/record-task-outcome.js';
export {
  employeeIdempotencyKeyFor,
  RegisterEmployeeUseCase,
} from './workforce/register-employee.js';
export type {
  RegisterEmployeeFailureCode,
  RegisterEmployeeInput,
  RegisterEmployeeResult,
} from './workforce/register-employee.js';
export {
  CreateOperationalPositionUseCase,
  positionKeyFor,
} from './workforce/create-operational-position.js';
export type {
  CreateOperationalPositionFailureCode,
  CreateOperationalPositionInput,
  CreateOperationalPositionResult,
} from './workforce/create-operational-position.js';
export { CreateShiftDefinitionUseCase } from './schedule/create-shift-definition.js';
export type {
  CreateShiftDefinitionFailureCode,
  CreateShiftDefinitionInput,
  CreateShiftDefinitionResult,
} from './schedule/create-shift-definition.js';
export { ChangeEmployeeWorkPeriodUseCase } from './schedule/change-employee-work-period.js';
export type {
  ChangeEmployeeWorkPeriodFailureCode,
  ChangeEmployeeWorkPeriodInput,
  ChangeEmployeeWorkPeriodResult,
} from './schedule/change-employee-work-period.js';
export { LoadPlannedScheduleUseCase } from './schedule/load-planned-schedule.js';
export type {
  LoadPlannedScheduleFailureCode,
  LoadPlannedScheduleInput,
  LoadPlannedScheduleResult,
} from './schedule/load-planned-schedule.js';
export { buildPlannedScheduleDay } from './schedule/planned-day-view.js';
export type { PlannedScheduleDaySources } from './schedule/planned-day-view.js';
