// Testes sem rede do subcomando `decide` (L-0002). O fetch é injetado; nenhuma chamada real.
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EventEmitter } from 'node:events';

import {
  BridgeError,
  CLAUDE_DISALLOWED_TOOLS,
  DECISION_SCHEMA,
  RUN_DEPENDENCIES,
  decide,
  matchesScope,
  parseContract,
  run as runLoop,
} from './agent-bridge.mjs';

const HANDOFF = `LOOP_ID: L-0001
ITERATION: 1
OBJECTIVE: Corrigir a linha "Estado atual" do CLAUDE.md.
SCOPE:                       # diff executável
- CLAUDE.md
SCOPE_STATE:                 # bookkeeping
- docs/agent-development-state.md (somente Current Loop)
DONE_WHEN:
1. CLAUDE.md corrigido.
AUTONOMY:
  max_iterations: 3
`;

const RESULT = `STATUS: DONE
LOOP_ID: L-0001
ITERATION: 1
DONE_LEVEL: CI_VERIFIED
BRANCH: docs/claude-md-estado-atual (a partir de main ed9401e)
COMMIT: 1b643d5 (trailer "Loop-Id: L-0001.1")
PR: #62 https://example.invalid/pull/62
DIFF_SUMMARY:
- CLAUDE.md: linha 9 substituída.
EXECUTABLE_BUDGET_USED: files=1/1 (CLAUDE.md), net_lines=0/5 (+1/-1), dependencies=0/0
STATE_BUDGET_USED: files=1/1, net_lines=-3/12 (+11/-14)
CONTEXT_USED: 3 de 4
VERIFY_EVIDENCE:
- pnpm format:check -> verde
CI_EVIDENCE:
- run 1 — verify success; architecture success
GATES_TRIGGERED: NONE (nenhum caminho de gate tocado)
RISKS:
- nenhum
`;

const STATE = `# Agent Development State

## Current Loop

\`\`\`text
LOOP_ID: L-0001
ITERATION: 1
\`\`\`

## Approved Decisions
`;

const decisionPayload = (decision, extra = {}) => ({
  decision,
  rationale: 'Evidência suficiente.',
  human_question: null,
  next_handoff: null,
  next_objective_proposal: null,
  ...extra,
});

const openaiResponse = (payload, overrides = {}) => ({
  id: 'resp_test',
  model: 'gpt-test',
  status: 'completed',
  usage: { input_tokens: 10, output_tokens: 5 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
  ...overrides,
});

const fetchReturning = (status, body) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

let root;
let outPath;

async function writeFixtures({ handoff = HANDOFF, result = RESULT } = {}) {
  await mkdir(path.join(root, '.agent-loop', 'inbox'), { recursive: true });
  await mkdir(path.join(root, '.agent-loop', 'outbox'), { recursive: true });
  await mkdir(path.join(root, 'tooling'), { recursive: true });
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, '.agent-loop', 'inbox', 'L-0001.handoff.md'), handoff);
  await writeFile(path.join(root, '.agent-loop', 'outbox', 'L-0001.1.result.md'), result);
  await writeFile(path.join(root, 'tooling', 'agent-bridge-supervisor.md'), 'Você é o supervisor.');
  await writeFile(path.join(root, 'docs', 'agent-development-state.md'), STATE);
}

function run(overrides = {}) {
  return decide({
    root,
    loopId: 'L-0001',
    iteration: '1',
    outPath,
    env: { OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'gpt-test' },
    fetchImpl: fetchReturning(200, openaiResponse(decisionPayload('DONE'))),
    gitChangedFiles: async () => ['CLAUDE.md', 'docs/agent-development-state.md'],
    sleep: async () => {},
    now: () => 1000,
    ...overrides,
  });
}

async function expectBridgeError(promise, code, fragment) {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );
  expect(error).toBeInstanceOf(BridgeError);
  expect(error.code).toBe(code);
  if (fragment) expect(error.message).toContain(fragment);
}

async function expectNoOutput() {
  const files = await readdir(path.join(root, '.agent-loop', 'inbox'));
  expect(files.filter((name) => name.includes('decision'))).toEqual([]);
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'agent-bridge-'));
  outPath = path.join(root, '.agent-loop', 'inbox', 'L-0001.1.decision.md');
  await writeFixtures();
});

