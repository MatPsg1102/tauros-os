#!/usr/bin/env node
// Agent Bridge — subcomando `decide` (docs/agent-bridge-design.md §3; loop L-0002).
// Cadeia provada: RESULT real → guardas locais (falham fechadas) → OpenAI Responses API com
// Structured Outputs → DECISION em Markdown no contrato do design.
// Sem dependências: usa o fetch nativo do Node (>= 20). Um loop por vez, execução explícita.
// Segredo: OPENAI_API_KEY e OPENAI_MODEL só por variável de ambiente; nunca lidos de arquivo,
// nunca impressos, nunca gravados em .agent-loop/.
//
// Uso: node tooling/agent-bridge.mjs decide <LOOP_ID> <ITERATION> [--out <caminho>]
// Saída: 0 = DECISION gravada; 2 = HUMAN_GATE (guarda); 3 = contrato/schema; 4 = OpenAI; 5 = IO/segredo.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DECISIONS = ['DONE', 'RETRY', 'BLOCKED', 'HUMAN_GATE'];
export const RESULT_REQUIRED_FIELDS = [
  'STATUS',
  'LOOP_ID',
  'ITERATION',
  'DONE_LEVEL',
  'BRANCH',
  'COMMIT',
  'PR',
  'DIFF_SUMMARY',
  'EXECUTABLE_BUDGET_USED',
  'STATE_BUDGET_USED',
  'CONTEXT_USED',
  'VERIFY_EVIDENCE',
  'CI_EVIDENCE',
  'GATES_TRIGGERED',
  'RISKS',
];
export const OPENAI_URL = 'https://api.openai.com/v1/responses';
const TIMEOUT_MS = 120_000;
const MAX_OUTPUT_TOKENS = 2000;
const RETRY_DELAY_MS = 2000;
// Ações que a DECISION nunca pode instruir (gates 5, 6 e 7 do protocolo).
const FORBIDDEN_IN_NEXT_HANDOFF = [
  /\bgh pr merge\b/i,
  /\bgit merge\b/i,
  /\bvercel (deploy|promote)\b/i,
  /--force\b/i,
  /\breset --hard\b/i,
  /\bgit branch -D\b/i,
  /\brm -rf\b/i,
];

export const DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: DECISIONS },
    rationale: { type: 'string' },
    human_question: { type: ['string', 'null'] },
    next_handoff: { type: ['string', 'null'] },
    next_objective_proposal: { type: ['string', 'null'] },
  },
  required: ['decision', 'rationale', 'human_question', 'next_handoff', 'next_objective_proposal'],
};

const EXIT_CODES = { HUMAN_GATE: 2, CONTRACT: 3, OPENAI: 4, IO: 5 };

export class BridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// --- contratos (KEY: valor em coluna 0; linhas seguintes pertencem ao campo anterior) ----------

const FIELD_LINE = /^([A-Z][A-Z0-9_]*):(?:\s(.*))?$/;

export function parseContract(text) {
  const collected = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(FIELD_LINE);
    if (match) {
      current = match[1];
      collected.set(current, [match[2] ?? '']);
      continue;
    }
    if (current) collected.get(current).push(raw);
  }
  const fields = new Map();
  for (const [key, lines] of collected) fields.set(key, lines.join('\n').trim());
  return fields;
}

export function firstToken(value) {
  return (value ?? '').split(/\s+/)[0] ?? '';
}

export function listItems(value) {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => firstToken(line.slice(2)));
}

export function parseBudget(value) {
  const pairs = [];
  for (const match of (value ?? '').matchAll(/([a-z_]+)=(-?\d+)\/(-?\d+)/g)) {
    pairs.push({ name: match[1], used: Number(match[2]), limit: Number(match[3]) });
  }
  return pairs;
}

