import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Base flat config for the Tauros OS monorepo.
 * Boundaries between architectural layers are enforced by dependency-cruiser
 * (see .dependency-cruiser.cjs). ESLint handles code quality only.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/storybook-static/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
