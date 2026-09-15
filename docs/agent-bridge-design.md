# Bridge/Orquestrador local GPT ↔ Claude Code — Design (Etapa 1 do Loop Engineering)

**Status:** PROPOSTA para decisão humana, revisão 2 (Autonomy Envelope). Documento de design;
**nada implementado**. Implementar a bridge é `HUMAN_APPROVAL_REQUIRED`.
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
- **Humano** é a autoridade: aprova objetivos e seus envelopes, resolve gates, faz merge e deploy.

A bridge só se justifica se **reduzir materialmente as intervenções humanas** necessárias para levar um objetivo já aprovado até DONE, sem permitir decisão estrutural nem expansão silenciosa de escopo. Para isso, duas categorias nunca se confundem:

1. **Autorização para executar trabalho já aprovado** — dada uma vez, no OBJECTIVE, e válida para todas as iterações dentro do **Autonomy Envelope** (§1.6). Uma nova iteração, por si só, nunca é motivo de interrupção.
2. **Decisão nova de produto ou arquitetura** — sempre humana.

Só a categoria 2 interrompe o loop.

Regras herdadas, não renegociadas: uma iteração = uma mudança verificável; testes focados primeiro; gates 1–8 (reclassificados em §5, nunca enfraquecidos); ordem de contexto; branch + PR + CI verde + squash; artefatos congelados.

## 1. Arquitetura proposta

### 1.1 Componentes e responsabilidades exatas

| Componente                       | Faz                                                                                                                                                                                                                                                                                                               | Nunca faz                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Humano**                       | Aprova OBJECTIVE + Autonomy Envelope (uma vez por objetivo); resolve BLOCKED e HUMAN_GATE; merge (6), deploy (7), tag; altera as regras da bridge e a configuração de gates                                                                                                                                       | Executa mudanças "por fora" do loop sem registrar no STATE; é chamado para autorizar uma iteração dentro do envelope |
| **GPT (supervisor)**             | Lê STATE + RESULT; escreve HANDOFF (um objetivo, um envelope, critérios de saída); escreve DECISION ∈ {DONE, RETRY, BLOCKED, HUMAN_GATE}; escreve HANDOFF de RETRY sozinho, dentro do envelope; formula a pergunta ao humano em BLOCKED/HUMAN_GATE; pode **propor** o próximo objetivo                            | Lê o repositório; decide DONE sem EVIDENCE; amplia SCOPE ou envelope; cria/despacha novo objetivo; toca git          |
| **Claude Code (executor)**       | Lê HANDOFF + STATE + git; implementa, diagnostica, corrige e re-testa dentro do envelope; escreve RESULT com evidência real; atualiza STATE; roda o pipeline completo e abre o PR ao atingir DONE_WHEN; observa o CI                                                                                              | Decide além do HANDOFF; ignora gate; relata sem evidência; merge; deploy; sai do SCOPE "para ajudar"                 |
| **Bridge (local, determinista)** | Atribui LOOP_ID; valida a forma de HANDOFF/RESULT/DECISION; aplica as guardas mecânicas (§5.3): caminhos, comandos, orçamentos, anti-loop, segredos; move mensagens; responde CONTEXT_REQUEST com `git diff`/`git show`; escreve só a seção `Current Loop` do STATE, incluindo o contador de intervenções humanas | Interpreta código; julga qualidade; escolhe a próxima ação; chama merge/deploy; edita qualquer outra seção do STATE  |
| **Git/CI**                       | Fonte da verdade: diff, sha, run id, conclusão dos jobs                                                                                                                                                                                                                                                           | —                                                                                                                    |

Pontos em que o humano participa de um objetivo normal: **início** (aprovar OBJECTIVE + envelope) e **fim** (merge). Entre os dois, só quando o loop sai do envelope (§1.6.3).

### 1.2 Topologia: fase manual → fase assistida

- **Fase manual** (vertical slice, §9): a bridge é **o humano + uma pasta**. GPT vive na interface de chat; o humano copia o HANDOFF para a pasta e o RESULT de volta. Nenhum código. O envelope já vale: o humano copia mensagens, mas **não decide** dentro do envelope.
- **Fase assistida** (futura, só após aprovação): a bridge vira um comando local pequeno que (a) valida os arquivos, (b) invoca o executor com o HANDOFF e (c) coleta o RESULT. O canal com o GPT fica **abstrato no contrato**: chat manual na validação inicial; API somente em etapa posterior e com gate próprio.

### 1.3 Onde vivem os artefatos

- **Durável e versionado** (no PR do loop): `docs/agent-development-state.md` (checkpoint), o diff da mudança e o corpo do commit/PR com o `Loop-Id`. **O git é o ledger.**
- **Efêmero e local** (adotado): pasta `.agent-loop/` na raiz, ignorada pelo git — a única mudança de configuração que a slice exigiria é uma linha no `.gitignore` — com `inbox/<LOOP_ID>.handoff.md`, `outbox/<LOOP_ID>.<n>.result.md`, `inbox/<LOOP_ID>.<n>.decision.md` e, quando houver, `outbox/<LOOP_ID>.<n>.context-reply.md`.

Razão: versionar HANDOFF/RESULT inflaria o histórico com mensagens; a rastreabilidade (§1.5) é garantida pelo LOOP_ID carimbado no que já é versionado.

### 1.4 Identificação de loop e execução

- `LOOP_ID = L-<NNNN>`, sequencial por repositório; o contador vive no STATE (`Current Loop`). A bridge lê, incrementa e escreve.
- Iteração: `L-0007.1`, `L-0007.2`… (RETRY incrementa). Máximo `max_iterations` do envelope.
- Carimbo (adotado: **ambos**): trailer de commit `Loop-Id: L-0007.2` (o hook `commit-msg` valida só a primeira linha, trailers passam) **e** linha `Loop-Id: L-0007` no corpo do PR. Branch continua `<tipo>/<escopo>`. RESULT e DECISION nomeados pelo id.

### 1.5 Rastreabilidade objetivo → execução → evidência → decisão

