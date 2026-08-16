// Tradução ÚNICA das rejeições de identidade para linguagem operacional.
// Regra: condição PERMANENTE nunca vira "tente novamente" (instrução que não
// vai funcionar); INVALID_PIN/UNKNOWN seguem neutros (não revelam existência
// de credencial — ADR-021 §8). Compartilhado por /operacao, /encarregado e
// /turno — nenhuma tela inventa a própria versão.

import type { IdentityRejectionCode } from '@tauros/contracts';

export function identityRejectionMessage(code: IdentityRejectionCode): string {
  switch (code) {
    case 'LOCKED_OUT':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'NO_CREDENTIAL':
      return 'Você ainda não tem PIN cadastrado neste aparelho. Procure o encarregado.';
    case 'REAUTH_REQUIRED':
      return 'Seu acesso precisa ser revalidado. Peça ao encarregado para redefinir seu PIN.';
    case 'OFFLINE_WINDOW_EXPIRED':
      return 'Sua identificação venceu neste aparelho. Peça ao encarregado para redefinir seu PIN.';
    default:
      return 'Não foi possível confirmar a identificação. Confira e tente novamente.';
  }
}
