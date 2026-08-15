// Ports de evidência. O binário NUNCA entra na fila oficial (payload é JSON
// puro com limite de tamanho): metadado vai pela fila; blob vive num store
// local dedicado, substituível pelo upload real sem tocar aplicação/UI.

import type { EvidenceRecord } from './record.js';

/** Metadados locais das evidências (espelho de attachments). */
export interface EvidenceRepositoryPort {
  byDailyTask(storeId: string, dailyTaskId: string): Promise<readonly EvidenceRecord[]>;
  byIds(ids: readonly string[]): Promise<readonly EvidenceRecord[]>;
  save(record: EvidenceRecord): Promise<void>;
  updateSyncStatus(id: string, status: EvidenceRecord['syncStatus']): Promise<void>;
}

/**
 * Binário da evidência — SEPARADO do LocalStore da fila (structured clone,
 * sem JSON). Adapter IndexedDB no aparelho; Memory nos testes.
 */
export interface EvidenceBlobStorePort {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | null>;
  remove(key: string): Promise<void>;
}