`OBJECTIVE` (HANDOFF L-0007) → `EXECUTION` (branch + commits com trailer `Loop-Id: L-0007.n`) → `EVIDENCE` (RESULT: comandos executados, contagens, sha, run id do CI) → `DECISION` (DECISION L-0007.n) → `STATE` (Last Approved Baseline, Current Evidence e Current Loop citam L-0007 e o número de intervenções humanas). Reconstrução: `git log --grep='Loop-Id: L-0007'` + PR + STATE.

### 1.6 Autonomy Envelope

**Definição.** O envelope de um objetivo é o conjunto fechado de ações, caminhos, comandos e orçamentos dentro do qual GPT + Claude Code iteram até DONE **sem nova autorização humana**. É aprovado pelo humano junto com o OBJECTIVE, viaja no HANDOFF (bloco `AUTONOMY`, §3.1), **só o humano alarga**; o GPT pode estreitá-lo num RETRY, nunca ampliá-lo.

#### 1.6.1 Campos

| Campo               | Conteúdo                                                                                                           | Proposta inicial (parâmetro de segurança, revisável com dados reais) |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `allowed_actions`   | lista fechada de ações permitidas sem humano (§1.6.2)                                                              | a lista de §1.6.2 inteira, salvo restrição explícita                 |
| `forbidden_actions` | ações vedadas neste objetivo, além das estruturais (§1.6.3)                                                        | `new_dependency`, `new_package`, `rename_across_packages`            |
| `retry_scope`       | o que um RETRY pode fazer: mesmo OBJECTIVE, mesma branch, SCOPE igual ou menor, HANDOFF obrigatoriamente diferente | fixo                                                                 |
| `max_iterations`    | MAX_ITERATIONS_PER_LOOP                                                                                            | 3                                                                    |
| `context_budget`    | MAX_CONTEXT_FILES listados no HANDOFF, mais um nível de imports diretos                                            | 8 arquivos                                                           |
| `change_budget`     | teto do diff: arquivos tocados, linhas líquidas, arquivos novos só dentro do SCOPE, zero dependências              | 10 arquivos; 300 linhas líquidas; 0 dependências                     |

Limite de sessão (fora do HANDOFF, no STATE): MAX_LOOPS_PER_SESSION = 5. Sem work queue, todo loop já começa por uma aprovação humana; o teto vale como rede de segurança para a fase futura e como limite de objetivos por sessão.

#### 1.6.2 Permitido sem nova aprovação (quando diretamente relacionado ao OBJECTIVE)

- ler os arquivos do CONTEXT e os que eles importam diretamente (um nível);
- criar, editar ou remover arquivos **dentro do SCOPE**;
- rodar VERIFY, lint e typecheck do pacote tocado, testes focados;
- diagnosticar falha (saída de teste, stack trace, o arquivo que falhou);
- corrigir erro **causado ou revelado** pela implementação, dentro do SCOPE;
- rodar os testes de novo;
- RETRY: o GPT escreve o HANDOFF n+1 sozinho, dentro de `retry_scope` e `max_iterations`;
- ajustes locais necessários para satisfazer DONE_WHEN (expectativas de teste, imports, tipos, formatação, i18n do texto pedido), dentro do SCOPE;
- rodar o pipeline completo, abrir o PR, esperar o CI, gerar evidências;
- atualizar o STATE conforme o protocolo e commitar com o trailer;
- encerrar em DONE (§2.3).

#### 1.6.3 Interrompe obrigatoriamente (sai do envelope)

Cada item abaixo é **uma intervenção humana** e conta na métrica de §1.10. Além dos casos estruturais já protegidos pelos gates (§5):

| Condição                                                                     | Saída        | Gate |
| ---------------------------------------------------------------------------- | ------------ | ---- |
| necessidade de ADR                                                           | HUMAN_GATE   | 4    |
| alteração de Domain Rules não nomeada no OBJECTIVE                           | HUMAN_GATE   | 1    |
| alteração estrutural de schema; migration não previamente autorizada         | HUMAN_GATE   | 2    |
| mudança de contrato público não autorizada                                   | HUMAN_GATE   | 4    |
| mudança do modelo de autorização/RBAC, de RLS, de secrets                    | HUMAN_GATE   | 3    |
| mudança da arquitetura offline                                               | HUMAN_GATE   | 4    |
| operação destrutiva de dados ou de git                                       | HUMAN_GATE   | 5    |
| expansão do SCOPE ou estouro do `change_budget`                              | HUMAN_GATE   | 8    |
| decisão de produto não especificada no OBJECTIVE/DONE_WHEN                   | BLOCKED      | —    |
| conflito entre requisitos (DONE_WHEN contraditório ou contradiz o STATE)     | BLOCKED      | —    |
| impossibilidade de satisfazer DONE_WHEN dentro do `change_budget`            | BLOCKED      | —    |
| esgotamento dos limites anti-loop (`max_iterations`, mesma falha duas vezes) | BLOCKED      | —    |
| nova dependência ou pacote                                                   | BLOCKED      | —    |
| merge, deploy, tag                                                           | fora do loop | 6, 7 |

Teste prático da fronteira: **"o humano, lendo OBJECTIVE e DONE_WHEN, reconheceria esta mudança como parte do que aprovou?"** Se não, é categoria 2: interrompe.

#### 1.6.4 RETRY × NEXT OBJECTIVE

- **RETRY** = nova tentativa de atingir o **mesmo** objetivo aprovado: mesma branch, mesmo SCOPE (ou menor), HANDOFF n+1 diferente do n, dentro de `max_iterations`. Decisão exclusiva do GPT; sem humano.
- **NEXT OBJECTIVE** = objetivo novo, com envelope novo. **Não pode ser criado nem executado autonomamente.** O GPT pode apenas **propor** (`NEXT_OBJECTIVE_PROPOSAL` na DECISION DONE, §3.3); o humano aprova ou não. Work queue pré-aprovada permanece **fora do escopo** desta versão.

