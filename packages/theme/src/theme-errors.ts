// Erros orientados do Theme Provider (P7: causa + próximo passo).

export class ThemeProviderMissingError extends Error {
  constructor() {
    super(
      'useTheme() foi chamado fora de um <ThemeProvider>. ' +
        'Envolva a árvore da aplicação com <ThemeProvider> (normalmente no root).',
    );
    this.name = 'ThemeProviderMissingError';
  }
}

export class NestedThemeProviderError extends Error {
  constructor() {
    super(
      'ThemeProvider aninhado sem root próprio. ' +
        'Providers aninhados são suportados SOMENTE com a prop `target` apontando ' +
        'para um elemento próprio (isolamento de CSS variables e atributos). ' +
        'Sem `target`, o provider interno alteraria o tema global indevidamente.',
    );
    this.name = 'NestedThemeProviderError';
  }
}
