// AuditRetryPolicyPort delegando à RetryPolicy oficial (Baseline via
// Configuration Engine) — nenhum default duplicado.

import type { RetryPolicy } from '../offline/retry-policy.js';
import type { AuditRetryPolicyPort } from './audit-ports.js';

export class ConfigDrivenAuditRetryPolicy implements AuditRetryPolicyPort {
  constructor(private readonly retry: RetryPolicy) {}

  async decide(
    attempt: number,
    storeId: string | null,
  ): Promise<{ retry: boolean; delayMs: number }> {
    const decision = await this.retry.decide(attempt, 'RECOVERABLE', storeId ?? '__global__');
    return { retry: decision.retry, delayMs: decision.delayMs };
  }
}
