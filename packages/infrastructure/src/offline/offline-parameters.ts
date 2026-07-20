// Parâmetros técnicos da infraestrutura offline (§4) — contrato ÚNICO, tipado,
// validado e documentado. Sem números mágicos espalhados.
//
// Classificação (auditoria da 6.2.7):
// ┌───────────────────────────┬──────────────────────────────────────────────┐
// │ Parâmetro                 │ Classificação                                │
// ├───────────────────────────┼──────────────────────────────────────────────┤
// │ retry/backoff/jitter      │ Baseline oficial (sync.retry.*) — já coberto │
// │ concorrência (batch)      │ Baseline oficial (sync.concurrency.max)      │
// │ snapshotTtlMs             │ Obrigatório de composição — o wiring DERIVA  │
// │                           │ do Baseline (auth.pin.offlineValidityMs /    │
// │                           │ session.absoluteMaxMs). Não é chave nova.    │
// │ leaseTtlMs                │ Técnico interno estável (default 60s)        │
// │ syncedRetentionMs         │ Técnico interno estável (default 24h)        │
// │ maxConflictRecords        │ Técnico interno estável (default 200)        │
// │ maxPayloadBytes           │ Técnico interno estável (default 1 MiB)      │
// │ intervalo do scheduler    │ N/A — drain é dirigido a eventos, sem polling│
// │ tempo de reclaim          │ N/A — derivado da expiração da lease         │
// └───────────────────────────┴──────────────────────────────────────────────┘
// Nenhum destes vira chave do Baseline sem proposta aprovada (ADR-019).

export interface OfflineTechnicalParameters {
  /** Identificador desta instância de processamento (lease owner). */
  readonly instanceId: string;
  /** TTL da lease de processamento; expirada ⇒ recuperável após crash. */
  readonly leaseTtlMs: number;
  /** Retenção de itens SYNCED antes da limpeza segura. */
  readonly syncedRetentionMs: number;
  /** Máximo de registros de conflito mantidos localmente. */
  readonly maxConflictRecords: number;
  /** Tamanho máximo aceito de payload serializado (bytes). */
  readonly maxPayloadBytes: number;
}

export const DEFAULT_OFFLINE_PARAMETERS: Omit<OfflineTechnicalParameters, 'instanceId'> = {
  leaseTtlMs: 60_000,
  syncedRetentionMs: 86_400_000,
  maxConflictRecords: 200,
  maxPayloadBytes: 1_048_576,
};

export class InvalidParameterError extends Error {
  constructor(name: string, value: unknown, requirement: string) {
    super(`Parâmetro técnico inválido: ${name}=${String(value)}. Requisito: ${requirement}.`);
    this.name = 'InvalidParameterError';
  }
}

/** Valida e congela os parâmetros na composição (falha cedo, nunca em runtime). */
export function resolveOfflineParameters(
  input: Partial<OfflineTechnicalParameters> & { instanceId: string },
): OfflineTechnicalParameters {
  const params: OfflineTechnicalParameters = {
    ...DEFAULT_OFFLINE_PARAMETERS,
    ...input,
  };
  if (!params.instanceId || params.instanceId.trim() === '') {
    throw new InvalidParameterError('instanceId', params.instanceId, 'string não vazia');
  }
  const positive: ReadonlyArray<[string, number]> = [
    ['leaseTtlMs', params.leaseTtlMs],
    ['syncedRetentionMs', params.syncedRetentionMs],
    ['maxConflictRecords', params.maxConflictRecords],
    ['maxPayloadBytes', params.maxPayloadBytes],
  ];
  for (const [name, value] of positive) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new InvalidParameterError(name, value, 'inteiro positivo');
    }
  }
  return Object.freeze(params);
}