const REGEX_SPECIALS = new Set(['.', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']);

export function globToRegExp(glob) {
  let pattern = '';
  for (let i = 0; i < glob.length; i += 1) {
    if (glob[i] !== '*') {
      pattern += REGEX_SPECIALS.has(glob[i]) ? `\\${glob[i]}` : glob[i];
    } else if (glob[i + 1] === '*' && glob[i + 2] === '/') {
      pattern += '(?:.*/)?';
      i += 2;
    } else if (glob[i + 1] === '*') {
      pattern += '.*';
      i += 1;
    } else {
      pattern += '[^/]*';
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function matchesScope(file, scopes) {
  return scopes.some((scope) => globToRegExp(scope).test(file));
}

// --- guardas mecânicas (design §5.3): qualquer falha = sem chamada, sem DECISION -------------

export function runGuards({ loopId, iteration, handoff, result, changedFiles }) {
  const fail = (reason) => {
    throw new BridgeError('HUMAN_GATE', reason);
  };
  if (firstToken(handoff.get('LOOP_ID')) !== loopId) fail(`LOOP_ID do HANDOFF ≠ ${loopId}`);
  if (firstToken(result.get('LOOP_ID')) !== loopId) fail(`LOOP_ID do RESULT ≠ ${loopId}`);
  if (firstToken(handoff.get('ITERATION')) !== iteration)
    fail(`ITERATION do HANDOFF ≠ ${iteration}`);
  if (firstToken(result.get('ITERATION')) !== iteration) fail(`ITERATION do RESULT ≠ ${iteration}`);
  const missing = RESULT_REQUIRED_FIELDS.filter((field) => !result.get(field));
  if (missing.length > 0) fail(`RESULT sem campos obrigatórios: ${missing.join(', ')}`);

  for (const field of ['EXECUTABLE_BUDGET_USED', 'STATE_BUDGET_USED']) {
    const pairs = parseBudget(result.get(field));
    if (pairs.length === 0) fail(`${field} ilegível (esperado nome=usado/limite)`);
    const over = pairs.filter((pair) => pair.used > pair.limit);
    if (over.length > 0) {
      fail(`${field} excedido: ${over.map((p) => `${p.name}=${p.used}/${p.limit}`).join(', ')}`);
    }
  }

  const scopes = [...listItems(handoff.get('SCOPE')), ...listItems(handoff.get('SCOPE_STATE'))];
  if (scopes.length === 0) fail('HANDOFF sem SCOPE');
  const outside = changedFiles.filter((file) => !matchesScope(file, scopes));
  if (outside.length > 0) fail(`arquivo fora do SCOPE: ${outside.join(', ')}`);

  if (firstToken(result.get('GATES_TRIGGERED')) !== 'NONE') {
    fail(`RESULT declara gate: ${result.get('GATES_TRIGGERED').split('\n')[0]}`);
  }
  const status = firstToken(result.get('STATUS'));
  if (status === 'HUMAN_GATE' || status === 'BLOCKED') fail(`RESULT com STATUS ${status}`);
}

// --- OpenAI Responses API ------------------------------------------------------------------------

export function buildRequest({ model, instructions, handoffText, resultText, currentLoop }) {
  const input = [
    '# HANDOFF',
    handoffText.trim(),
    '',
    '# RESULT',
    resultText.trim(),
    '',
    '# CURRENT LOOP (checkpoint)',
    currentLoop.trim() || '(indisponível)',
  ].join('\n');
  return {
    model,
    instructions,
    input,
    store: false,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    text: {
      format: {
        type: 'json_schema',
        name: 'bridge_decision',
        strict: true,
        schema: DECISION_SCHEMA,
      },
    },
  };
}

export async function callOpenAI({ apiKey, body, fetchImpl, timeoutMs = TIMEOUT_MS, sleep }) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(OPENAI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      lastError = new BridgeError('OPENAI', `falha de rede ou timeout (${error.name})`);
      continue;
    }
    clearTimeout(timer);
    const text = await response.text();
    if (response.ok) {
      try {
        return JSON.parse(text);
      } catch {
        throw new BridgeError('OPENAI', 'resposta HTTP 2xx sem JSON válido');
      }
    }
    const transient = response.status === 429 || response.status >= 500;
    lastError = new BridgeError('OPENAI', `HTTP ${response.status}: ${text.slice(0, 500)}`);
    if (!transient) throw lastError;
  }
  throw lastError;
}

export function extractOutputText(response) {
  if (response?.status !== 'completed') {
    const details = JSON.stringify(response?.incomplete_details ?? response?.error ?? null);
    throw new BridgeError('OPENAI', `status=${response?.status ?? 'desconhecido'} ${details}`);
  }
  const texts = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'refusal')
        throw new BridgeError('CONTRACT', `recusa do modelo: ${part.refusal}`);
      if (part.type === 'output_text' && part.text) texts.push(part.text);
    }
  }
  const text = texts.join('').trim();
  if (!text) throw new BridgeError('CONTRACT', 'resposta vazia');
  return text;
}

