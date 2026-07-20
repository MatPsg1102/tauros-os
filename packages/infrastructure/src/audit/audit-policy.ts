// Política de auditoria (6.2.8 §2/§13) — o critério FORMAL que separa
// log técnico (diagnóstico, retenção curta) de evento de AUDITORIA
// (autoria/decisão/investigação). Nem todo evento técnico é promovido.

import type { TechnicalEvent } from '../offline/events.js';

/** Categorias de retenção (§11) — valores concretos são decisão de negócio. */
export type AuditCategory =
  | 'security' // autenticação, permissões, acesso negado
  | 'configuration' // mudanças de config/políticas/papéis
  | 'operational' // operações offline concluídas/conflitos/rejeições
  | 'administration' // ações administrativas, exportações, migrations
  | 'audit-infra'; // mudanças na própria infraestrutura de auditoria

/**
 * Catálogo OBRIGATÓRIO (§13): eventos que SEMPRE são auditáveis.
 * Ações triviais sem valor investigativo não entram (volume ≠ valor).
 */
export const MANDATORY_AUDIT_EVENTS: Readonly<Record<string, AuditCategory>> = {
  'auth.login.success': 'security',
  'auth.login.failure': 'security',
  'auth.session.ended': 'security',
  'auth.session.expired': 'security',
  'access.permission.changed': 'security',
  'access.role.changed': 'security',
  'access.denied': 'security',
  'config.changed': 'configuration',
  'policy.changed': 'configuration',
  'store.switched': 'security',
  'offline.operation.created': 'operational',
  'offline.operation.completed': 'operational',
  'offline.conflict.detected': 'operational',
  'offline.review.required': 'operational',
  'server.rejection': 'operational',
  'admin.action': 'administration',
  'data.sensitive.changed': 'administration',
  'data.exported': 'administration',
  'db.migration.applied': 'administration',
  'db.destructive.action': 'administration',
  'audit.infra.changed': 'audit-infra',
};

/**
 * Promoção de eventos TÉCNICOS da fila offline (6.2.7) a eventos auditáveis.
 * Critério: só o que carrega autoria/decisão/resultado final — transições de
 * diagnóstico (retries intermediários, cache, conectividade) ficam como log.
 */
const PROMOTED_TECHNICAL_EVENTS: Readonly<Record<string, string>> = {
  item_enqueued: 'offline.operation.created',
  sync_finished: 'offline.operation.completed',
  conflict_detected: 'offline.conflict.detected',
  review_required: 'offline.review.required',
  item_failed: 'server.rejection',
  item_discarded: 'server.rejection',
  item_quarantined: 'audit.infra.changed',
  cycle_detected: 'audit.infra.changed',
  database_destroyed: 'db.destructive.action',
};

export interface AuditPolicy {
  /** O evento técnico deve virar evento de auditoria? */
  shouldPromote(event: TechnicalEvent): boolean;
  /** Tipo canônico do evento promovido. */
  promotedType(event: TechnicalEvent): string;
  categoryOf(eventType: string): AuditCategory | undefined;
}

export class DefaultAuditPolicy implements AuditPolicy {
  shouldPromote(event: TechnicalEvent): boolean {
    return event.eventType in PROMOTED_TECHNICAL_EVENTS;
  }

  promotedType(event: TechnicalEvent): string {
    const type = PROMOTED_TECHNICAL_EVENTS[event.eventType];
    if (type === undefined) {
      throw new Error(
        `Evento técnico "${event.eventType}" não é promovível. ` +
          `Consulte PROMOTED_TECHNICAL_EVENTS/MANDATORY_AUDIT_EVENTS.`,
      );
    }
    return type;
  }

  categoryOf(eventType: string): AuditCategory | undefined {
    return MANDATORY_AUDIT_EVENTS[eventType];
  }
}
