// Mensagens pt-BR de validação por código do domínio — nenhuma tela inventa a
// própria versão (mesmo princípio do identity-messages do apps/web).

import type { IssueCode, ValidationIssue } from '../domain/validation.js';

export const ISSUE_MESSAGES: Record<IssueCode, string> = {
  REQUIRED: 'Informe este valor.',
  NEGATIVE: 'O valor não pode ser negativo.',
  NOT_POSITIVE: 'O valor precisa ser maior que zero.',
  NOT_INTEGER: 'Use um número inteiro de animais.',
  PCT_OUT_OF_RANGE: 'O percentual precisa ser de 0% até menos de 100%.',
  DISCOUNTS_EXCEED_SCALE: 'Os descontos não podem ser iguais ou maiores que o peso na balança.',
  SLAUGHTERED_EXCEEDS_PAID: 'O peso abatido não pode ser maior que o peso pago.',
  CHILLED_EXCEEDS_SLAUGHTERED: 'O peso após frio não pode ser maior que o peso abatido.',
};

/**
 * Prop `error` pronta para o Field (spread condicional — o tsconfig usa
 * exactOptionalPropertyTypes, então a chave só existe quando há erro).
 */
export function errorProp(
  issues: readonly ValidationIssue[],
  field: string,
): { readonly error?: string } {
  const issue = issues.find((candidate) => candidate.field === field);
  return issue === undefined ? {} : { error: ISSUE_MESSAGES[issue.code] };
}