export function validateDecision(raw, { handoff, result }) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BridgeError('CONTRACT', 'saída do modelo não é JSON');
  }
  const expectedKeys = DECISION_SCHEMA.required;
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== expectedKeys.length ||
    !expectedKeys.every((key) => key in parsed)
  ) {
    throw new BridgeError('CONTRACT', 'schema inválido: chaves inesperadas ou ausentes');
  }
  if (!DECISIONS.includes(parsed.decision)) {
    throw new BridgeError('CONTRACT', `decision fora do enum: ${String(parsed.decision)}`);
  }
  if (typeof parsed.rationale !== 'string' || parsed.rationale.trim() === '') {
    throw new BridgeError('CONTRACT', 'rationale ausente');
  }
  for (const key of ['human_question', 'next_handoff', 'next_objective_proposal']) {
    if (parsed[key] !== null && typeof parsed[key] !== 'string') {
      throw new BridgeError('CONTRACT', `${key} deve ser string ou null`);
    }
  }
  const status = firstToken(result.get('STATUS'));
  const level = firstToken(result.get('DONE_LEVEL'));
  if (parsed.decision === 'DONE' && (status !== 'DONE' || level !== 'CI_VERIFIED')) {
    throw new BridgeError(
      'CONTRACT',
      `DONE exige RESULT DONE/CI_VERIFIED (tem ${status}/${level})`,
    );
  }
  if (parsed.decision === 'RETRY') {
    if (!parsed.next_handoff?.trim()) throw new BridgeError('CONTRACT', 'RETRY sem next_handoff');
    const nextScope = listItems(parseContract(parsed.next_handoff).get('SCOPE')).sort();
    const scope = listItems(handoff.get('SCOPE')).sort();
    if (nextScope.length === 0 || JSON.stringify(nextScope) !== JSON.stringify(scope)) {
      throw new BridgeError('CONTRACT', 'RETRY com SCOPE diferente do HANDOFF aprovado');
    }
    const forbidden = FORBIDDEN_IN_NEXT_HANDOFF.find((pattern) =>
      pattern.test(parsed.next_handoff),
    );
    if (forbidden)
      throw new BridgeError('CONTRACT', `next_handoff instrui ação proibida (${forbidden})`);
  }
  if (
    (parsed.decision === 'BLOCKED' || parsed.decision === 'HUMAN_GATE') &&
    !parsed.human_question?.trim()
  ) {
    throw new BridgeError('CONTRACT', `${parsed.decision} sem human_question`);
  }
  return parsed;
}

export function renderDecision({ loopId, iteration, decision, meta }) {
  // Valores multilinha são indentados: um NEXT_HANDOFF embutido traz linhas `KEY:` em coluna 0
  // que, sem indentação, seriam lidas como campos da própria DECISION.
  const block = (value) =>
    (value === null || value === undefined || value === '' ? 'NONE' : String(value))
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
  return [
    'DECISION',
    `LOOP_ID: ${loopId}`,
    `ITERATION: ${iteration}`,
    `DECISION: ${decision.decision}`,
    '',
    'RATIONALE:',
    block(decision.rationale),
    '',
    'HUMAN_QUESTION:',
    block(decision.human_question),
    '',
    'NEXT_HANDOFF:',
    block(decision.next_handoff),
    '',
    'NEXT_OBJECTIVE_PROPOSAL:',
    block(decision.next_objective_proposal),
    '',
    'SOURCE: openai-responses',
    `RESPONSE_ID: ${meta.responseId}`,
    `MODEL: ${meta.model}`,
    `RESPONSE_STATUS: ${meta.status}`,
    `INPUT_TOKENS: ${meta.inputTokens}`,
    `OUTPUT_TOKENS: ${meta.outputTokens}`,
    `LATENCY_MS: ${meta.latencyMs}`,
    `GENERATED_AT: ${meta.generatedAt}`,
    '',
  ].join('\n');
}

// --- ambiente e IO -------------------------------------------------------------------------------

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export function defaultGitChangedFiles(commit, root) {
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  try {
    git(['cat-file', '-e', `${commit}^{commit}`]);
  } catch {
    throw new BridgeError('HUMAN_GATE', `COMMIT ${commit} do RESULT não encontrado localmente`);
  }
  const base = git(['merge-base', 'origin/main', commit]).trim();
  return git(['diff', '--name-only', base, commit]).split('\n').filter(Boolean);
}

export function extractCurrentLoop(stateText) {
  const start = stateText.indexOf('## Current Loop');
  if (start < 0) return '';
  const block = stateText.slice(start).match(/```text\n([\s\S]*?)```/);
  return block ? block[1] : '';
}