### 1.7 Limites de contexto e prevenção de releitura

- O HANDOFF é o **único** canal de contexto vindo do GPT: STATE (~6 KB) + protocolo (~5 KB) + HANDOFF (≤ 2 KB) + `context_budget` de arquivos `caminho[:linhas]`, todos existentes. "Leia o repositório" é HANDOFF inválido.
- Proibido por padrão: traceability, SAS, ADRs — só se listados em CONTEXT, com o trecho.
- O RESULT anterior não é reenviado ao executor: o GPT o digere e reescreve o HANDOFF (delta, não histórico).
- Faltou contexto: um nível de imports é permitido; além disso, `BLOCKED: contexto insuficiente` com a lista do que faltou — nunca varrer.
- O GPT recebe, por padrão, o **mínimo necessário**: `CHANGED` + `EVIDENCE` + `DIFF_SUMMARY` estruturado (§3.2). Diff completo só quando necessário para decidir, via `CONTEXT_REQUEST` (§3.4), respondido mecanicamente pela bridge sem consumir iteração.
- O STATE carrega "Approved Decisions" já digeridas; a memória própria do Claude Code continua válida; sem subagents por padrão; sem `Workflow`.

### 1.8 Configuração declarativa de gates (fonte única)

Os caminhos, comandos e classes dos gates vivem em **um único arquivo versionado** (proposto: `docs/agent-gate-paths.md`, tabela `gate | classe | caminhos | comandos | pré-autorizável por HANDOFF?`), **não criado nesta etapa**. GPT lê esse arquivo para escrever HANDOFFs que não colidam com gates; a bridge valida contra ele; Claude Code o consulta durante EXECUTE. Nenhuma regra de gate é repetida em prompt, script ou instrução paralela. Alterar o arquivo é sempre decisão humana (é regra da própria bridge). A tabela de §5 é o conteúdo inicial proposto.

### 1.9 Fronteira: automação futura permitida × decisão humana obrigatória

| Automatizável no futuro (cada item com aprovação própria)                     | Humano, sempre                                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Validar a forma dos arquivos; atribuir LOOP_ID; carimbar timestamps           | Aprovar OBJECTIVE + Autonomy Envelope                                                         |
| Invocar o executor com o HANDOFF; coletar o RESULT; responder CONTEXT_REQUEST | Resolver BLOCKED e qualquer HUMAN_GATE                                                        |
| Guardas mecânicas (§5.3): caminhos, comandos, orçamentos, anti-loop, segredos | Merge (GATE 6), deploy (GATE 7), tag                                                          |
| Enviar STATE + RESULT ao GPT e receber DECISION                               | Alargar um envelope; aprovar NEXT OBJECTIVE                                                   |
| RETRY dentro do envelope; pipeline completo; abrir PR; esperar CI             | Alterar artefatos congelados, o protocolo, a configuração de gates, a bridge                  |
| Encerrar o loop em CI_VERIFIED                                                | Rotação de credenciais; qualquer acesso ao `.env`; abandonar loop; apagar branch com trabalho |

### 1.10 Métrica central: HUMAN_INTERVENTIONS_PER_OBJECTIVE

**Definição.** Quantidade de vezes que um objetivo previamente aprovado precisa interromper sua execução para obter decisão humana antes de DONE ou BLOCKED. Conta cada entrada em WAITING_HUMAN entre a aprovação do OBJECTIVE e o fechamento do loop. **Não conta** a aprovação inicial nem o merge após CI_VERIFIED (são os dois pontos fixos de §1.1).

- Registro: a bridge incrementa `HUMAN_INTERVENTIONS` na seção `Current Loop` do STATE; ao fechar, o valor vai para o RESULT final e para o corpo do PR.
- Baseline: medida do processo manual atual — número de prompts humanos entre o enunciado do objetivo e o PR aberto, contados em objetivos reais (histórico de sessões ou os próximos objetivos executados manualmente). **Nenhum valor é assumido**; só medido.
- Critério de ganho: a bridge só demonstra ganho operacional se a métrica cair em relação ao baseline, com a mesma taxa de PRs aceitos. Métricas secundárias: iterações por loop, arquivos lidos por loop, tempo até CI_VERIFIED.

## 2. Sequência de um loop completo

### 2.1 Critérios de entrada (guardas mecânicas antes de despachar)

- STATE sem loop ativo (`Current Loop: none`), `main` local = `origin/main`, MAX_LOOPS_PER_SESSION não excedido.
- HANDOFF válido: campos obrigatórios; bloco `AUTONOMY` completo; SCOPE só com caminhos existentes; CONTEXT ≤ `context_budget`; VERIFY só com comandos da allowlist do repositório (`pnpm --filter <pkg> test|typecheck|lint`, `pnpm --filter <pkg> exec vitest run <arquivo>`, `pnpm boundaries`, `pnpm check:hardcoded`, `pnpm format:check`); DONE_WHEN verificável e não contraditório.
- SCOPE não intersecta caminhos de gate classe A (§5) — nunca despachável — e só intersecta caminhos de gate classe B com `HUMAN_APPROVAL: <ref>` que nomeia o gate e o arquivo.

### 2.2 Passos

