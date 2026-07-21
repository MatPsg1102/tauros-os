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
