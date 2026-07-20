import { defineConfig } from 'vitest/config';

// Preset compartilhado. Coverage já estruturado; os thresholds ficam em 0
// (efetivamente desabilitados) e serão elevados por pacote quando houver testes
// — ver docs/adr/ADR-018A-implementation-conventions.md.
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
