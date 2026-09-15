# tooling

Scripts e geradores do monorepo (ex.: manifesto de componentes, checagens de
governança).

`node tooling/agent-bridge.mjs decide <LOOP_ID> <ITERATION> [--out <caminho>]` — Agent
Bridge (docs/agent-bridge-design.md §3): lê HANDOFF/RESULT de `.agent-loop/`, aplica as guardas e
pede a DECISION ao GPT via Responses API; `OPENAI_API_KEY` e `OPENAI_MODEL` só por variável de ambiente.
