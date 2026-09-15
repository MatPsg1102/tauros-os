# Bridge/Orquestrador local GPT ↔ Claude Code — Design (Etapa 1 do Loop Engineering)

**Status:** PROPOSTA para decisão humana. Documento de design; **nada implementado**. Implementar a
bridge é `HUMAN_APPROVAL_REQUIRED`.
**Base:** [agent-execution-protocol.md](agent-execution-protocol.md) (ciclo, gates 1–8, handoff),
[agent-development-state.md](agent-development-state.md) (checkpoint), processo Git do
[CLAUDE.md](../CLAUDE.md) e hooks em `.githooks/`. Nada disso é renegociado aqui.
**Escopo da Etapa 1:** somente este documento. Sem scripts, sem chamadas de API, sem hooks, sem
GitHub Actions, sem dependências, sem protótipo.

## Princípio central

Não é um agente autônomo genérico. É um **loop de engenharia controlado** para o Tauros OS:

`OBJECTIVE → CONTEXT → EXECUTE → VERIFY → EVIDENCE → DECIDE → [DONE | RETRY | BLOCKED | HUMAN_GATE]`

- **Claude Code** continua sendo o executor de engenharia: o único que toca o repositório.
- **GPT** é a camada de raciocínio/orquestração: decide o próximo passo a partir de estado e evidências **estruturadas**, nunca a partir do repositório inteiro.
- **Bridge** é deliberadamente simples e determinística: transporta estado e mensagens, valida forma e aplica limites mecânicos. **Não contém regra de negócio, não decide arquitetura, não interpreta código.**
- **Humano** é a autoridade: aprova escopo, resolve gates, faz merge e deploy.

Regras herdadas, não renegociadas: uma iteração = uma mudança verificável; testes focados primeiro; gates 1–8; ordem de contexto; branch + PR + CI verde + squash; artefatos congelados.

## 1. Arquitetura proposta

### 1.1 Componentes e responsabilidades exatas

| Componente                       | Faz                                                                                                                                                                                                                                                                                                 | Nunca faz                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Humano**                       | Define/aprova OBJECTIVE e SCOPE; resolve todo gate; merge (6), deploy (7), tag; altera as regras da bridge                                                                                                                                                                                          | Executa mudanças "por fora" do loop sem registrar no STATE                                                          |
| **GPT (supervisor)**             | Lê STATE + RESULT; escreve HANDOFF (um objetivo, um escopo, critérios de saída); escreve DECISION ∈ {DONE, RETRY, BLOCKED, HUMAN_GATE}; formula a pergunta ao humano em BLOCKED/HUMAN_GATE                                                                                                          | Lê o repositório; decide DONE sem EVIDENCE; amplia SCOPE; toca git                                                  |
| **Claude Code (executor)**       | Lê HANDOFF + STATE + git; executa **uma** mudança dentro do SCOPE; roda VERIFY; escreve RESULT com evidência real; atualiza STATE; abre PR quando DONE_WHEN é cumprido                                                                                                                              | Decide além do HANDOFF; ignora gate; relata sem evidência; merge; deploy                                            |
| **Bridge (local, determinista)** | Atribui LOOP_ID; valida a forma de HANDOFF/RESULT/DECISION; checagens mecânicas de gate (caminhos e comandos) antes e depois da execução; aplica MAX_ITERATIONS e rejeita HANDOFF repetido; move mensagens entre inbox/outbox; carimba timestamps; escreve só o bookkeeping `Current Loop` no STATE | Interpreta código; julga qualidade; escolhe a próxima ação; chama merge/deploy; edita qualquer outra seção do STATE |
| **Git/CI**                       | Fonte da verdade: diff, sha, run id, conclusão dos jobs                                                                                                                                                                                                                                             | —                                                                                                                   |

### 1.2 Topologia: fase manual → fase assistida

