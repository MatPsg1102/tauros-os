// Sanitização centralizada (6.2.8 §8) — atua ANTES de persistir e ANTES de
// transmitir. Denylist profunda por nome de campo (qualquer formato de case)
// + allowlist para metadados. Nunca stack traces, nunca payload integral.

const FORBIDDEN_KEY_PATTERN =
  /(pass(word)?|senha|pin|secret|token|credential|authorization|api[_-]?key|service[_-]?role|cookie|bearer|refresh|private[_-]?key|card|cart[aã]o|cvv|iban|conta[_-]?banc)/i;

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 8;
const MAX_STRING = 512;

/** Normaliza camelCase/snake_case/kebab/SCREAMING para comparação. */
function normalizeKey(key: string): string {
  return key.replace(/[-_]/g, '').toLowerCase();
}

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERN.test(key) || FORBIDDEN_KEY_PATTERN.test(normalizeKey(key));
}

/** Material de segredo em QUALQUER posição da string (JWT, Bearer, conn string). */
const FORBIDDEN_VALUE_PATTERN =
  /(eyJ[A-Za-z0-9_-]{10,}(\.[A-Za-z0-9_-]+)*|Bearer\s+\S+|postgres(ql)?:\/\/\S+@\S+)/g;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const scrubbed = value.replace(FORBIDDEN_VALUE_PATTERN, REDACTED);
    return scrubbed.length > MAX_STRING ? `${scrubbed.slice(0, MAX_STRING)}…[truncated]` : scrubbed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[depth-limit]';
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isForbiddenKey(k) ? REDACTED : sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

export interface AuditSanitizer {
  /** Sanitiza estrutura arbitrária (denylist profunda). */
  sanitize(value: unknown): unknown;
  /** Metadados de evento: ALLOWLIST — só chaves aprovadas passam. */
  sanitizeMetadata(
    metadata: Readonly<Record<string, unknown>> | undefined,
    allowlist: readonly string[],
  ): Record<string, string | number | boolean> | null;
  /** Erro sem stack e sem material sensível. */
  sanitizeError(error: unknown): { name: string; message: string };
}

export class DefaultAuditSanitizer implements AuditSanitizer {
  sanitize(value: unknown): unknown {
    return sanitizeValue(value, 0);
  }

  sanitizeMetadata(
    metadata: Readonly<Record<string, unknown>> | undefined,
    allowlist: readonly string[],
  ): Record<string, string | number | boolean> | null {
    if (!metadata) return null;
    const out: Record<string, string | number | boolean> = {};
    for (const key of allowlist) {
      const v = metadata[key];
      if (v === undefined || isForbiddenKey(key)) continue;
      const clean = sanitizeValue(v, 0);
      if (typeof clean === 'string' || typeof clean === 'number' || typeof clean === 'boolean') {
        out[key] = clean;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  sanitizeError(error: unknown): { name: string; message: string } {
    if (error instanceof Error) {
      // mensagem sanitizada; stack NUNCA sai
      const message = sanitizeValue(error.message, 0) as string;
      return { name: error.name, message };
    }
    return { name: 'UnknownError', message: String(sanitizeValue(error, 0)) };
  }
}