1. **OBJECTIVE** — o humano aprova OBJECTIVE + envelope (intervenção fixa nº 1). O GPT escreve `HANDOFF L-0007.1`. A bridge valida e marca `Current Loop: L-0007.1`.
2. **CONTEXT** — o executor faz READ STATE → VERIFY GIT → cria a branch → lê só o CONTEXT (+ um nível de imports).
3. **EXECUTE** — implementa dentro do SCOPE. Ao reconhecer condição de §1.6.3: para antes de editar e vai ao passo 5 com `STATUS: HUMAN_GATE` ou `BLOCKED`.
4. **VERIFY** — roda VERIFY, lint/typecheck do pacote. Falhou? **Diagnostica e corrige dentro do envelope, na mesma iteração**, e roda de novo. Só devolve `FAILED` se a correção exigir sair do envelope ou se a mesma falha persistir após a correção.
5. **EVIDENCE** — escreve `RESULT L-0007.1` (§3.2) com saídas reais, `DONE_LEVEL`, `DIFF_SUMMARY` e `BUDGET_USED`; atualiza o STATE; commita com trailer. Guardas mecânicas: diff ⊆ SCOPE, `change_budget`, EVIDENCE ≠ ∅, sem segredo.
6. **DECIDE** — o GPT lê STATE + RESULT (pede `CONTEXT_REQUEST` se precisar do diff) e escreve `DECISION L-0007.1`:
   - `RETRY` → `HANDOFF L-0007.2` (diferente; envelope igual ou menor); guardas anti-loop; volta ao passo 2 na mesma branch. **Sem humano.**
   - `DONE` → só com `DONE_LEVEL: CI_VERIFIED`. Se o RESULT está em IMPLEMENTATION_DONE, a decisão correta é `RETRY` com HANDOFF "pipeline completo + PR + CI" (ainda o mesmo objetivo; conta como iteração).
   - `BLOCKED` / `HUMAN_GATE` → pergunta objetiva ao humano; loop pausado; `HUMAN_INTERVENTIONS += 1`.
7. **PR e CI** (dentro do envelope) — pipeline completo, PR com `Loop-Id`, espera pelos dois jobs. CI vermelho com causa dentro do SCOPE → RESULT `FAILED` → RETRY. Causa fora (infra, flakiness conhecida do runner) → `BLOCKED`.
8. **Fechamento** — `DECISION: DONE` em CI_VERIFIED; STATE `Current Loop: none`; Next Action = "aguardar GATE 6 (PR #n)". O humano recebe o resultado e faz o merge (intervenção fixa nº 2).

### 2.3 Critérios de saída — escada de DONE

| Nível                   | Significado                                                                                                       | Quem                | Encerra o loop de engenharia?                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IMPLEMENTATION_DONE** | DONE_WHEN satisfeito localmente; VERIFY verde; diff ⊆ SCOPE; `change_budget` respeitado; STATE atualizado; commit | executor            | não                                                                                                                                                                              |
| **PR_READY**            | pipeline completo verde local; PR aberto com `Loop-Id`                                                            | executor            | não                                                                                                                                                                              |
| **CI_VERIFIED**         | `verify` + `architecture` verdes no head do PR                                                                    | CI (bridge observa) | **sim — estado terminal do loop.** A partir daqui só resta decisão humana                                                                                                        |
| **MERGED**              | squash na `main`                                                                                                  | humano (GATE 6)     | fora do loop                                                                                                                                                                     |
| **DEPLOYED**            | produção                                                                                                          | humano (GATE 7)     | fora do loop. Hoje o `carcass-cost` publica automaticamente no merge (git integration da Vercel): **MERGED implica DEPLOYED nesse app; a decisão de merge é também a de deploy** |

Por que CI_VERIFIED e não PR_READY: só o CI completa a evidência; esperar o CI é ação sem humano; CI vermelho no SCOPE vira RETRY em vez de novo objetivo. Por que não MERGED: merge é a categoria 2 por definição e o ponto único que torna segura a autonomia dentro do envelope — nada chega à `main` sem revisão humana.

Objetivo/fase (Current Goal): só o humano declara concluído no STATE ou interrompe. O GPT não encerra fases.

## 3. Contratos de handoff

Formato: Markdown com chaves fixas em maiúsculas, legível por humano e checável linha a linha; mesmo vocabulário do protocolo. Valores de uma linha; listas com `-`. Sem campos opcionais além dos marcados.

### 3.1 HANDOFF (GPT → executor)

```text
LOOP_ID: L-0007.1
OBJECTIVE: <uma frase, um resultado verificável>
SCOPE:                       # globs permitidos no diff
- apps/carcass-cost/src/ui/**
FORBIDDEN:                   # caminhos vedados neste loop, além dos gates
- apps/carcass-cost/src/domain/**
CONTEXT:                     # <= context_budget entradas existentes; trecho opcional
- docs/agent-development-state.md
- apps/carcass-cost/src/ui/<arquivo>.tsx:40-90
VERIFY:                      # comandos da allowlist, na ordem
- pnpm --filter @tauros/carcass-cost test
DONE_WHEN:                   # critérios objetivos (acceptance criteria)
- teste novo cobre <X> e passa
- 137 testes verdes no app
AUTONOMY:
  allowed_actions: default | <subconjunto de 1.6.2>
  forbidden_actions: new_dependency, new_package, rename_across_packages | <mais>
  retry_scope: same-objective, same-branch, scope-equal-or-narrower, handoff-must-differ
  max_iterations: 3
  context_budget: 8
  change_budget: files=10, net_lines=300, dependencies=0
GATES_EXPECTED: NONE | <gate n: arquivo>     # só gates classe B; exige HUMAN_APPROVAL
HUMAN_APPROVAL: NONE | <ref: mensagem/PR/data>
```

### 3.2 RESULT (executor → GPT): o handoff do protocolo + bookkeeping

```text
LOOP_ID: L-0007.1
STATUS: DONE | BLOCKED | FAILED | HUMAN_GATE
DONE_LEVEL: none | IMPLEMENTATION_DONE | PR_READY | CI_VERIFIED
GOAL: <objetivo do HANDOFF>
CHANGED: <arquivos>
DIFF_SUMMARY:                # uma linha por arquivo: o que mudou e por quê
- <arquivo>: <resumo>
EVIDENCE:
- <comando> -> <saída resumida real: contagem, sha, run id>
BUDGET_USED: iteration=1/3, files=2/10, net_lines=+41/300, context=4/8
ARCHITECTURE: none | <impacto>
RISKS: <somente riscos reais>
NEXT: <uma próxima ação verificável>
GATE: NONE | HUMAN_APPROVAL_REQUIRED (<gate n>)
BRANCH: <nome>   COMMIT: <sha> | none   PR: <#n> | none   CI: <run id: conclusão> | none
```

