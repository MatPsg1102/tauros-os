import { defineConfig } from 'vitest/config';

// Preset compartilhado (formato .mjs: executável em qualquer Node, incl. CI Node 20).
// Coverage estruturado; thresholds sobem por pacote quando houver testes (ADR-018A).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
    },
  },
});
