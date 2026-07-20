// AuditIntegrityVerifier (6.2.8 §7) — cadeia de hash POR PARTIÇÃO (loja).
//
// Estratégia escolhida: hash SHA-256 ENCADEADO por loja, computado
// SERVER-SIDE (trigger no banco; ver migration 20260720150000). O cliente
// nunca calcula hash autoritativo. Este verificador reexecuta a cadeia em
// consultas/investigações e detecta adulteração.
//
// Por quê encadeado por partição (e não hash isolado por evento):
// - hash isolado detecta corrupção do PRÓPRIO registro, mas não remoção nem
//   reordenação; a cadeia detecta ambos dentro da partição.
// - por loja: compatível com multi-tenant, retenção/arquivamento por loja e
//   concorrência (a serialização do head é por loja, não global).
//
// Ameaças MITIGADAS:
// - adulteração de conteúdo de evento persistido (hash quebra dali em diante);
// - remoção/inserção retroativa dentro da partição (encadeamento quebra);
// - cliente forjando recordedAt/ordem (campos autoritativos são do servidor).
// Ameaças NÃO mitigadas (documentadas):
// - superusuário do banco reescrevendo a cadeia INTEIRA de uma loja
//   (mitigação futura: assinatura server-side com chave fora do banco /
//   ancoragem externa periódica do head);
// - apagamento total da partição + head (mitigação: backups/replicação);
// - comprometimento do próprio servidor de aplicação.

import { createHash } from 'node:crypto';

import type { AuditEvent } from './audit-event.js';

/** Serialização canônica p/ hash (ordem de chaves estável). */
export function canonicalizeForHash(event: AuditEvent): string {
  const ordered = Object.keys(event)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = (event as Record<string, unknown>)[k];
      return acc;
    }, {});
  return JSON.stringify(ordered);
}

export function hashEvent(previousHash: string, event: AuditEvent): string {
  return createHash('sha256')
    .update(previousHash)
    .update('|')
    .update(canonicalizeForHash(event))
    .digest('hex');
}

export const CHAIN_GENESIS = 'genesis';

export interface ChainedAuditEvent {
  readonly event: AuditEvent;
  readonly hash: string;
  readonly previousHash: string;
}

export type IntegrityResult =
  | { readonly valid: true; readonly length: number }
  | {
      readonly valid: false;
      readonly brokenAtIndex: number;
      readonly eventId: string;
      readonly reason: 'hash-mismatch' | 'chain-discontinuity';
    };

export interface AuditIntegrityVerifier {
  verify(chain: readonly ChainedAuditEvent[]): IntegrityResult;
}

export class HashChainVerifier implements AuditIntegrityVerifier {
  verify(chain: readonly ChainedAuditEvent[]): IntegrityResult {
    let previous = CHAIN_GENESIS;
    for (let i = 0; i < chain.length; i += 1) {
      const link = chain[i]!;
      if (link.previousHash !== previous) {
        return {
          valid: false,
          brokenAtIndex: i,
          eventId: link.event.eventId,
          reason: 'chain-discontinuity',
        };
      }
      const expected = hashEvent(previous, link.event);
      if (link.hash !== expected) {
        return {
          valid: false,
          brokenAtIndex: i,
          eventId: link.event.eventId,
          reason: 'hash-mismatch',
        };
      }
      previous = link.hash;
    }
    return { valid: true, length: chain.length };
  }
}
