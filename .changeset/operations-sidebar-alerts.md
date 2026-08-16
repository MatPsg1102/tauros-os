---
'@tauros/application': minor
'@tauros/config-engine': minor
---

UI Operacional V1.1 — read model da triagem operacional.

- `@tauros/application`: `buildPlannedScheduleDay` extraído do
  `LoadPlannedScheduleUseCase` (função pura de enriquecimento da presença
  planejada) para reutilização pela leitura device-local do quadro
  compartilhado. Comportamento do use case inalterado.
- `@tauros/config-engine`: nova chave `tasks.dueSoonWindowMs` (janela de aviso
  "próxima do prazo", default 30 min, scope store, hot-reload) — adição aditiva
  ao catálogo; ratificação no documento Baseline §5 pendente.