`FAILED` = VERIFY ou CI vermelho após a correção dentro do envelope, ou execução interrompida. `BLOCKED` = não dá para prosseguir sem decisão/informação humana (§1.6.3, casos não estruturais). `HUMAN_GATE` = gate estrutural atingido.

### 3.3 DECISION (GPT → bridge/executor)

```text
LOOP_ID: L-0007.1
DECISION: DONE | RETRY | BLOCKED | HUMAN_GATE
RATIONALE: <1-3 linhas, citando EVIDENCE>
NEXT_HANDOFF: L-0007.2 | none
HUMAN_QUESTION: <pergunta objetiva> | none
NEXT_OBJECTIVE_PROPOSAL: <uma frase> | none     # só informativo; nunca despachado sem humano
```

Regras: `DONE` só com `STATUS: DONE` e `DONE_LEVEL: CI_VERIFIED`; `RETRY` só com NEXT_HANDOFF diferente do anterior e envelope igual ou menor; `BLOCKED`/`HUMAN_GATE` exigem HUMAN_QUESTION; NEXT_OBJECTIVE_PROPOSAL nunca gera HANDOFF por si.

### 3.4 CONTEXT_REQUEST (GPT → bridge, mecânico)

```text
LOOP_ID: L-0007.1
CONTEXT_REQUEST:
- diff: <caminho>            # git diff main..HEAD -- <caminho>
- show: <caminho>:<linhas>   # trecho do arquivo no head da branch
```

A bridge responde com `context-reply` contendo exatamente o pedido. Não consome iteração, não aciona o executor; máximo de 2 por iteração e 3 caminhos por pedido. É o mecanismo de "diff completo só quando necessário para decidir".

### 3.5 STATE (checkpoint): o que a bridge acrescenta

`docs/agent-development-state.md` mantém todas as seções atuais, escritas pelo executor conforme o protocolo. Acréscimo (adotado): seção própria `## Current Loop` com `LOOP_ID | none`, `ITERATION`, `HANDOFF_REF`, `STARTED`, `HUMAN_INTERVENTIONS` e `LOOPS_THIS_SESSION`. É a única parte do STATE que a bridge escreve.

## 4. State machine mínima

Estados de um loop: `IDLE → DISPATCHED → EXECUTING → RESULTED → DECIDED → {VERIFYING_CI | WAITING_HUMAN | CLOSED}`.

| De                               | Evento                     | Para                                | Guarda (bridge)                                                                                 |
| -------------------------------- | -------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| IDLE                             | HANDOFF válido             | DISPATCHED                          | sem loop ativo; sessão < MAX_LOOPS; SCOPE ∩ gates A = ∅; SCOPE ∩ gates B só com HUMAN_APPROVAL  |
| DISPATCHED                       | executor inicia            | EXECUTING                           | —                                                                                               |
| EXECUTING                        | RESULT escrito             | RESULTED                            | EVIDENCE ≠ ∅; diff ⊆ SCOPE; `change_budget`; sem segredo; LOOP_ID confere                       |
| EXECUTING                        | sem RESULT / worktree suja | RESULTED (`FAILED`)                 | humano marca; nunca há limpeza automática (GATE 5)                                              |
| RESULTED                         | CONTEXT_REQUEST            | RESULTED                            | ≤ 2 por iteração; resposta mecânica                                                             |
| RESULTED                         | DECISION                   | DECIDED                             | `DONE` exige `DONE_LEVEL: CI_VERIFIED`                                                          |
| DECIDED (`RETRY`)                | HANDOFF n+1                | DISPATCHED                          | n+1 ≤ `max_iterations`; HANDOFF ≠ anterior; envelope ⊆ anterior; assinatura de falha ≠ anterior |
| DECIDED (`RETRY` p/ PR)          | executor abre PR           | VERIFYING_CI                        | pipeline completo verde; PR com `Loop-Id`                                                       |
| VERIFYING_CI                     | jobs concluem              | RESULTED                            | RESULT com `CI: <run id>`; verde ⇒ `DONE_LEVEL: CI_VERIFIED`; vermelho ⇒ `FAILED`               |
| DECIDED (`DONE`)                 | —                          | CLOSED                              | STATE `Current Loop: none`; HUMAN_INTERVENTIONS gravado                                         |
| DECIDED (`BLOCKED`/`HUMAN_GATE`) | —                          | WAITING_HUMAN                       | HUMAN_QUESTION presente; `HUMAN_INTERVENTIONS += 1`                                             |
| WAITING_HUMAN                    | resposta humana            | DISPATCHED (novo HANDOFF) ou CLOSED | humano; alargar envelope = novo HUMAN_APPROVAL no HANDOFF                                       |

Comportamento:

- **Sucesso**: EXECUTING (com correções internas) → RESULTED → RETRY para PR → VERIFYING_CI → DONE → CLOSED, **sem WAITING_HUMAN**. Merge é ação humana fora da máquina.
- **Falha**: `FAILED` → o GPT decide `RETRY` (HANDOFF corrigido) ou `BLOCKED`; nunca `DONE`.
- **Bloqueio**: condição de §1.6.3 → WAITING_HUMAN. Sem timeout automático, sem RETRY automático a partir daí.

Prevenção de loop infinito (mecânica, na bridge):

1. `max_iterations` por loop (3): excedido = BLOCKED → WAITING_HUMAN.
2. HANDOFF n+1 idêntico ao n = rejeitado.
3. Mesma assinatura de falha (mesmos testes falhando / mesmo erro) em duas iterações = BLOCKED.
4. MAX_LOOPS_PER_SESSION (5) = checkpoint humano obrigatório.
5. RESULT sem EVIDENCE = rejeitado (não vira DECISION).
6. `change_budget` estourado = HUMAN_GATE 8, não "mais uma iteração".
7. Um loop ativo por vez por repositório.

## 5. Gates 1–8 posicionados e classificados

### 5.1 Classes

