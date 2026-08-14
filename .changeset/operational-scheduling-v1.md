---
'@tauros/contracts': minor
'@tauros/domain': minor
'@tauros/application': minor
---

Escala Operacional V1 — jornadas, padrões de escala por loja e presença planejada.

- contracts: espelhos de `shift_definitions`/`shift_patterns` (`ShiftDefinitionRecord`, `ShiftPatternRecord` cíclico genérico), `ScheduleRepositoryPort`/`ScheduleEnqueuePort` e read model `Planned*` (presença PLANEJADA ≠ real); `EmployeeAssignmentRecord.shiftDefinitionId` (jornada pertence ao vínculo) e `TeamRecord.rotationOffset`.
- domain: `resolvePlannedDay` — o ÚNICO resolver de escala (padrão como dado cíclico com vigência + âncora da loja + offset por equipe; 12x36/semanal/dias fixos são registros, não código); `decideCreateShiftDefinition`; `decideChangeWorkPeriod` (histórico por vigência); `currentAssignmentFor` compartilhado.
- application: `LoadPlannedScheduleUseCase` (fonte oficial multiloja), `CreateShiftDefinitionUseCase` (config.write, chave natural converge), `ChangeEmployeeWorkPeriodUseCase` (workforce.write); `RegisterEmployeeUseCase` aceita/valida a jornada do vínculo.