- **Fase manual** (vertical slice, §9): a bridge é **o humano + uma pasta**. GPT vive na interface de chat; o humano copia o HANDOFF para a pasta e o RESULT de volta. Nenhum código.
- **Fase assistida** (futura, só após aprovação): a bridge vira um comando local pequeno que (a) valida os arquivos, (b) invoca o executor com o HANDOFF e (c) coleta o RESULT. Continua **sem loop autônomo**: cada DECISION vem do GPT por intermédio do humano, ou por API somente se e quando autorizado (decisão aberta 8.2).

### 1.3 Onde vivem os artefatos

- **Durável e versionado** (no PR do loop): `docs/agent-development-state.md` (checkpoint), o diff da mudança e o corpo do commit/PR com o `Loop-Id`. **O git é o ledger.**
- **Efêmero e local**: pasta `.agent-loop/` na raiz, ignorada pelo git (a única mudança de configuração que a slice exigiria: uma linha no `.gitignore`), com `inbox/<LOOP_ID>.handoff.md`, `outbox/<LOOP_ID>.<n>.result.md` e `inbox/<LOOP_ID>.<n>.decision.md`. Ver decisão aberta 8.1.

Razão: versionar HANDOFF/RESULT inflaria o histórico com mensagens; a rastreabilidade (§1.5) é garantida pelo LOOP_ID carimbado no que já é versionado.

### 1.4 Identificação de loop e execução

- `LOOP_ID = L-<NNNN>`, sequencial por repositório; o contador vive no STATE (`Current Loop`). A bridge lê, incrementa e escreve.
- Iteração: `L-0007.1`, `L-0007.2`… (RETRY incrementa). Máximo `MAX_ITERATIONS` (proposto: 3).
- Carimbo: branch `<tipo>/<escopo>` (convenção inalterada); trailer de commit `Loop-Id: L-0007.2` (o hook `commit-msg` valida só a primeira linha, trailers passam); corpo do PR com `Loop-Id: L-0007`; RESULT e DECISION nomeados pelo id.

### 1.5 Rastreabilidade objetivo → execução → evidência → decisão

`OBJECTIVE` (HANDOFF L-0007) → `EXECUTION` (branch + commits com trailer `Loop-Id: L-0007.n`) → `EVIDENCE` (RESULT: comandos executados, contagens, sha, run id do CI) → `DECISION` (DECISION L-0007.n) → `STATE` (Last Approved Baseline e Current Evidence citam L-0007). Reconstrução: `git log --grep='Loop-Id: L-0007'` + PR + STATE. Nenhum artefato novo além dos arquivos efêmeros de §1.3.

### 1.6 Limites de contexto enviados ao executor

O HANDOFF é o **único** canal de contexto vindo do GPT e lista explicitamente o que ler:

- Sempre: STATE (~6 KB) + protocolo (~5 KB) + HANDOFF (≤ 2 KB).
- `CONTEXT`: no máximo 8 entradas `caminho[:linhas]`, todas existentes. "Leia o repositório" é HANDOFF inválido.
- Proibido por padrão: traceability, SAS, ADRs — só se listados em CONTEXT, com o trecho.
- O RESULT anterior **não** é reenviado: o GPT o digere e reescreve o HANDOFF (delta, não histórico).
- Se o executor precisar de mais do que o listado: pode ler arquivos importados diretamente pelos listados (um nível). Além disso, devolve `BLOCKED: contexto insuficiente` com a lista do que faltou — nunca varre o repositório.

### 1.7 Estratégia contra releitura desnecessária do repositório

1. O STATE carrega "Approved Decisions" já digeridas: o executor não redescobre.
2. O HANDOFF aponta `arquivo:linhas`; localizar é trabalho do GPT a partir do RESULT anterior (`CHANGED` lista caminhos).
3. A memória própria do Claude Code (fatos do repo) continua válida e fora da bridge.
4. Sem subagents por padrão; sem `Workflow`.
5. A bridge rejeita HANDOFF cujo CONTEXT exceda o limite: volta ao GPT para enxugar.

### 1.8 Fronteira: automação futura permitida × decisão humana obrigatória

