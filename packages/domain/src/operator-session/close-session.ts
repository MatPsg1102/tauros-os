// Domínio: fechamento da sessão operacional ("Fechamento de Turno" — mesmo
// conceito congelado operator_sessions). PURO: sem React, sem browser, sem
// relógio real, sem aleatoriedade. Decisão como união discriminada.

/** session_end_reason do schema congelado (nenhum motivo novo). */
export type SessionEndReason = 'SWITCH' | 'LOGOUT' | 'EXPIRED' | 'STORE_SWITCH';

/** Visão mínima da sessão persistida sobre a qual se decide o fechamento. */
export interface ClosableSessionView {
  readonly id: string;
  readonly storeId: string;
  readonly actorEmployeeId: string;
  readonly deviceId: string;
  readonly operationalDate: string;
  readonly status: 'ACTIVE' | 'CLOSED_LOCAL' | 'CLOSED_CONFIRMED';
  /** Chave da operação de fechamento já registrada (replay idempotente). */
  readonly closeIdempotencyKey: string | null;
}

export interface CloseSessionCommand {
  readonly sessionId: string;
  readonly storeId: string;
  readonly actorEmployeeId: string;
  readonly deviceId: string;
  /** Horário do cliente (clock port da aplicação). */
  readonly clientClosedAt: Date;
  readonly operationalDate: string;
  readonly closedOffline: boolean;
  readonly endReason: SessionEndReason;
  readonly idempotencyKey: string;
}

export type CloseSessionRejectionCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_NOT_ACTIVE'
  | 'STORE_MISMATCH'
  | 'OPERATOR_MISMATCH'
  | 'OPERATIONAL_DATE_MISMATCH'
  | 'INVALID_COMMAND';

export interface ClosedSession {
  readonly id: string;
  readonly storeId: string;
  readonly actorEmployeeId: string;
  readonly deviceId: string;
  readonly clientClosedAt: Date;
  readonly operationalDate: string;
  readonly closedOffline: boolean;
  readonly endReason: SessionEndReason;
  readonly status: 'CLOSED_LOCAL';
  readonly idempotencyKey: string;
}

export type CloseSessionDecision =
  /** A sessão deve ser fechada localmente e o fechamento sincronizado. */
  | { readonly kind: 'closed'; readonly session: ClosedSession }
  /** Reapresentação idempotente do MESMO fechamento (não é erro). */
  | { readonly kind: 'already-closed'; readonly sessionId: string }
  /** Invariante violada — nada deve ser persistido nem enfileirado. */
  | {
      readonly kind: 'rejected';
      readonly code: CloseSessionRejectionCode;
      readonly detail: string;
    };

const OPERATIONAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function missingField(command: CloseSessionCommand): string | null {
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
 * somente uma sessão ACTIVE pode ser fechada, e uma sessão fechada nunca é
 * fechada duas vezes. Reapresentação com a MESMA chave de fechamento é
 * reconhecida como o MESMO fechamento (idempotência).
 */
export function decideCloseSession(
  command: CloseSessionCommand,
  existing: ClosableSessionView | null,
): CloseSessionDecision {
  const missing = missingField(command);
  if (missing !== null) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: `campo obrigatório: ${missing}` };
  }
  if (!OPERATIONAL_DATE_PATTERN.test(command.operationalDate)) {
    return {
      kind: 'rejected',
      code: 'INVALID_COMMAND',
      detail: 'data operacional deve ser YYYY-MM-DD no fuso da loja',
    };
  }
  if (Number.isNaN(command.clientClosedAt.getTime())) {
    return { kind: 'rejected', code: 'INVALID_COMMAND', detail: 'clientClosedAt inválido' };
  }

  if (existing === null) {
    return {
      kind: 'rejected',
      code: 'SESSION_NOT_FOUND',
      detail: 'nenhuma sessão local corresponde ao fechamento solicitado',
    };
  }
  if (existing.id !== command.sessionId) {
    return {
      kind: 'rejected',
      code: 'SESSION_NOT_FOUND',
      detail: 'sessão informada difere da sessão persistida',
    };
  }
  if (existing.storeId !== command.storeId) {
    return { kind: 'rejected', code: 'STORE_MISMATCH', detail: 'sessão pertence a outra loja' };
  }
  if (existing.actorEmployeeId !== command.actorEmployeeId) {
    return {
      kind: 'rejected',
      code: 'OPERATOR_MISMATCH',
      detail: 'sessão pertence a outro funcionário',
    };
  }
  if (existing.operationalDate !== command.operationalDate) {
    return {
      kind: 'rejected',
      code: 'OPERATIONAL_DATE_MISMATCH',
      detail: 'data operacional do fechamento difere da abertura',
    };
  }

  if (existing.status !== 'ACTIVE') {
    // replay do MESMO fechamento devolve o estado atual (idempotência)
    if (existing.closeIdempotencyKey === command.idempotencyKey) {
      return { kind: 'already-closed', sessionId: existing.id };
    }
    return {
      kind: 'rejected',
      code: 'SESSION_NOT_ACTIVE',
      detail: 'este turno já foi fechado',
    };
  }

  return {
    kind: 'closed',
    session: {
      id: existing.id,
      storeId: command.storeId,
      actorEmployeeId: command.actorEmployeeId,
      deviceId: command.deviceId,
      clientClosedAt: command.clientClosedAt,
      operationalDate: command.operationalDate,
      closedOffline: command.closedOffline,
      endReason: command.endReason,
      status: 'CLOSED_LOCAL',
      idempotencyKey: command.idempotencyKey,
    },
  };
}