afterEach(() => {
  root = undefined;
});

describe('agent-bridge decide', () => {
  it('1. HANDOFF válido + RESULT válido → DECISION gravada (DONE)', async () => {
    const summary = await run();
    expect(summary.decision).toBe('DONE');
    expect(summary.responseId).toBe('resp_test');
    expect(summary.inputTokens).toBe(10);
    const written = parseContract(await readFile(outPath, 'utf8'));
    expect(written.get('LOOP_ID')).toBe('L-0001');
    expect(written.get('ITERATION')).toBe('1');
    expect(written.get('DECISION')).toBe('DONE');
    expect(written.get('HUMAN_QUESTION')).toBe('NONE');
  });

  it('2. LOOP_ID divergente → HUMAN_GATE sem chamada', async () => {
    let called = false;
    await expectBridgeError(
      run({
        loopId: 'L-0009',
        fetchImpl: async () => {
          called = true;
          throw new Error('não deveria chamar');
        },
      }),
      'HUMAN_GATE',
    );
    expect(called).toBe(false);
  });

  it('3. ITERATION divergente → HUMAN_GATE', async () => {
    await writeFile(
      path.join(root, '.agent-loop', 'outbox', 'L-0001.1.result.md'),
      RESULT.replace('ITERATION: 1', 'ITERATION: 2'),
    );
    await expectBridgeError(run(), 'HUMAN_GATE', 'ITERATION do RESULT');
  });

  it('4. campo obrigatório ausente → HUMAN_GATE', async () => {
    await writeFixtures({ result: RESULT.replace(/^CI_EVIDENCE:\n.*\n/m, '') });
    await expectBridgeError(run(), 'HUMAN_GATE', 'CI_EVIDENCE');
  });

  it('5. budget excedido → HUMAN_GATE', async () => {
    await writeFixtures({ result: RESULT.replace('net_lines=0/5', 'net_lines=7/5') });
    await expectBridgeError(run(), 'HUMAN_GATE', 'EXECUTABLE_BUDGET_USED excedido');
  });

  it('6. arquivo fora do SCOPE → HUMAN_GATE', async () => {
    await expectBridgeError(
      run({ gitChangedFiles: async () => ['CLAUDE.md', 'packages/domain/src/x.ts'] }),
      'HUMAN_GATE',
      'packages/domain/src/x.ts',
    );
  });

  it('7. gate declarado no RESULT → HUMAN_GATE', async () => {
    await writeFixtures({
      result: RESULT.replace(
        'GATES_TRIGGERED: NONE (nenhum caminho de gate tocado)',
        'GATES_TRIGGERED: GATE 1',
      ),
    });
    await expectBridgeError(run(), 'HUMAN_GATE', 'declara gate');
  });

  it('8. resposta DONE válida → arquivo com metadados', async () => {
    const summary = await run();
    const text = await readFile(outPath, 'utf8');
    expect(text).toContain('RESPONSE_ID: resp_test');
    expect(text).toContain('MODEL: gpt-test');
    expect(summary.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('9. resposta RETRY válida (mesmo SCOPE) → DECISION RETRY com next_handoff', async () => {
    const nextHandoff = HANDOFF.replace('ITERATION: 1', 'ITERATION: 2');
    const payload = decisionPayload('RETRY', { next_handoff: nextHandoff });
    const summary = await run({ fetchImpl: fetchReturning(200, openaiResponse(payload)) });
    expect(summary.decision).toBe('RETRY');
    expect(await readFile(outPath, 'utf8')).toContain('ITERATION: 2');
  });

  it('9b. RETRY que amplia o SCOPE → CONTRACT, sem arquivo', async () => {
    const widened = HANDOFF.replace('- CLAUDE.md', '- CLAUDE.md\n- package.json');
    const payload = decisionPayload('RETRY', { next_handoff: widened });
    await expectBridgeError(
      run({ fetchImpl: fetchReturning(200, openaiResponse(payload)) }),
      'CONTRACT',
      'SCOPE diferente',
    );
    await expectNoOutput();
  });

  it('10. schema GPT inválido (enum desconhecido) → CONTRACT, sem arquivo', async () => {
    const payload = decisionPayload('MERGE');
    await expectBridgeError(
      run({ fetchImpl: fetchReturning(200, openaiResponse(payload)) }),
      'CONTRACT',
      'enum',
    );
    await expectNoOutput();
  });

  it('10b. recusa do modelo → CONTRACT, sem arquivo', async () => {
    const refusal = openaiResponse(null, {
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'não posso' }] }],
    });
    await expectBridgeError(run({ fetchImpl: fetchReturning(200, refusal) }), 'CONTRACT', 'recusa');
    await expectNoOutput();
  });

  it('11. erro HTTP 401 → OPENAI sem repetição; 500 repete uma vez e falha', async () => {
    let calls401 = 0;
    await expectBridgeError(
      run({
        fetchImpl: async () => {
          calls401 += 1;
          return { ok: false, status: 401, text: async () => '{"error":"unauthorized"}' };
        },
      }),
      'OPENAI',
      'HTTP 401',
    );
    expect(calls401).toBe(1);

    let calls500 = 0;
    await expectBridgeError(
      run({
        fetchImpl: async () => {
          calls500 += 1;
          return { ok: false, status: 500, text: async () => 'boom' };
        },
      }),
      'OPENAI',
      'HTTP 500',
    );
    expect(calls500).toBe(2);
  });

  it('12. após falha não existe arquivo final nem temporário', async () => {
    await expectBridgeError(run({ fetchImpl: fetchReturning(500, 'boom') }), 'OPENAI');
    const files = await readdir(path.join(root, '.agent-loop', 'inbox'));
    expect(files).toEqual(['L-0001.handoff.md']);
  });

  it('chave ausente → IO antes de qualquer rede; DECISION existente nunca é sobrescrita', async () => {
    let called = false;
    await expectBridgeError(
      run({
        env: { OPENAI_MODEL: 'gpt-test' },
        fetchImpl: async () => {
          called = true;
          throw new Error('não deveria chamar');
        },
      }),
      'IO',
      'OPENAI_API_KEY ausente',
    );
    expect(called).toBe(false);
    await writeFile(outPath, 'DECISION\nLOOP_ID: L-0001\n');
    await expectBridgeError(run(), 'IO', 'já existe');
  });

  it('glob de SCOPE: ponto é literal e * não atravessa diretório', () => {
    expect(matchesScope('CLAUDE_md', ['CLAUDE.md'])).toBe(false);
    expect(matchesScope('tooling/sub/x.mjs', ['tooling/*.mjs'])).toBe(false);
    expect(matchesScope('packages/domain/src/a.ts', ['packages/domain/**'])).toBe(true);
  });

  it('schema estrito: additionalProperties false e todas as chaves required', () => {
    expect(DECISION_SCHEMA.additionalProperties).toBe(false);
    expect(DECISION_SCHEMA.required).toEqual(Object.keys(DECISION_SCHEMA.properties));
  });
});