| Automatizável no futuro (cada item com aprovação própria)            | Humano, sempre                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Validar a forma dos arquivos; atribuir LOOP_ID; carimbar timestamps  | Aprovar OBJECTIVE/SCOPE de cada loop                                    |
| Invocar o executor com o HANDOFF; coletar o RESULT                   | Resolver qualquer gate 1–8                                              |
| Checagens mecânicas de caminho (gates 2/3/4/7) e de comando (gate 5) | Merge (GATE 6), deploy (GATE 7), tag                                    |
| Enviar STATE + RESULT ao GPT e receber DECISION                      | Alterar artefatos congelados, o protocolo, os gates ou a própria bridge |
| RETRY dentro de MAX_ITERATIONS com HANDOFF alterado                  | Rotação de credenciais; qualquer acesso ao `.env`                       |
| Abrir PR (já é passo do executor)                                    | Encerrar um objetivo, abandonar um loop, apagar branch com trabalho     |

## 2. Sequência de um loop completo

### 2.1 Critérios de entrada (a bridge verifica antes de despachar)

- STATE sem loop ativo (`Current Loop: none`) e `main` local = `origin/main`.
- HANDOFF válido: campos obrigatórios presentes; SCOPE só com caminhos existentes; CONTEXT ≤ 8; VERIFY só com comandos da allowlist do repositório (`pnpm --filter <pkg> test|typecheck|lint`, `pnpm --filter <pkg> exec vitest run <arquivo>`, `pnpm boundaries`, `pnpm check:hardcoded`, `pnpm format:check`); DONE_WHEN verificável.
- SCOPE não intersecta caminhos de gate (§5) **ou** o HANDOFF traz `HUMAN_APPROVAL: <ref>` explícita para aquele gate.

### 2.2 Passos

1. **OBJECTIVE** — o humano aprova o objetivo; o GPT escreve `HANDOFF L-0007.1`. A bridge valida e marca `Current Loop: L-0007.1` no STATE.
2. **CONTEXT** — o executor faz READ STATE → VERIFY GIT → cria a branch → lê **só** o CONTEXT (mais um nível de imports, se preciso).
3. **EXECUTE** — uma mudança dentro do SCOPE. Ao reconhecer gate de conteúdo (1, 4, 5, 8): para e vai ao passo 5 com `STATUS: HUMAN_GATE`.
4. **VERIFY** — roda os comandos de VERIFY do HANDOFF (focados). Pipeline completo só quando DONE_WHEN exige PR.
5. **EVIDENCE** — escreve `RESULT L-0007.1` (§3.2) com saídas reais; atualiza o STATE (Current Evidence, Next Action, Human Gate, Last Updated); commita com trailer `Loop-Id`. A bridge valida: diff ⊆ SCOPE (senão força HUMAN_GATE 8), EVIDENCE não vazio, sem segredo (mesma regex do `pre-commit`).
6. **DECIDE** — o GPT lê STATE + RESULT e escreve `DECISION L-0007.1`:
   - `DONE` → o executor abre o PR (se ainda não abriu); STATE `Current Loop: none`; Next Action = "aguardar GATE 6". O loop encerra.
   - `RETRY` → novo `HANDOFF L-0007.2`, obrigatoriamente diferente; a bridge checa MAX_ITERATIONS e a assinatura da falha; volta ao passo 2 na mesma branch.
   - `BLOCKED` → pergunta objetiva ao humano; loop pausado.
   - `HUMAN_GATE` → gate nomeado + evidências; loop pausado.
7. **Humano** resolve BLOCKED/HUMAN_GATE: responde (→ novo HANDOFF), abandona (→ STATE registra; a branch só é apagada por decisão humana) ou faz o merge (GATE 6) **fora** do loop.

### 2.3 Critérios de saída

- **Loop** `DONE` = DONE_WHEN cumprido **e** VERIFY verde **e** diff ⊆ SCOPE **e** STATE atualizado **e** PR aberto. Se o PR aberto deve ainda ter CI verde antes de DONE é a decisão aberta 8.5. **Merge nunca faz parte do loop.**
- **Objetivo/fase** (Current Goal): só o humano declara concluído no STATE ou interrompe. O GPT não encerra fases.