- **A — HARD HUMAN GATE**: sempre interrompe; nenhum HANDOFF pode pré-autorizar.
- **B — CONDITIONAL HUMAN GATE**: interrompe só quando ultrapassa o Autonomy Envelope aprovado; o HANDOFF pode pré-autorizar um caso nomeado (arquivo + mudança) via `GATES_EXPECTED` + `HUMAN_APPROVAL`.
- **C — MECHANICAL GUARD**: a bridge/executor verifica e aplica automaticamente, sem humano; a consequência de uma violação é a saída definida na tabela.

### 5.2 Classificação

| Gate                    | Classe                                  | Pré-autorizável no HANDOFF quando…                                                                                                          | Núcleo que interrompe sempre (justificativa)                                                                                                                                                                              | Detecção                                                                                                                                                        |
| ----------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Domain Rules          | **B**                                   | o OBJECTIVE nomeia a regra/fórmula alterada e o arquivo de domínio está no SCOPE (ex.: "trocar o default de 11,55 para X")                  | qualquer regra **não nomeada** no OBJECTIVE, inclusive "correção" de fórmula ou arredondamento descoberta durante o loop — é decisão de produto                                                                           | conteúdo (executor) + caminho `**/src/domain/**` fora do SCOPE (C)                                                                                              |
| 2 Database Schema       | **B**                                   | migration **aditiva** nomeada no OBJECTIVE, arquivo em SCOPE, HUMAN_APPROVAL                                                                | mudança estrutural não prevista; qualquer migration destrutiva (cai no GATE 5); editar migration já aplicada (forward-only)                                                                                               | caminho `prisma/**`, `supabase/migrations/**` (C)                                                                                                               |
| 3 Security              | **A (núcleo) + B (implementação)**      | implementação de trabalho de auth **já aprovado como objetivo** (ex.: FASE 1, quando aprovada), com cada arquivo sensível listado no SCOPE  | secrets, credenciais, `.env*`, rotação (F-01); semântica do modelo de autorização (ADR-018/RBAC); política de RLS não especificada no OBJECTIVE. Justificativa: irreversível ou expõe dados; ADR-018 é artefato congelado | caminho `.env*`, `supabase/**` (policies), arquivos de auth/permissões (C) + conteúdo (executor)                                                                |
| 4 Architecture          | **A (núcleo) + B (contratos nomeados)** | mudança de contrato público **nomeada** no OBJECTIVE (campo/tipo em `packages/contracts`) com HUMAN_APPROVAL                                | ADR novo ou alterado; boundaries (`.dependency-cruiser.cjs`); Configuration Engine; arquitetura offline; Design System congelado. Justificativa: um ADR **é** a decisão humana; não existe "pré-autorizar um ADR"         | caminho `docs/adr/**`, `.dependency-cruiser.cjs`, `packages/config-engine/**`, `packages/infrastructure/src/offline/**`, `packages/contracts/**` (C) + conteúdo |
| 5 Destructive Operation | **A**                                   | nunca. Remover **arquivo** dentro do SCOPE como parte do OBJECTIVE não é este gate: é trabalho normal, coberto pela guarda diff ⊆ SCOPE (C) | `git reset --hard`, `--force`, `git branch -D` com trabalho, `rm -rf` fora de artefatos de build, deleção/migração destrutiva de dados. Justificativa: irreversível                                                       | comando em VERIFY/instruções e durante EXECUTE (C)                                                                                                              |
| 6 Merge                 | **A**                                   | nunca                                                                                                                                       | sempre. Justificativa: é o único ponto que torna segura a autonomia interna; branch protection exige revisão                                                                                                              | fora do loop                                                                                                                                                    |
| 7 Deploy                | **A**                                   | nunca; comando de deploy no HANDOFF = HANDOFF rejeitado                                                                                     | sempre. Nota: no `carcass-cost` o merge já implica deploy (git integration); a decisão humana de merge carrega o deploy                                                                                                   | comando (C); fora do loop                                                                                                                                       |
| 8 Scope Expansion       | **B** com detecção **C**                | —: o envelope **é** a pré-autorização; dentro dele não há gate                                                                              | diff fora do SCOPE, `change_budget` estourado, necessidade percebida além do OBJECTIVE. Justificativa: expansão silenciosa é exatamente o que o envelope proíbe                                                           | diff ⊆ SCOPE e orçamentos (C) + conteúdo (executor)                                                                                                             |

Nenhuma proteção estrutural foi enfraquecida: o que mudou é que a **iteração** deixa de ser motivo de interrupção; o que era decisão humana continua humano.

### 5.3 Guardas mecânicas (classe C) que sustentam o envelope

Validação de forma e LOOP_ID; caminhos de gate (fonte única, §1.8); allowlist de comandos em VERIFY; diff ⊆ SCOPE; `change_budget`; `context_budget`; EVIDENCE não vazio; regex de segredos do `pre-commit`; `max_iterations`; HANDOFF repetido; assinatura de falha repetida; MAX_LOOPS_PER_SESSION; um loop ativo. Todas aplicadas sem humano; uma violação produz a saída definida (rejeição, `FAILED`, `BLOCKED` ou `HUMAN_GATE`), nunca uma "decisão".

## 6. Exemplo concreto e modelo de intervenção humana

Ilustrativo; **não é uma tarefa aprovada**. Objetivo hipotético em `apps/carcass-cost`, só UI, sem regra de negócio: "no card de resultado da Desossa, a linha 'Rendimento de peso' ganha a nota inline 'pode passar de 100%' pelo padrão de ajuda já existente (`help.tsx`)". DONE_WHEN: nota visível com nome acessível, teste novo, 137 testes verdes, axe sem violação, PR aberto com CI verde.

### 6.1 Modelo manual atual (o mesmo objetivo)

1. Humano escreve o prompt com o objetivo → Claude implementa nota + teste → VERIFY falha (matcher esperava "100,06 %", DOM traz NBSP do `Intl`) → **STOP**, relata.
2. Humano lê, diagnostica ou pede diagnóstico → novo prompt "normalize com `plain()`" → Claude corrige → 137 verdes → **STOP**, relata.
3. Humano: "rode o pipeline completo e abra o PR" → Claude roda, abre → **STOP**, relata.
4. Humano: "CI verde?" → Claude checa → relata → humano faz merge.

