// Testes sem rede do subcomando `decide` (L-0002). O fetch é injetado; nenhuma chamada real.
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  BridgeError,
  DECISION_SCHEMA,
  decide,
  matchesScope,
  parseContract,
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
