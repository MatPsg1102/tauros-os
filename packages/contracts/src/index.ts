// @tauros/contracts — contratos compartilhados entre camadas (7.1+).
export {
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
  SessionEnqueueInput,
  SessionEnqueuePort,
  SessionOpeningPolicy,
  SessionPolicyPort,
} from './operator-session/ports.js';
export { ENTITY_OPERATOR_SESSION } from './operator-session/record.js';
export type {
  OpenSessionQueuePayload,
  OperatorSessionRecord,
  SessionSyncStatus,
} from './operator-session/record.js';
