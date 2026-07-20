# @tauros/theme

Ponte oficial entre `@tauros/tokens` e React (Etapa 6.3.2).

- **Preferência ≠ tema efetivo**: `ThemePreferences` (persistível) → resolução
  com o sistema (`matchMedia`) → `resolveTheme` dos tokens. O resultado nunca é
  persistido como escolha.
- **Injeção**: `setProperty` no root com diff incremental e curto-circuito por
  assinatura; cleanup remove só o que foi aplicado; múltiplos roots explícitos.
- **DOM**: atributos `data-theme|contrast|environment|input-mode|motion`.
- **SSR**: portas SSR-safe; DOM apenas em efeitos; snapshot de sistema default
  no servidor, sincronizado pós-mount.
- **Anti-flash**: `buildInitialThemeScript()` gera script mínimo (sem eval,
  storage validado, falha silenciosa) para a aplicação servir com nonce/CSP.
- **Storage**: chave `tauros.theme.preferences.v1`, validação estrita,
  falhas nunca derrubam a aplicação.
- **Aninhamento**: permitido SOMENTE com `target` próprio; sem ele, erro
  orientado (`NestedThemeProviderError`).
