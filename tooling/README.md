# tooling

Scripts e geradores do monorepo (ex.: manifesto de componentes, checagens de
governança).

`node tooling/agent-bridge.mjs decide <LOOP_ID> <ITERATION> [--out <caminho>]` — Agent
Bridge (docs/agent-bridge-design.md §3): lê HANDOFF/RESULT de `.agent-loop/`, aplica as guardas e
pede a DECISION ao GPT via Responses API; `OPENAI_API_KEY` e `OPENAI_MODEL` só por variável de ambiente.
`node tooling/agent-bridge.mjs run <LOOP_ID>` — executa uma iteração completa: Claude Code headless
(`dontAsk`, allowlist mínima, teto de custo, timeout) → RESULT → `decide` → DECISION; RETRY repete
dentro de `max_iterations`; DONE, BLOCKED e HUMAN_GATE param. Nunca faz merge nem deploy. O executor
encerra em `PR_READY`; a bridge observa `verify` + `architecture` no head do PR (timeout 30 min) e
promove o RESULT a `CI_VERIFIED` antes do `decide`; um RESULT `PR_READY` sem DECISION é retomado sem
reexecutar o Claude.