## 3. Contratos de handoff

Formato: Markdown com chaves fixas em maiúsculas, legível por humano e checável linha a linha; mesmo vocabulário do protocolo. Valores de uma linha; listas com `-`. Não há campos opcionais além dos marcados.

### 3.1 HANDOFF (GPT → executor)

```text
LOOP_ID: L-0007.1
OBJECTIVE: <uma frase, um resultado verificável>
SCOPE:                       # globs permitidos no diff
- apps/carcass-cost/src/ui/**
FORBIDDEN:                   # além dos gates, o que não tocar neste loop
- apps/carcass-cost/src/domain/**
CONTEXT:                     # <= 8 entradas existentes; trecho opcional
- docs/agent-development-state.md
- apps/carcass-cost/src/ui/<arquivo>.tsx:40-90
VERIFY:                      # comandos da allowlist, na ordem
- pnpm --filter @tauros/carcass-cost test
DONE_WHEN:                   # critérios objetivos
- teste novo cobre <X> e passa
- 137 testes verdes no app
GATES_EXPECTED: NONE | <gate n, ...>     # se != NONE exige HUMAN_APPROVAL
HUMAN_APPROVAL: NONE | <ref: mensagem/PR/data>
MAX_ITERATIONS: 3
```

### 3.2 RESULT (executor → GPT): o handoff do protocolo + bookkeeping

```text
LOOP_ID: L-0007.1
STATUS: DONE | BLOCKED | FAILED | HUMAN_GATE
GOAL: <objetivo do HANDOFF>
CHANGED: <arquivos>
EVIDENCE:
- <comando> -> <saída resumida real: contagem, sha, run id>
ARCHITECTURE: none | <impacto>
RISKS: <somente riscos reais>
NEXT: <uma próxima ação verificável>
GATE: NONE | HUMAN_APPROVAL_REQUIRED (<gate n>)
BRANCH: <nome>   COMMIT: <sha> | none   PR: <#n> | none
```

`FAILED` = VERIFY vermelho ou execução interrompida. `BLOCKED` = não dá para prosseguir sem informação (contexto insuficiente, caminho inexistente, divergência documento × código). `HUMAN_GATE` = gate atingido.

### 3.3 DECISION (GPT → bridge/executor)

```text
LOOP_ID: L-0007.1
DECISION: DONE | RETRY | BLOCKED | HUMAN_GATE
RATIONALE: <1-3 linhas, citando EVIDENCE>
NEXT_HANDOFF: L-0007.2 | none
HUMAN_QUESTION: <pergunta objetiva> | none
```

Regras: `DONE` só com EVIDENCE verde e `STATUS: DONE` no RESULT; `RETRY` só com NEXT_HANDOFF diferente do anterior; `BLOCKED`/`HUMAN_GATE` exigem HUMAN_QUESTION.

### 3.4 STATE (checkpoint): o que a bridge acrescenta

`docs/agent-development-state.md` mantém todas as seções atuais, escritas pelo executor conforme o protocolo. Acréscimo mínimo: uma seção `## Current Loop` com `LOOP_ID | none`, `ITERATION`, `HANDOFF_REF` e `STARTED`. É a única parte do STATE que a bridge escreve (decisão aberta 8.3).

## 4. State machine mínima

Estados de um loop: `IDLE → DISPATCHED → EXECUTING → RESULTED → DECIDED → {CLOSED | WAITING_HUMAN}`.

