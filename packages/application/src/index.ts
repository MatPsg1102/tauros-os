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
export {
  RecordTaskOutcomeUseCase,
  taskOutcomeIdempotencyKeyFor,
} from './daily-task/record-task-outcome.js';
export type {
  RecordTaskOutcomeFailureCode,
  RecordTaskOutcomeInput,
  RecordTaskOutcomeResult,
} from './daily-task/record-task-outcome.js';
