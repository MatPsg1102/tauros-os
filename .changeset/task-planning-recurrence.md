---
'@tauros/contracts': minor
'@tauros/domain': minor
'@tauros/application': minor
'@tauros/ui-primitives': patch
---

Planejamento e recorrência de tarefas do encarregado + correção do foco no Dialog.

- contracts: `TaskRecurrence`/`Weekday`; `TaskTemplateRecord`/`Snapshot` com `effectiveFrom`, `plannedStartMinutes`, `recurrence`, `targetPositionId` opcional; `DailyTaskRecord.assignedPositionId`/`plannedStartAt`; ports `ShiftSchedulePort`, `DailyTaskAssignEnqueuePort`, `DailyTaskAuditPort`.
- domain: validação de recorrência×responsável em `decideCreateTemplate`; `shouldMaterialize`/`weekdayOf`; `decideAssignDailyTask`.
- application: `CreateTaskTemplateUseCase` estendido; `LoadDailyTasksUseCase` materializa por recorrência + escala; novo `AssignDailyTaskUseCase`.
- ui-primitives: `Dialog` deixa de re-executar o ciclo de foco a cada re-render do consumidor (bug de foco no input do Drawer corrigido na raiz).