| De                               | Evento                     | Para                                | Guarda (bridge)                                                          |
| -------------------------------- | -------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| IDLE                             | HANDOFF válido             | DISPATCHED                          | sem loop ativo; SCOPE ∩ caminhos de gate = ∅ ou HUMAN_APPROVAL           |
| DISPATCHED                       | executor inicia            | EXECUTING                           | —                                                                        |
| EXECUTING                        | RESULT escrito             | RESULTED                            | EVIDENCE ≠ ∅; diff ⊆ SCOPE; sem segredo                                  |
| EXECUTING                        | sem RESULT / worktree suja | RESULTED (`FAILED`)                 | humano marca; nunca há limpeza automática (GATE 5)                       |
| RESULTED                         | DECISION                   | DECIDED                             | `DONE` exige `STATUS: DONE`                                              |
| DECIDED (`DONE`)                 | —                          | CLOSED                              | STATE `Current Loop: none`                                               |
| DECIDED (`RETRY`)                | HANDOFF n+1                | DISPATCHED                          | n+1 ≤ MAX_ITERATIONS; HANDOFF ≠ anterior; assinatura de falha ≠ anterior |
| DECIDED (`BLOCKED`/`HUMAN_GATE`) | —                          | WAITING_HUMAN                       | HUMAN_QUESTION presente                                                  |
| WAITING_HUMAN                    | resposta humana            | DISPATCHED (novo HANDOFF) ou CLOSED | humano                                                                   |

Comportamento:

- **Sucesso**: RESULT `DONE` → DECISION `DONE` → PR aberto → CLOSED. Merge é ação humana (GATE 6), fora da máquina.
- **Falha**: RESULT `FAILED` → o GPT decide `RETRY` (HANDOFF corrigido) ou `BLOCKED`; nunca `DONE`.
- **Bloqueio**: qualquer gate ou `BLOCKED` → WAITING_HUMAN. Sem timeout automático, sem RETRY automático.

Prevenção de loop infinito (mecânica, na bridge):

1. `MAX_ITERATIONS` por loop (proposto 3): excedido = WAITING_HUMAN.
2. HANDOFF n+1 idêntico ao n = rejeitado.
3. Mesma assinatura de falha (mesmos testes falhando / mesmo erro) em duas iterações = WAITING_HUMAN.
4. Orçamento por sessão: N loops (proposto 5) sem toque humano = checkpoint humano obrigatório.
5. RESULT sem EVIDENCE = rejeitado (não vira DECISION).
6. Um loop ativo por vez por repositório.

## 5. Gates 1–8 posicionados no fluxo

| Gate                    | Detecção                                                                                                                                                                                    | Onde interrompe                            | Quem retoma |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------- |
| 1 Domain Rules          | conteúdo: o executor reconhece mudança matemática ou de regra de negócio                                                                                                                    | EXECUTE, antes de editar                   | humano      |
| 2 Database Schema       | caminho: `prisma/**`, `supabase/migrations/**`                                                                                                                                              | pré-despacho (SCOPE) e pós-execução (diff) | humano      |
| 3 Security              | caminho: `.env*`, `supabase/**` (RLS/policies), arquivos de auth/permissões/RBAC; conteúdo: secrets, credenciais                                                                            | pré-despacho, pós-execução e EXECUTE       | humano      |
| 4 Architecture          | caminho: `docs/adr/**`, `packages/contracts/**`, `.dependency-cruiser.cjs`, `packages/config-engine/**`, `packages/infrastructure/src/offline/**`; conteúdo: boundaries, contratos públicos | pré-despacho, pós-execução e EXECUTE       | humano      |
| 5 Destructive Operation | comando: `rm -rf`, `git reset --hard`, `--force`, `git branch -D`, migration destrutiva; diff: deleção de arquivo fora do SCOPE                                                             | pré-despacho (VERIFY/instruções) e EXECUTE | humano      |
| 6 Merge                 | ação: nunca é passo do loop                                                                                                                                                                 | fora do loop                               | humano      |
| 7 Deploy                | ação/comando: `vercel deploy`, promoção; comando no HANDOFF = HANDOFF rejeitado                                                                                                             | fora do loop                               | humano      |
| 8 Scope Expansion       | mecânico: diff ∉ SCOPE; conteúdo: o executor percebe necessidade além do OBJECTIVE                                                                                                          | pós-execução e EXECUTE                     | humano      |

