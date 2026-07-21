import { defineConfig, mergeConfig } from 'vitest/config';
import preset from '@tauros/config/vitest';

export default mergeConfig(
  preset,
  defineConfig({
    esbuild: { jsx: 'automatic' },
    test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'] },
  }),
);
