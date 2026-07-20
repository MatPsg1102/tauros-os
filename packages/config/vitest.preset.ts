import { defineConfig } from 'vitest/config';

// Shared Vitest preset for all packages.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
});
