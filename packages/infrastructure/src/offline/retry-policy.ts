// Política de retry/backoff (RA-QUEUE-01 §5 · Baseline §1).
// TODOS os valores vêm do Configuration Engine — nenhum default duplicado aqui.

import type { ConfigResolver } from '@tauros/config-engine';

import type { ErrorClassification } from './queue-item.js';

export interface RetryDecision {
  readonly retry: boolean;
  readonly delayMs: number;
}

export class RetryPolicy {
  constructor(
    private readonly config: ConfigResolver,
    /** Injetável p/ testes determinísticos do jitter. */
    private readonly random: () => number = Math.random,
  ) {}

  /** Erros que voltam ao fluxo automático. */
  isTransient(classification: ErrorClassification): boolean {
    return classification === 'RECOVERABLE' || classification === 'AUTH_RETRYABLE';
  }

  /**
   * Decide retry para a PRÓXIMA tentativa (attempt = tentativas já feitas).
   * Backoff exponencial com equal jitter (Baseline):
   *   comp = min(cap, base·factor^(n−1)) / 2 ; delay = comp + rand(0, comp).
   */
  async decide(
    attemptCount: number,
    classification: ErrorClassification,
    storeId: string,
    retryAfterMs?: number,
  ): Promise<RetryDecision> {
    if (!this.isTransient(classification)) return { retry: false, delayMs: 0 };

    const maxAttempts = await this.config.resolve('sync.retry.maxAttempts', storeId);
    if (attemptCount >= maxAttempts) return { retry: false, delayMs: 0 };

    const honorRetryAfter = await this.config.resolve('sync.retry.honorRetryAfter');
    if (retryAfterMs !== undefined && honorRetryAfter) {
      return { retry: true, delayMs: retryAfterMs };
    }

    const base = await this.config.resolve('sync.retry.baseDelayMs', storeId);
    const factor = await this.config.resolve('sync.retry.factor', storeId);
    const cap = await this.config.resolve('sync.retry.capMs', storeId);

    const exponential = Math.min(cap, base * Math.pow(factor, Math.max(0, attemptCount - 1)));
    const component = exponential / 2;
    const jitter = await this.config.resolve('sync.retry.jitter');
    const delayMs = jitter === 'equal' ? component + this.random() * component : exponential;

    return { retry: true, delayMs: Math.round(delayMs) };
  }

  /** Invalidação sob evento de mudança de configuração (*Changed). */
  onConfigurationChanged(storeId?: string): void {
    this.config.invalidate(storeId);
  }
}
