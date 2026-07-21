// Parâmetros semânticos de Toast (6.3.5 §9) — contrato tipado único, no
// padrão dos parâmetros técnicos aprovados do projeto (ADR-018A / 6.2.7).
// Duração de LEITURA não é motion token (motion cobre transições visuais);
// é parâmetro semântico aprovado aqui, substituível por prop `duration`.
// Sob reducedMotion a duração de leitura NÃO é reduzida.

export interface ToastParameters {
  /** Tempo de leitura padrão de um toast informativo. */
  readonly readingDurationMs: number;
  /** Toasts urgentes permanecem mais tempo. */
  readonly urgentReadingDurationMs: number;
  /** Máximo de toasts visíveis simultaneamente; excedente aguarda em fila. */
  readonly maxVisible: number;
}

export const TOAST_PARAMETERS: ToastParameters = {
  readingDurationMs: 6000,
  urgentReadingDurationMs: 10000,
  maxVisible: 3,
};