Intervenções humanas entre o objetivo e o PR verificado: **3** (passos 2, 3 e 4), além da aprovação inicial e do merge.

### 6.2 Modelo com Autonomy Envelope (o mesmo objetivo)

1. **Humano aprova** OBJECTIVE + envelope (SCOPE `src/ui/**`, FORBIDDEN `src/domain/**`, `max_iterations` 3, `change_budget` padrão). ← intervenção fixa nº 1.
2. GPT escreve `HANDOFF L-0001.1` (CONTEXT: STATE, tela da Desossa, `help.tsx`, teste da Desossa).
3. Claude executa: branch, nota, teste → VERIFY falha (NBSP) → **diagnostica e corrige na mesma iteração** (normaliza com `plain()`, dentro do SCOPE) → 137 verdes → RESULT `DONE_LEVEL: IMPLEMENTATION_DONE`, `BUDGET_USED files=2/10`.
4. GPT: `RETRY` "pipeline completo + PR + CI" (`HANDOFF L-0001.2`, mesmo envelope). Sem humano.
5. Claude: pipeline verde, PR #n com `Loop-Id: L-0001`, espera os dois jobs → RESULT `CI_VERIFIED`.
6. GPT: `DECISION: DONE`, `NEXT_OBJECTIVE_PROPOSAL: none`.
7. **Humano recebe** "PR #n pronto, HUMAN_INTERVENTIONS = 0" e faz o merge. ← intervenção fixa nº 2.

Intervenções humanas entre o objetivo e o PR verificado: **0**. Se o VERIFY tivesse falhado de novo após a correção (mesma assinatura), a iteração 2 seria RETRY com diagnóstico do GPT; na terceira falha igual, BLOCKED.

### 6.3 Onde o humano reaparece obrigatoriamente (no mesmo exemplo)

- Claude conclui que a nota exige expor um flag novo em `domain/deboning.ts` → GATE 1 + GATE 8 → `HUMAN_GATE`, sem diff no domínio, pergunta "a regra muda ou a nota é só apresentação?".
- O teste revela que o texto pedido contradiz outro teste existente sobre a mesma linha → conflito de requisitos → `BLOCKED`.
- A correção do NBSP exigiria mudar `format.ts` e mais 9 arquivos de teste → `change_budget` → `HUMAN_GATE` 8.
- CI vermelho por timeout do runner em jornada não relacionada → causa fora do SCOPE → `BLOCKED` (o humano decide se re-roda ou se abre objetivo próprio).
- Três iterações sem satisfazer DONE_WHEN → `BLOCKED`.

### 6.4 Resposta ao critério de sucesso

"Se uma feature normalmente exigiria 10 prompts manuais, quais ciclos podem ocorrer automaticamente e exatamente quais condições ainda chamariam o humano?"

- **Automáticos, dentro do envelope**: implementar; rodar testes/lint/typecheck; diagnosticar; corrigir erro causado ou revelado pela implementação; re-testar; RETRY até 3; ajustes locais para DONE_WHEN; pipeline completo; abrir PR; esperar CI; RETRY por CI vermelho com causa no SCOPE; gerar evidências; atualizar STATE; fechar em CI_VERIFIED. Dos 10 prompts manuais, todos os que fossem "continue", "corrija", "rode de novo", "abra o PR", "o CI passou?" desaparecem.
- **Sempre humanos**: aprovar o objetivo e o envelope (início); merge e deploy (fim); qualquer item de §1.6.3 — ADR, Domain Rule não nomeada, schema/migration não autorizada, contrato público não autorizado, autorização/RBAC/RLS/secrets, arquitetura offline, decisão de produto não especificada, expansão de SCOPE ou estouro de `change_budget`, conflito de requisitos, impossibilidade dentro do orçamento, limites anti-loop, nova dependência, operação destrutiva.
- Quantos dos 10 sobrevivem depende só de quantos eram decisões de categoria 2; o design não assume um número — a métrica de §1.10 mede.

## 7. Failure modes

| Falha                                                                     | Detecção                                    | Resposta                                                                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Executor interrompido no meio (worktree suja, sem RESULT)                 | RESULT ausente ao fim da sessão             | `FAILED`; próxima iteração começa por VERIFY GIT e relata o diff pendente; humano decide. Nunca `reset --hard` automático (GATE 5) |
| RESULT sem evidência ou com "testes passaram" sem saída                   | validação de forma                          | rejeitado; RETRY exige comando + saída real                                                                                        |
| Diff fora do SCOPE ou `change_budget` estourado                           | guarda C pós-execução                       | HUMAN_GATE 8 forçado, mesmo se a mudança parecer inofensiva                                                                        |
| Envelope mal definido (SCOPE vago, DONE_WHEN não verificável)             | guarda de entrada                           | HANDOFF rejeitado antes de despachar; volta ao GPT/humano                                                                          |
| GPT alarga o envelope num RETRY                                           | guarda `envelope ⊆ anterior`                | HANDOFF rejeitado; alargar exige HUMAN_APPROVAL                                                                                    |
| GPT tenta despachar NEXT OBJECTIVE                                        | LOOP_ID novo sem aprovação humana           | rejeitado; fica como proposta                                                                                                      |
| Executor corrige "além" do erro revelado (drift)                          | diff ⊆ SCOPE + REVIEW DIFF + DIFF_SUMMARY   | GATE 8                                                                                                                             |
| HANDOFF cita caminho inexistente / contexto alucinado                     | executor                                    | `BLOCKED` com a lista do que não existe; nunca adivinha                                                                            |
| STATE divergente do git (baseline velho, loop fantasma)                   | executor, passo READ STATE                  | corrige o STATE antes de editar e registra no RESULT                                                                               |
| Dois loops simultâneos / duas sessões                                     | invariante "um loop ativo"                  | segundo HANDOFF rejeitado; humano resolve                                                                                          |
| CI vermelho depois do PR aberto                                           | run id no RESULT                            | `FAILED`; RETRY se a causa está no SCOPE, senão `BLOCKED` (ex.: timeout de jornada no runner)                                      |
| Segredo em RESULT/HANDOFF (saída de comando com `.env`)                   | regex do `pre-commit` aplicada aos arquivos | rejeitado; EVIDENCE nunca cola conteúdo de `.env`; se vazar, rotação (risco F-01)                                                  |
| Explosão de contexto                                                      | executor                                    | `BLOCKED: contexto insuficiente/excessivo` em vez de varrer; GPT enxuga o HANDOFF                                                  |
| GPT decide DONE sem CI_VERIFIED, ou RETRY idêntico                        | guardas de §4                               | DECISION rejeitada; volta ao GPT                                                                                                   |
| Mesma falha em iterações consecutivas (teste flaky ou diagnóstico errado) | assinatura de falha                         | `BLOCKED`; o humano decide se é flakiness (fora do SCOPE) ou diagnóstico                                                           |
| Erro humano de cópia na fase manual (arquivo do loop errado)              | LOOP_ID divergente                          | rejeitado                                                                                                                          |
| Divergência entre documentos descoberta durante o loop                    | executor                                    | `BLOCKED` com a divergência apresentada; nunca decidir em silêncio                                                                 |
| Loop abandonado com branch órfã                                           | STATE                                       | registra `abandoned`; apagar branch com trabalho é ação humana (GATE 5)                                                            |

