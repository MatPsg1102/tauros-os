# Agent Execution Protocol

Contrato curto do fluxo supervisionado. Papéis: **GPT** = supervisor de engenharia, arquitetura e
planejamento; **Claude Code** = executor dentro do repositório; **Git/CI** = fonte objetiva do
estado real; **responsável humano** = autoridade para decisões críticas.
Estado canônico: [agent-development-state.md](agent-development-state.md). As regras do repositório
(camadas, convenções, processo por etapa) continuam em [CLAUDE.md](../CLAUDE.md) e no
[ADR-018A](adr/ADR-018A-implementation-conventions.md); este protocolo não as substitui.

## Ciclo

`READ STATE → VERIFY GIT → EXECUTE ONE CHANGE → RUN FOCUSED TESTS → REVIEW DIFF → UPDATE STATE → REPORT`

1. **READ STATE** — ler `docs/agent-development-state.md` inteiro (é curto). Se o estado divergir do git, o git vence e o estado é corrigido antes de qualquer edição.
2. **VERIFY GIT** — `git status`, `git branch --show-current`, `git log -3 --oneline` e o diff relevante. Nunca trabalhar na `main`.
3. **EXECUTE ONE CHANGE** — **ONE ITERATION = ONE VERIFIABLE CHANGE.** Só dentro do escopo aprovado no estado; ao esbarrar em um gate, parar.
4. **RUN FOCUSED TESTS** — primeiro o pacote/arquivo tocado (`pnpm --filter <pkg> test` ou `pnpm --filter <pkg> exec vitest run <arquivo>`). Pipeline completo (`pnpm format:check && pnpm lint && pnpm typecheck && pnpm boundaries && pnpm check:hardcoded && pnpm test && pnpm build`) só antes de abrir PR ou quando a mudança cruza pacotes.
5. **REVIEW DIFF** — `git diff` completo da iteração: nada fora do escopo, nada provisório, nenhum segredo, texto de UI em pt-BR via i18n, sem `any`.
6. **UPDATE STATE** — atualizar só as seções afetadas de `agent-development-state.md` (Current Evidence, Open Questions, Next Action, Human Gate, Last Updated). Não acumular histórico ali: histórico e decisões formais vão para a traceability na etapa correspondente.
7. **REPORT** — devolver o handoff abaixo. Nada além dele quando ele basta.

## Gates (parada obrigatória)

Continuação automática é permitida **apenas** em mudanças normais dentro de escopo já aprovado no
estado. Antes de qualquer item abaixo: **STOP → registrar o bloqueio em Open Questions → produzir
evidências → pedir decisão humana** (handoff com `STATUS: HUMAN_GATE`).

- **GATE 1 — Domain Rules**: qualquer alteração matemática ou de regra de negócio.
- **GATE 2 — Database Schema**: migration, tabela, coluna, constraint ou mudança estrutural.
- **GATE 3 — Security**: auth, RLS, permissões, secrets ou RBAC.
- **GATE 4 — Architecture**: ADR, contratos públicos, boundaries estruturais, Configuration Engine ou offline architecture.
- **GATE 5 — Destructive Operation**: deleção/migração destrutiva de dados ou arquivos.
- **GATE 6 — Merge**: merge de PR.
- **GATE 7 — Deploy**: produção/deploy.
- **GATE 8 — Scope Expansion**: qualquer expansão relevante além da tarefa aprovada.

## Handoff (Claude Code → supervisor)

```text
STATUS: DONE | BLOCKED | FAILED | HUMAN_GATE
GOAL: <objetivo da iteração>
CHANGED: <arquivos>
EVIDENCE: <testes / git / resultados objetivos>
ARCHITECTURE: none | <impacto>
RISKS: <somente riscos reais>
NEXT: <uma próxima ação verificável>
GATE: NONE | HUMAN_APPROVAL_REQUIRED
```

Relatório longo só quando o handoff não basta — por exemplo, divergência entre documentos:
apresentar a divergência, nunca decidir em silêncio.

## Controle de contexto

Claude Code **não relê o histórico do Tauros OS** a cada tarefa. Ordem de carga:

1. `docs/agent-development-state.md`
2. tarefa atual
3. `git status` / diff
4. arquivos diretamente envolvidos
5. contratos importados (`@tauros/contracts`, ports)
6. ADR específico — só se necessário
7. SAS / traceability / documentação ampla — só se realmente necessário, e o trecho, não o arquivo

- Sem subagents por padrão. Subagent só com ganho claro de paralelização ou de investigação ampla; nunca `Workflow`/multi-agente para tarefa simples. Correção pequena = agente principal.
- Meta: contexto abaixo de ~150k tokens. Ler trechos, não arquivos inteiros; não reler `CLAUDE.md` nem a traceability inteiros (já resumidos no estado).

## O que este protocolo NÃO é (Etapa 0)

Nenhum orquestrador executável: sem daemon, watcher, chamadas a APIs de LLM, automação de VS Code,
scripts que enviem prompts, loops, bots/webhooks do GitHub, MCP novo ou dependências. Automação só
depois que o protocolo for validado manualmente e aprovado pelo responsável.
