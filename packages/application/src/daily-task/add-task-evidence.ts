// Use case: anexar EVIDÊNCIA fotográfica a uma ocorrência em execução
// (Operação Compartilhada). O binário vai para o blob store local
// (structured clone, fora da fila); o METADADO (espelho de attachments) é
// persistido e enfileirado — nunca base64 dentro da tarefa/payload. O
// executionId é vinculado no envio da execução. Upload real ao Storage é a
// pendência declarada — o estado NUNCA mente "confirmado".

import {
  PERMISSION_MODEL_VERSION,
  type ClockPort,
  type DailyTaskRepositoryPort,
  type EffectiveAuthorization,
  type EvidenceBlobStorePort,
  type EvidenceRecord,
  type EvidenceRepositoryPort,
  type IdGeneratorPort,
  type SharedOperationEnqueuePort,
} from '@tauros/contracts';

/** Limites operacionais da captura (validação, não processamento). */
const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;

export interface AddTaskEvidenceInput {
  readonly authorization: EffectiveAuthorization;
  readonly deviceId: string;
  readonly dailyTaskId: string;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly capturedOffline: boolean;
}

export type AddTaskEvidenceFailureCode =
  | 'SNAPSHOT_EXPIRED'
  | 'SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'TASK_NOT_FOUND'
  | 'INVALID_TYPE'
  | 'TOO_LARGE'
  | 'ENQUEUE_FAILED'
  | 'PERSISTENCE_FAILED';

export type AddTaskEvidenceResult =
  | { readonly kind: 'added'; readonly evidence: EvidenceRecord }
  | {
      readonly kind: 'failed';
      readonly code: AddTaskEvidenceFailureCode;
      readonly detail: string;
    };

export class AddTaskEvidenceUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly tasks: DailyTaskRepositoryPort,
    private readonly evidence: EvidenceRepositoryPort,
    private readonly blobs: EvidenceBlobStorePort,
    private readonly queue: SharedOperationEnqueuePort,
  ) {}

  async execute(input: AddTaskEvidenceInput): Promise<AddTaskEvidenceResult> {
    const now = this.clock.now();
    const auth = input.authorization;

    if (auth.validUntil.getTime() <= now.getTime()) {
      return { kind: 'failed', code: 'SNAPSHOT_EXPIRED', detail: 'autorização offline expirada' };
    }
    if (
      auth.permissionModelVersion !== undefined &&
      auth.permissionModelVersion !== PERMISSION_MODEL_VERSION
    ) {
      return {
        kind: 'failed',
        code: 'SNAPSHOT_VERSION_INCOMPATIBLE',
        detail: `permission_model_version ${String(auth.permissionModelVersion)} incompatível`,
      };
    }
    if (!input.mimeType.startsWith('image/')) {
      return {
        kind: 'failed',
        code: 'INVALID_TYPE',
        detail: 'a evidência precisa ser uma imagem',
      };
    }
    if (input.blob.size <= 0 || input.blob.size > MAX_EVIDENCE_BYTES) {
      return { kind: 'failed', code: 'TOO_LARGE', detail: 'imagem vazia ou grande demais' };
    }

    const task = await this.tasks.byId(input.dailyTaskId);
    if (task === null || task.storeId !== auth.storeId) {
      return { kind: 'failed', code: 'TASK_NOT_FOUND', detail: 'tarefa não encontrada' };
    }

    const id = this.ids.uuid();
    const record: EvidenceRecord = {
      id,
      storeId: auth.storeId,
      dailyTaskId: input.dailyTaskId,
      executionId: null,
      mimeType: input.mimeType,
      sizeBytes: input.blob.size,
      capturedAt: now.toISOString(),
      capturedByEmployeeId: auth.operatorEmployeeId,
      localBlobKey: `evidence:${id}`,
      syncStatus: 'queued',
    };

    // 1) binário no blob store local; 2) metadado durável na fila; 3) metadado
    // consultável. A foto NÃO pode sumir num reload antes do sync.
    try {
      await this.blobs.put(record.localBlobKey, input.blob);
    } catch (error) {
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao guardar a imagem',
      };
    }
    try {
      await this.queue.enqueueEvidence({ queueItemId: this.ids.uuid(), evidence: record });
    } catch (error) {
      await this.blobs.remove(record.localBlobKey);
      return {
        kind: 'failed',
        code: 'ENQUEUE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao enfileirar',
      };
    }
    try {
      await this.evidence.save(record);
    } catch (error) {
      return {
        kind: 'failed',
        code: 'PERSISTENCE_FAILED',
        detail: error instanceof Error ? error.message : 'falha ao registrar a evidência',
      };
    }

    return { kind: 'added', evidence: record };
  }
}