## 8. Decisões

### 8.1 Adotadas neste design (propostas preferenciais; revisáveis com dados reais)

1. **Artefatos efêmeros**: `.agent-loop/` ignorado pelo git.
2. **Canal do GPT**: abstrato no contrato; chat manual na validação inicial; API só em etapa posterior, com gate próprio.
3. **Current Loop**: seção própria no STATE, com `HUMAN_INTERVENTIONS` e `LOOPS_THIS_SESSION`.
4. **Limites iniciais**: 3 iterações/loop, 5 loops/sessão, 8 arquivos/contexto — parâmetros de segurança, não constantes.
5. **DONE técnico**: não exige merge; escada IMPLEMENTATION_DONE → PR_READY → **CI_VERIFIED (encerra o loop)** → MERGED → DEPLOYED.
6. **Gate paths**: configuração declarativa única e auditável (`docs/agent-gate-paths.md`, §1.8), sem duplicação entre GPT, bridge e Claude.
7. **Executor**: implementação concreta (sessão interativa vs headless, permissões) **não decidida** nesta versão.
8. **Loop stamp**: `Loop-Id` no trailer do commit **e** no corpo do PR.
9. **Batch/work queue**: adiado; NEXT OBJECTIVE só por aprovação humana.
10. **Diff para o GPT**: mínimo necessário — `CHANGED` + `EVIDENCE` + `DIFF_SUMMARY`; diff completo só via `CONTEXT_REQUEST`.

### 8.2 Ainda abertas

1. **`change_budget`**: 10 arquivos / 300 linhas líquidas são chute inicial; calibrar com os primeiros loops reais (objetivos de UI do `carcass-cost` tiveram diffs desse porte, mas não foi medido).
2. **Lista de arquivos do GATE 3** (auth/permissões/RLS) para a fonte única de §1.8: precisa ser enumerada quando a FASE 1 for desenhada; até lá, `supabase/**` e `.env*` bastam.
3. **Baseline da métrica**: contar em sessões passadas (log) ou nos próximos N objetivos manuais antes do dry run — recomendação: os próximos 3 objetivos manuais, para ter medida contemporânea.
4. **Espera pelo CI na fase manual**: quem observa (humano recarrega / Claude monitora) e se a espera conta no tempo do loop.
5. **`NEXT_OBJECTIVE_PROPOSAL`**: manter como campo informativo ou retirar para evitar qualquer sugestão de fila.
6. **Correção dentro da iteração × RETRY**: o executor corrige o erro revelado na mesma iteração (adotado); definir se a segunda correção do mesmo sintoma dentro de uma iteração deve encerrar a iteração como `FAILED` (proposta: sim, para preservar a guarda de assinatura de falha).

## 9. Menor vertical slice para validar o conceito (não implementar agora)

**Dry run manual de um loop com envelope**, sem nenhum código:

- **Pré-requisitos no repositório** (um PR documental, se aprovado): linha `.agent-loop/` no `.gitignore`; seção `Current Loop` no STATE; arquivo `docs/agent-gate-paths.md` com a tabela de §5.2 como conteúdo inicial.
- **Antes do dry run**: medir o baseline de HUMAN_INTERVENTIONS_PER_OBJECTIVE nos próximos objetivos manuais (§8.2, item 3).
- **Passos**: humano aprova um objetivo trivial e seguro (o de §6 ou algo só de documentação/testes) com envelope padrão; GPT escreve `HANDOFF L-0001.1` na pasta; Claude Code executa pelo protocolo, corrige dentro do envelope, escreve o RESULT; humano leva RESULT ao GPT; GPT decide; humano copia a DECISION; repete até CI_VERIFIED; humano faz merge.
- **Validação** (o que a slice prova): artefatos com o mesmo LOOP_ID; executor não leu nada fora do CONTEXT (+1 nível); diff ⊆ SCOPE e dentro do `change_budget`; STATE atualizado no PR do loop; loop fechou em CI_VERIFIED em ≤ 3 iterações; **HUMAN_INTERVENTIONS medido e comparado ao baseline**; nenhuma decisão de categoria 2 tomada sem humano; tempo humano de cópia medido.
- **Critério para decidir implementar a bridge assistida**: dry run repetido 2–3 vezes sem precisar ajustar formato ou envelope; métrica abaixo do baseline; custo de cópia manual como gargalo dominante.
- **O que a slice não valida**: chamadas de API, execução headless, guardas automáticas de caminho. Cada um fica para depois, com gate humano próprio.
