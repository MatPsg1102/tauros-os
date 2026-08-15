// Domínio: abertura de sessão operacional ("Abertura de Turno" — conceito
// congelado operator_sessions). PURO: sem React, sem browser, sem relógio
// real, sem aleatoriedade — tudo chega pelo comando (clock/id injetados na
// aplicação). Decisão como união discriminada (serialização estável).

/** Visão mínima da sessão ativa existente (invariante de unicidade). */
export interface ActiveSessionView {
  readonly id: string;
  readonly storeId: string;
  readonly actorEmployeeId: string;
  readonly idempotencyKey: string;
  readonly status: 'ACTIVE';
}

export interface OpenSessionCommand {
  /** UUID definitivo gerado no cliente (id generator port). */
  readonly sessionId: string;
  readonly storeId: string;
  readonly membershipId: string | null;
  /** Identidade de plataforma — null até provisionamento server-side (ADR-021). */
  readonly actorProfileId: string | null;
  /** Autoria operacional OBRIGATÓRIA (ADR-021). */
  readonly actorEmployeeId: string;
  readonly deviceId: string;
  /** Horário do cliente (clock port da aplicação). */
  readonly clientOpenedAt: Date;
  /** Data operacional civil YYYY-MM-DD no fuso da LOJA (calculada fora). */
  readonly operationalDate: string;
  readonly openedOffline: boolean;
  readonly idempotencyKey: string;
}

export type OpenSessionRejectionCode =
  'SESSION_ALREADY_ACTIVE' | 'INVALID_COMMAND' | 'INVALID_OPERATIONAL_DATE';

export interface OpenedSession {
  readonly id: string;
  readonly storeId: string;
  readonly membershipId: string | null;
  /** Identidade de plataforma — null até provisionamento server-side (ADR-021). */
  readonly actorProfileId: string | null;
  /** Autoria operacional OBRIGATÓRIA (ADR-021). */
  readonly actorEmployeeId: string;
  readonly deviceId: string;
  readonly clientOpenedAt: Date;
  readonly operationalDate: string;
  readonly openedOffline: boolean;
  readonly status: 'ACTIVE';
  readonly idempotencyKey: string;
}

export type OpenSessionDecision =
  /** Nova sessão deve ser criada. */
  | { readonly kind: 'open'; readonly session: OpenedSession }
  /** Reapresentação idempotente do MESMO comando (não é erro). */
  | { readonly kind: 'already-open'; readonly sessionId: string }
  /** Invariante violada — nada deve ser persistido nem enfileirado. */
  | {
      readonly kind: 'rejected';
      readonly code: OpenSessionRejectionCode;
      readonly detail: string;
    };

const OPERATIONAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function missingField(command: OpenSessionCommand): string | null {
  // actorProfileId é identidade de PLATAFORMA opcional (ADR-021): null até
  // provisionamento. A autoria operacional obrigatória é actorEmployeeId.
  const required: readonly (readonly [string, string])[] = [
    ['sessionId', command.sessionId],
    ['storeId', command.storeId],
    ['actorEmployeeId', command.actorEmployeeId],
    ['deviceId', command.deviceId],
    ['idempotencyKey', command.idempotencyKey],
  ];
  for (const [name, value] of required) {
    if (value.trim() === '') return name;
  }
  return null;
}

/**
 * Regra de domínio (invariável — NÃO é parâmetro de configuração):
 * no máximo UMA sessão ACTIVE por (loja, funcionário). Reapresentação com a
 * mesma idempotencyKey é reconhecida como a MESMA abertura (idempotência).
 */
export function decideOpenSession(
  command: OpenSessionCommand,
  existingActive: ActiveSessionView | null,
): OpenSessionDecision {
  const missing = missingField(command);
  if (missing !== null) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: `campo obrigatório: ${missing}` };
  }
  if (!OPERATIONAL_DATE_PATTERN.test(command.operationalDate)) {
    return {
      kind: 'rejected',
      code: 'INVALID_OPERATIONAL_DATE',
      detail: 'data operacional deve ser YYYY-MM-DD no fuso da loja',
    };
  }
  if (Number.isNaN(command.clientOpenedAt.getTime())) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'clientOpenedAt inválido' };
  }

  if (existingActive !== null) {
    if (
      existingActive.storeId === command.storeId &&
      existingActive.actorEmployeeId === command.actorEmployeeId &&
      existingActive.idempotencyKey === command.idempotencyKey
    ) {
      return { kind: 'already-open', sessionId: existingActive.id };
    }
    return {
      kind: 'rejected',
      code: 'SESSION_ALREADY_ACTIVE',
      detail: 'já existe sessão ativa para este funcionário nesta loja',
    };
  }

  return {
    kind: 'open',
    session: {
      id: command.sessionId,
      storeId: command.storeId,
      membershipId: command.membershipId,
      actorProfileId: command.actorProfileId,
      actorEmployeeId: command.actorEmployeeId,
      deviceId: command.deviceId,
      clientOpenedAt: command.clientOpenedAt,
      operationalDate: command.operationalDate,
      openedOffline: command.openedOffline,
      status: 'ACTIVE',
      idempotencyKey: command.idempotencyKey,
    },
  };
}
