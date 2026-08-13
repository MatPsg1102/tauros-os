---
'@tauros/contracts': minor
'@tauros/domain': minor
'@tauros/application': minor
'@tauros/ui-primitives': patch
---

Gestão de Equipe V1 — colaboradores, funções/posições e Equipes A/B.

- contracts: records/ports do workforce congelado (`EmployeeRecord`, `EmployeeAssignmentRecord`, `TeamRecord`, `OperationalPositionRecord`, `WorkforceRepositoryPort`, enqueue/audit ports) e capability oficial `workforce.write` (cadastro de RH operacional; posições permanecem sob `config.write` — ADR-019).
- domain: `decideRegisterEmployee` (pessoa + vínculo temporal com posição e equipe como conceitos separados) e `decideCreatePosition` (chave natural por loja converge, nunca duplica em silêncio).
- application: `RegisterEmployeeUseCase` e `CreateOperationalPositionUseCase` — idempotência determinística, ordem fila→local→auditoria (admin.action / config.changed) — e `nameSlug` compartilhado.
- ui-primitives: `.t-segmented` passa a quebrar linha em telas estreitas (corrige overflow horizontal mobile pré-existente do SegmentedControl).
