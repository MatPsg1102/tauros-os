---
'@tauros/contracts': minor
'@tauros/domain': minor
'@tauros/application': minor
---

Operação Compartilhada V1 — execução com autoria real, evidência e conferência.

- contracts: estados aditivos de `DailyTaskStatus` (IN_PROGRESS/AWAITING_REVIEW/NEEDS_CORRECTION), `TaskExecutionReview`/`TaskReviewOutcome`, `EvidenceRecord` (espelho de attachments; binário fora da fila via `EvidenceBlobStorePort`), `SharedOperationEnqueuePort`, `requiresReview` na definição, capability oficial `task.review`.
- domain: `decideClaimDailyTask` (elegibilidade por posição vigente + presença planejada), `decideStartDailyTask` (horário real + ator), `decideTaskOutcome` estendido (concluir ≠ aprovar; AWAITING_REVIEW quando a definição exige conferência), `decideReviewExecution` (aprovar/devolver com motivo; reviewer ≠ executor; reconferência converge).
- application: `ClaimDailyTaskUseCase`, `StartDailyTaskUseCase`, `AddTaskEvidenceUseCase`, `ReviewTaskExecutionUseCase`; `RecordTaskOutcomeUseCase` com evidências reais, startedAt e reenvio pós-devolução encadeado por supersedes (idempotência ancorada na execução devolvida).
