# @tauros/tokens

Design Tokens oficiais do Tauros OS (Etapa 5.2 congelada) — fonte agnóstica
de framework (Ajuste 3: Web/RN/desktop/relatórios via transformação).

- `core` — primitivos sem significado (cor, tipo, espaço 4px, radius, sombra,
  opacidade, z-index, motion, breakpoints, alvos de toque, densidade).
- `lightTheme` / `darkTheme` — Semantic resolvido; status **multidimensional**
  (cor + forma + ícone — P5); ênfase 1–5; **glove-first no default (64px)**.
- `contextTokens` — estados do domínio (8 da fila, sessão, permissão, config,
  estoque, incidente, prioridade, conexão) + `dominantStatus` (estados
  compostos com precedência — Ajuste 2).
- `resolveAliases` — aliases de composição (actionable, destructive, card,
  focusRing, disabled — Ajuste 1).
- `resolveTheme(modes)` — Runtime combinável: dark · highContrast · industrial
  · glove · reducedMotion (rebinding, sem duplicar Semantic).
- `toCssVariables` / `toCssBlock` / `cssVar` — consumo via CSS Variables
  (`--tauros-*`); o ThemeProvider (6.3.2) injeta, componentes só usam `cssVar`.
