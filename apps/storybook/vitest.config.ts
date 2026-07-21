import { defineConfig, mergeConfig } from 'vitest/config';
import preset from '@tauros/config/vitest';

export default mergeConfig(
  preset,
  defineConfig({ test: { environment: 'jsdom', include: ['tests/**/*.test.tsx'] } }),
);
