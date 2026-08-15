// Evidência de execução (Operação Compartilhada) — espelho local de
// `attachments` do schema congelado: o registro carrega SÓ metadados e uma
// referência; o BINÁRIO vive fora da linha (blob store local até o upload
// real para o Storage — mesma decisão do schema: storage_path + metadados,
// nunca base64 dentro da tarefa/fila).

import type { LocalSyncStatus } from '../sync/status.js';

export const ENTITY_ATTACHMENT = 'attachments' as const;

export type EvidenceSyncStatus = LocalSyncStatus;

export interface EvidenceRecord {
  readonly id: string;
  readonly storeId: string;
  /** Ocorrência a que a evidência pertence (capturada durante a execução). */
  readonly dailyTaskId: string;
  /** Execução à qual foi vinculada no envio; null enquanto em captura. */
  readonly executionId: string | null;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly capturedAt: string;
  readonly capturedByEmployeeId: string;
  /**
   * Caminho lógico local (chave do blob store). O storage_path definitivo do
   * Storage chega com o upload real — pendência registrada.
   */
  readonly localBlobKey: string;
  readonly syncStatus: EvidenceSyncStatus;
}

/** Payload enfileirado do METADADO da evidência (o binário NÃO entra na fila). */
export interface EvidenceQueuePayload {
  readonly evidence: EvidenceRecord;
}
