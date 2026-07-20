import { defineConfig, mergeConfig } from 'vitest/config';
import preset from '@tauros/config/vitest';

// DOM/React exigem jsdom; o restante do preset compartilhado permanece.
export default mergeConfig(preset, defineConfig({ test: { environment: 'jsdom' } }));