**Todos os oito interrompem o loop.** Os gates 6 e 7 nunca são passos do loop. Os gates 1, 4, 5 e 8 dependem em parte de julgamento do executor: vale a regra do protocolo (STOP → evidências → HUMAN_GATE); a bridge só acrescenta o que é mecanizável. A lista de caminhos acima é proposta inicial (decisão aberta 8.6).

## 6. Exemplo concreto de um loop do Tauros OS

Ilustrativo; **não é uma tarefa aprovada**. Objetivo hipotético em `apps/carcass-cost`, só UI, sem regra de negócio: "no card de resultado da Desossa, a linha 'Rendimento de peso' ganha a nota inline 'pode passar de 100%' pelo padrão de ajuda já existente (`help.tsx`)".

**HANDOFF L-0001.1** — SCOPE `apps/carcass-cost/src/ui/**`; FORBIDDEN `apps/carcass-cost/src/domain/**`; CONTEXT = STATE, a tela da Desossa (trecho do card), `help.tsx`, o teste de UI da Desossa; VERIFY `pnpm --filter @tauros/carcass-cost test`; DONE_WHEN = nota visível com nome acessível, teste novo, 137 testes verdes, axe sem violação; GATES_EXPECTED NONE; MAX 3.

**Iteração 1** — executor cria branch `feat/carcass-deboning-yield-note`, adiciona a nota e um teste; VERIFY falha em 1 teste: o matcher esperava "100,06 %" e o DOM traz NBSP do `Intl`. RESULT `FAILED`, EVIDENCE = "136 passed, 1 failed: <nome do teste> — NBSP", CHANGED = 2 arquivos, NEXT = "normalizar o esperado com `plain()`".

**DECISION L-0001.1** — `RETRY`; RATIONALE cita a evidência; NEXT_HANDOFF L-0001.2 com CONTEXT reduzido ao teste + `format.ts` e a instrução objetiva de normalizar.

**Iteração 2** — executor ajusta só o teste; VERIFY = 137 passed; diff ⊆ SCOPE; STATE atualizado; commit com `Loop-Id: L-0001.2`; PR aberto. RESULT `DONE` com sha e número do PR.

**DECISION L-0001.2** — `DONE`. STATE `Current Loop: none`; Next Action = aguardar GATE 6.

**Caminho alternativo** — se na iteração 1 o executor concluísse que a nota exige expor um flag novo em `domain/deboning.ts`, pararia antes de editar: RESULT `HUMAN_GATE` (GATE 1 + GATE 8), sem diff no domínio, com a pergunta "a regra deve mudar ou a nota é só apresentação?". O loop fica em WAITING_HUMAN.

## 7. Failure modes

| Falha                                                        | Detecção                                    | Resposta                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Executor interrompido no meio (worktree suja, sem RESULT)    | RESULT ausente ao fim da sessão             | `FAILED`; próxima iteração começa por VERIFY GIT e relata o diff pendente; humano decide. Nunca `reset --hard` automático (GATE 5) |
| RESULT sem evidência ou com "testes passaram" sem saída      | validação de forma                          | rejeitado; RETRY exige comando + saída real                                                                                        |
| Diff fora do SCOPE                                           | pós-execução (mecânico)                     | HUMAN_GATE 8 forçado, mesmo se a mudança parecer inofensiva                                                                        |
| HANDOFF cita caminho inexistente / contexto alucinado        | executor                                    | `BLOCKED` com a lista do que não existe; nunca adivinha                                                                            |
| STATE divergente do git (baseline velho, loop fantasma)      | executor, passo READ STATE                  | corrige o STATE antes de editar e registra no RESULT                                                                               |
| Dois loops simultâneos / duas sessões                        | invariante "um loop ativo"                  | segundo HANDOFF rejeitado; humano resolve                                                                                          |
| CI vermelho depois do PR aberto                              | run id no RESULT                            | não é DONE; RESULT `FAILED`; RETRY se a causa está no SCOPE, senão `BLOCKED` (ex.: timeout de jornada no runner)                   |
| Segredo em RESULT/HANDOFF (saída de comando com `.env`)      | regex do `pre-commit` aplicada aos arquivos | rejeitado; EVIDENCE nunca cola conteúdo de `.env`; se vazar, rotação (risco F-01)                                                  |
| Explosão de contexto                                         | executor                                    | `BLOCKED: contexto insuficiente/excessivo` em vez de varrer; GPT enxuga o HANDOFF                                                  |
| GPT decide DONE sem evidência, ou RETRY idêntico             | guardas de §4                               | DECISION rejeitada; volta ao GPT                                                                                                   |
| Erro humano de cópia na fase manual (arquivo do loop errado) | LOOP_ID divergente                          | rejeitado                                                                                                                          |
| Divergência entre documentos descoberta durante o loop       | executor                                    | `BLOCKED` com a divergência apresentada; nunca decidir em silêncio                                                                 |
| Drift do executor ("melhorias" além do pedido)               | diff ⊆ SCOPE + REVIEW DIFF                  | GATE 8                                                                                                                             |
| Loop abandonado com branch órfã                              | STATE                                       | registra `abandoned`; apagar branch com trabalho é ação humana (GATE 5)                                                            |