// --- run: Claude falso injetado; GPT falso via fetchImpl do decide; nenhuma rede ---------------

describe('agent-bridge run', () => {
  const HANDOFF_RUN = `${HANDOFF}  # max_iterations acima vale para o run\n`;

  // Claude falso: por padrão grava o RESULT da iteração atual e sai com 0.
  function fakeSpawn(behavior = {}) {
    const calls = [];
    const spawnImpl = (bin, args, options) => {
      const child = new EventEmitter();
      child.stdin = { end: (prompt) => calls.push({ bin, args, prompt, cwd: options.cwd }) };
      child.kill = () => {
        child.killed = true;
        setImmediate(() => child.emit('close', null));
      };
      setImmediate(async () => {
        if (behavior.hang) return;
        const handoff = parseContract(
          await readFile(path.join(root, '.agent-loop', 'inbox', 'L-0001.handoff.md'), 'utf8'),
        );
        const iteration = handoff.get('ITERATION');
        if (!behavior.noResult) {
          await writeFile(
            path.join(root, '.agent-loop', 'outbox', `L-0001.${iteration}.result.md`),
            RESULT.replace('ITERATION: 1', `ITERATION: ${iteration}`),
          );
        }
        child.emit('close', behavior.exitCode ?? 0);
      });
      return child;
    };
    return { spawnImpl, calls };
  }

  // GPT falso: devolve as decisões na ordem informada.
  function fakeGpt(decisions) {
    let call = 0;
    const fetchImpl = async () => {
      const payload = decisions[Math.min(call, decisions.length - 1)];
      call += 1;
      return { ok: true, status: 200, text: async () => JSON.stringify(openaiResponse(payload)) };
    };
    return { fetchImpl, calls: () => call };
  }

  function runWith({ decisions = [decisionPayload('DONE')], spawn = fakeSpawn(), ...overrides }) {
    const gpt = fakeGpt(decisions);
    const promise = runLoop({
      root,
      loopId: 'L-0001',
      env: { OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'gpt-test' },
      spawnImpl: spawn.spawnImpl,
      trackedChanges: () => '',
      decideOptions: {
        fetchImpl: gpt.fetchImpl,
        gitChangedFiles: async () => ['CLAUDE.md'],
        sleep: async () => {},
        now: () => 1000,
      },
      ...overrides,
    });
    return { promise, spawn, gpt };
  }

  beforeEach(async () => {
    await writeFixtures({ handoff: HANDOFF_RUN });
    // O RESULT é produzido pelo Claude falso: a fixture do `decide` não pode existir antes do run.
    await rm(path.join(root, '.agent-loop', 'outbox', 'L-0001.1.result.md'));
    await writeFile(path.join(root, 'tooling', 'agent-bridge-executor.md'), 'Você é o executor.');
  });

  it('1. Claude → RESULT DONE → GPT DONE → stop', async () => {
    const { promise, spawn, gpt } = runWith({});
    const summary = await promise;
    expect(summary.status).toBe('DONE');
    expect(spawn.calls).toHaveLength(1);
    expect(gpt.calls()).toBe(1);
    expect(spawn.calls[0].prompt).toContain('LOOP_ID: L-0001');
    expect(spawn.calls[0].prompt).toContain('DECISION_ANTERIOR: none');
  });

  it('2. RESULT → GPT RETRY → Claude de novo → DONE', async () => {
    const retry = decisionPayload('RETRY', {
      next_handoff: HANDOFF_RUN.replace('ITERATION: 1', 'ITERATION: 2'),
    });
    const { promise, spawn, gpt } = runWith({ decisions: [retry, decisionPayload('DONE')] });
    const summary = await promise;
    expect(summary.status).toBe('DONE');
    expect(summary.iterations.map((i) => i.decision)).toEqual(['RETRY', 'DONE']);
    expect(spawn.calls).toHaveLength(2);
    expect(gpt.calls()).toBe(2);
    expect(spawn.calls[1].prompt).toContain(
      'DECISION_ANTERIOR (RETRY): .agent-loop/inbox/L-0001.1.decision.md',
    );
    const handoff = await readFile(
      path.join(root, '.agent-loop', 'inbox', 'L-0001.handoff.md'),
      'utf8',
    );
    expect(handoff).toContain('ITERATION: 2');
    expect(handoff).toContain('- CLAUDE.md');
  });

  it('3. GPT BLOCKED → stop para humano', async () => {
    const blocked = decisionPayload('BLOCKED', { human_question: 'Falta decidir X.' });
    const { promise, spawn } = runWith({ decisions: [blocked] });
    const summary = await promise;
    expect(summary.status).toBe('BLOCKED');
    expect(spawn.calls).toHaveLength(1);
  });

  it('4. GPT HUMAN_GATE → stop para humano', async () => {
    const gate = decisionPayload('HUMAN_GATE', { human_question: 'Precisa de ADR?' });
    const { promise } = runWith({ decisions: [gate] });
    expect((await promise).status).toBe('HUMAN_GATE');
  });

  it('5. max_iterations atingido → HUMAN_GATE sem novo spawn', async () => {
    await writeFile(
      path.join(root, '.agent-loop', 'inbox', 'L-0001.handoff.md'),
      HANDOFF_RUN.replace('max_iterations: 3', 'max_iterations: 1'),
    );
    const retry = decisionPayload('RETRY', {
      next_handoff: HANDOFF_RUN.replace('ITERATION: 1', 'ITERATION: 2'),
    });
    const { promise, spawn } = runWith({ decisions: [retry] });
    await expectBridgeError(promise, 'HUMAN_GATE', 'max_iterations');
    expect(spawn.calls).toHaveLength(1);
  });

  it('6. Claude exit != 0 → falha fechada, GPT não chamado', async () => {
    const { promise, gpt } = runWith({ spawn: fakeSpawn({ exitCode: 1 }) });
    await expectBridgeError(promise, 'IO', 'código 1');
    expect(gpt.calls()).toBe(0);
  });

  it('7. Claude não cria RESULT → falha fechada, GPT não chamado', async () => {
    const { promise, gpt } = runWith({ spawn: fakeSpawn({ noResult: true }) });
    await expectBridgeError(promise, 'IO', 'sem gravar');
    expect(gpt.calls()).toBe(0);
  });

  it('8. timeout → processo encerrado e falha', async () => {
    const spawn = fakeSpawn({ hang: true });
    const { promise } = runWith({ spawn, timeoutMs: 20 });
    await expectBridgeError(promise, 'IO', 'timeout');
  });

  it('9. argv nunca contém bypassPermissions e usa dontAsk', async () => {
    const { promise, spawn } = runWith({});
    await promise;
    const args = spawn.calls[0].args;
    expect(args.join(' ')).not.toContain('bypassPermissions');
    expect(
      args.slice(args.indexOf('--permission-mode'), args.indexOf('--permission-mode') + 2),
    ).toEqual(['--permission-mode', 'dontAsk']);
    expect(args).toContain('--max-budget-usd');
    expect(args).toContain('--no-session-persistence');
  });

  it('10. merge/deploy/destrutivos estão negados e nunca permitidos', async () => {
    const { promise, spawn } = runWith({});
    await promise;
    const args = spawn.calls[0].args;
    const allowed = args.slice(
      args.indexOf('--allowedTools') + 1,
      args.indexOf('--disallowedTools'),
    );
    const denied = args.slice(args.indexOf('--disallowedTools') + 1);
    for (const tool of CLAUDE_DISALLOWED_TOOLS) {
      expect(denied).toContain(tool);
      expect(allowed).not.toContain(tool);
    }
    expect(allowed.join(' ')).not.toMatch(/merge|vercel|--force|reset --hard|rm -rf/);
  });

  it('11. RETRY que amplia o SCOPE é rejeitado pelo decide e o run para', async () => {
    const widened = HANDOFF_RUN.replace('- CLAUDE.md', '- CLAUDE.md\n- package.json');
    const retry = decisionPayload('RETRY', { next_handoff: widened });
    const { promise, spawn } = runWith({ decisions: [retry, decisionPayload('DONE')] });
    await expectBridgeError(promise, 'CONTRACT', 'SCOPE diferente');
    expect(spawn.calls).toHaveLength(1);
  });

  it('12. run reutiliza o decide existente, sem duplicação', async () => {
    expect(RUN_DEPENDENCIES.decide).toBe(decide);
    const seen = [];
    const { promise } = runWith({
      decideImpl: async (options) => {
        seen.push(options);
        return { decision: 'DONE', outPath: 'x' };
      },
    });
    await promise;
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ root, loopId: 'L-0001', iteration: '1' });
  });

  it('pré-condições: worktree sujo, RESULT existente e ambiente ausente falham antes do spawn', async () => {
    const dirty = runWith({ trackedChanges: () => ' M apps/web/x.ts' });
    await expectBridgeError(dirty.promise, 'HUMAN_GATE', 'worktree');
    expect(dirty.spawn.calls).toHaveLength(0);

    await writeFile(path.join(root, '.agent-loop', 'outbox', 'L-0001.1.result.md'), RESULT);
    const existing = runWith({});
    await expectBridgeError(existing.promise, 'IO', 'já existe');
    expect(existing.spawn.calls).toHaveLength(0);

    const noEnv = runWith({ env: { OPENAI_MODEL: 'gpt-test' } });
    await expectBridgeError(noEnv.promise, 'IO', 'ausentes');
    expect(noEnv.spawn.calls).toHaveLength(0);
  });
});