export async function decide({
  root,
  loopId,
  iteration,
  outPath,
  env = process.env,
  fetchImpl = globalThis.fetch,
  gitChangedFiles = defaultGitChangedFiles,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
}) {
  const loopDir = path.join(root, '.agent-loop');
  const handoffPath = path.join(loopDir, 'inbox', `${loopId}.handoff.md`);
  const resultPath = path.join(loopDir, 'outbox', `${loopId}.${iteration}.result.md`);
  const finalPath = outPath ?? path.join(loopDir, 'inbox', `${loopId}.${iteration}.decision.md`);

  if (!(await exists(handoffPath)))
    throw new BridgeError('HUMAN_GATE', `HANDOFF ausente: ${handoffPath}`);
  if (!(await exists(resultPath)))
    throw new BridgeError('HUMAN_GATE', `RESULT ausente: ${resultPath}`);
  if (await exists(finalPath))
    throw new BridgeError('IO', `DECISION já existe, não sobrescrevo: ${finalPath}`);

  const handoffText = await readFile(handoffPath, 'utf8');
  const resultText = await readFile(resultPath, 'utf8');
  const handoff = parseContract(handoffText);
  const result = parseContract(resultText);
  const changedFiles = await gitChangedFiles(firstToken(result.get('COMMIT')), root);
  runGuards({ loopId, iteration, handoff, result, changedFiles });

  const instructions = await readFile(
    path.join(root, 'tooling', 'agent-bridge-supervisor.md'),
    'utf8',
  );
  let currentLoop = '';
  try {
    currentLoop = extractCurrentLoop(
      await readFile(path.join(root, 'docs', 'agent-development-state.md'), 'utf8'),
    );
  } catch {
    currentLoop = '';
  }
  const model = env.OPENAI_MODEL;
  if (!model) throw new BridgeError('IO', 'OPENAI_MODEL ausente no ambiente');
  const body = buildRequest({ model, instructions, handoffText, resultText, currentLoop });

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey)
    throw new BridgeError('IO', 'OPENAI_API_KEY ausente no ambiente (nenhuma chamada feita)');

  const startedAt = now();
  const response = await callOpenAI({ apiKey, body, fetchImpl, sleep });
  const latencyMs = now() - startedAt;
  const decision = validateDecision(extractOutputText(response), { handoff, result });
  const meta = {
    responseId: response.id ?? 'desconhecido',
    model: response.model ?? model,
    status: response.status,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    latencyMs,
    generatedAt: new Date(now()).toISOString(),
  };
  const markdown = renderDecision({ loopId, iteration, decision, meta });

  await mkdir(path.dirname(finalPath), { recursive: true });
  const tmpPath = `${finalPath}.tmp-${process.pid}`;
  try {
    await writeFile(tmpPath, markdown, 'utf8');
    const reparsed = parseContract(await readFile(tmpPath, 'utf8'));
    if (
      firstToken(reparsed.get('LOOP_ID')) !== loopId ||
      firstToken(reparsed.get('ITERATION')) !== iteration ||
      firstToken(reparsed.get('DECISION')) !== decision.decision
    ) {
      throw new BridgeError('IO', 'DECISION gravada não passou na releitura');
    }
    if (await exists(finalPath))
      throw new BridgeError('IO', `DECISION apareceu durante a escrita: ${finalPath}`);
    await rename(tmpPath, finalPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    throw error;
  }
  const sha256 = createHash('sha256').update(markdown).digest('hex');
  return { ...meta, decision: decision.decision, sha256, outPath: finalPath };
}

// --- CLI -------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const [command, loopId, iteration, ...rest] = argv;
  const options = { command, loopId, iteration, outPath: undefined };
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--out') options.outPath = path.resolve(rest[++i] ?? '');
    else throw new BridgeError('IO', `argumento desconhecido: ${rest[i]}`);
  }
  return options;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const options = parseArgs(process.argv.slice(2));
  if (
    options.command !== 'decide' ||
    !/^L-\d{4}$/.test(options.loopId ?? '') ||
    !/^\d+$/.test(options.iteration ?? '')
  ) {
    console.error(
      'Uso: node tooling/agent-bridge.mjs decide <LOOP_ID> <ITERATION> [--out <caminho>]',
    );
    process.exit(EXIT_CODES.IO);
  }
  try {
    const summary = await decide({ root, ...options });
    console.log(JSON.stringify(summary));
  } catch (error) {
    if (error instanceof BridgeError) {
      console.error(`${error.code}: ${error.message}`);
      process.exit(EXIT_CODES[error.code] ?? EXIT_CODES.IO);
    }
    console.error(`ERRO: ${error.message}`);
    process.exit(EXIT_CODES.IO);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
