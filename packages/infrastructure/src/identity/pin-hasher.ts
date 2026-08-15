// Derivação/verificação do verifier de PIN (ADR-021 §5/§6, Baseline §3).
// PRIMITIVA TÉCNICA: recebe PIN em claro, deriva o verifier e o compara em
// tempo constante — NUNCA persiste nem devolve o PIN. O verifier derivado NÃO
// é bearer credential: comprova conhecimento do PIN localmente, jamais concede
// acesso por igualdade de hash enviada ao servidor.
//
// Decisão de IMPLEMENTAÇÃO (não altera a política congelada): o Baseline define
// auth.pin.hashAlgo=argon2id como preferência e auth.pin.kdfIterations como o
// FALLBACK PBKDF2. Argon2id exigiria dependência WASM de produção; esta fase
// implementa o fallback PBKDF2-SHA256 via WebCrypto (sem nova dependência). O
// algoritmo usado é gravado por credencial (`algorithm`), permitindo um adapter
// argon2id coexistir no futuro sem migração destrutiva.

const PBKDF2_HASH = 'SHA-256';
const DERIVED_BITS = 256;
const SALT_BYTES = 16;

export const PIN_HASH_ALGORITHM = 'PBKDF2-SHA256' as const;

/** Metadados públicos do KDF gravados na credencial (sem segredo). */
export interface PinKdfParams {
  readonly iterations: number;
}

/**
 * Porta técnica de hashing de PIN — permite trocar o KDF (PBKDF2 → argon2id)
 * sem tocar o store de credencial.
 */
export interface PinHasherPort {
  readonly algorithm: string;
  generateSalt(): string;
  /** Deriva o verifier (base64) do PIN com o salt (base64) e as iterações. */
  derive(pin: string, saltBase64: string, iterations: number): Promise<string>;
  /** Compara em tempo constante um verifier candidato com o armazenado. */
  matches(candidateBase64: string, storedBase64: string): boolean;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Comparação em tempo constante (não vaza posição da primeira diferença). */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class Pbkdf2PinHasher implements PinHasherPort {
  readonly algorithm = PIN_HASH_ALGORITHM;

  constructor(private readonly crypto: Crypto = globalThis.crypto) {}

  generateSalt(): string {
    const salt = new Uint8Array(SALT_BYTES);
    this.crypto.getRandomValues(salt);
    return toBase64(salt);
  }

  async derive(pin: string, saltBase64: string, iterations: number): Promise<string> {
    const keyMaterial = await this.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await this.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: fromBase64(saltBase64), iterations, hash: PBKDF2_HASH },
      keyMaterial,
      DERIVED_BITS,
    );
    return toBase64(new Uint8Array(bits));
  }

  matches(candidateBase64: string, storedBase64: string): boolean {
    return constantTimeEquals(candidateBase64, storedBase64);
  }
}