## 8. Decisões ainda abertas

1. **Local dos artefatos efêmeros**: `.agent-loop/` ignorado pelo git (proposta), pasta fora do repositório, ou ledger versionado além do git.
2. **Canal do GPT**: chat manual (fase 1) ou API (só com autorização e gate próprio). O design serve aos dois; a escolha muda apenas quem copia.
3. **Forma de `Current Loop` no STATE**: seção nova (proposta) ou linha dentro de Current Phase.
4. **Valores**: MAX_ITERATIONS = 3, orçamento por sessão = 5, CONTEXT ≤ 8 são propostas, não decisões.
5. **Fim do loop**: "PR aberto" ou "PR aberto + CI verde" (CI leva ~10 min: esperar dentro do loop ou tratar CI vermelho como novo loop?).
6. **Lista mecânica de caminhos por gate**: onde vive e quem a mantém (proposta: tabela de §5, migrada para o protocolo ao implementar; mudança = decisão humana).
7. **Modo de invocação do executor na fase assistida**: sessão interativa ou `claude -p`; modo de permissões; se o executor pode rodar o pipeline completo sozinho.
8. **Carimbo do loop**: trailer `Loop-Id` em commit, label/campo no PR, ou ambos.
9. **Loops em lote** (humano aprova N objetivos de uma vez): necessidade não demonstrada; adiado.
10. **Como o GPT recebe o diff**: só `CHANGED` + EVIDENCE (proposta) ou diff completo anexado (custo de contexto do supervisor).

## 9. Menor vertical slice para validar o conceito (não implementar agora)

**Dry run manual de um loop**, sem nenhum código:

- **Pré-requisito único no repositório** (PR documental separado, se aprovado): uma linha `.agent-loop/` no `.gitignore` e a seção `Current Loop` no STATE.
- **Passos**: humano + GPT escrevem `HANDOFF L-0001` para um objetivo trivial e seguro (o de §6 ou algo só de documentação/testes); Claude Code executa pelo protocolo lendo o arquivo da pasta; escreve o RESULT; o humano leva o RESULT ao GPT; o GPT escreve a DECISION; o humano a aplica.
- **Validação** (o que a slice prova): os artefatos existem com o mesmo LOOP_ID; o executor não leu nada fora do CONTEXT (+1 nível); diff ⊆ SCOPE; STATE atualizado no PR do loop; o loop fecha em ≤ 2 iterações; o tempo humano de cópia é medido.
- **Critério para decidir implementar a bridge assistida**: dry run repetido 2–3 vezes sem precisar ajustar o formato, e o custo de cópia manual ser o gargalo dominante.
- **O que a slice não valida**: chamadas de API, execução headless, gates automáticos. Cada um desses fica para depois, com gate humano próprio.
