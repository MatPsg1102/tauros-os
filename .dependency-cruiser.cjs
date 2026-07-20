/**
 * Architectural boundaries — the package graph is the enforcement mechanism.
 * These rules turn the SAS (Clean Architecture) and the Component Library
 * Governance dependency rules into CI failures. Do not relax without an ADR.
 */
module.exports = {
  forbidden: [
    {
      name: 'ui-no-external-backend',
      comment: 'Pacotes de UI nunca importam Prisma/Supabase (backend fica atrás de ports).',
      severity: 'error',
      from: { path: '^packages/ui-' },
      to: { path: 'node_modules/(@prisma|prisma|@supabase)' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },

    // --- Clean Architecture (SAS §2) ---
    {
      name: 'domain-is-pure',
      comment: 'Domain must not depend on any other layer or framework.',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: {
        path: '^packages/(application|infrastructure|config-engine|ui-metadata|ui-|interaction)/|^apps/',
      },
    },
    {
      name: 'application-depends-only-on-domain-contracts',
      severity: 'error',
      from: { path: '^packages/application/' },
      to: { path: '^packages/(infrastructure|config-engine|ui-metadata|ui-|interaction)/|^apps/' },
    },
    {
      name: 'core-never-imports-infrastructure',
      comment: 'Domain/Application depend on ports, never on adapters.',
      severity: 'error',
      from: { path: '^packages/(domain|application)/' },
      to: { path: '^packages/infrastructure/' },
    },

    // --- Component Library Governance (categories, unidirectional) ---
    {
      name: 'theme-only-tokens',
      comment: 'O ThemeProvider so consome @tauros/tokens — nunca infra/dominio/ui.',
      severity: 'error',
      from: { path: '^packages/theme/' },
      to: {
        path: '^packages/(?!tokens|theme|config/)[^/]+/|^apps/',
      },
    },
    {
      name: 'primitives-only-tokens',
      severity: 'error',
      from: { path: '^packages/ui-primitives/' },
      to: {
        path: '^packages/(ui-composites|ui-operational|ui-infrastructure|ui-layouts|ui-metadata|domain|application|infrastructure|config-engine)/',
      },
    },
    {
      name: 'composites-no-domain-no-higher',
      severity: 'error',
      from: { path: '^packages/ui-composites/' },
      to: {
        path: '^packages/(ui-operational|ui-infrastructure|ui-layouts|domain|application|infrastructure|config-engine)/',
      },
    },
    {
      name: 'operational-never-infrastructure',
      comment: 'Operational knows domain concepts, never infrastructure.',
      severity: 'error',
      from: { path: '^packages/ui-operational/' },
      to: { path: '^packages/(ui-infrastructure|infrastructure|config-engine)/' },
    },
    {
      name: 'infra-ui-never-domain-nor-operational',
      severity: 'error',
      from: { path: '^packages/ui-infrastructure/' },
      to: { path: '^packages/(ui-operational|domain|application)/' },
    },
    {
      name: 'layouts-organize-only',
      comment: 'Layouts host operational/infra via slots; never import them or the domain.',
      severity: 'error',
      from: { path: '^packages/ui-layouts/' },
      to: {
        path: '^packages/(ui-operational|ui-infrastructure|domain|application|infrastructure|config-engine)/',
      },
    },
    {
      name: 'ui-never-backend',
      severity: 'error',
      from: { path: '^packages/ui-' },
      to: { path: '^packages/(application|infrastructure)/' },
    },
  ],
  options: {
    // Never analyse dependencies, build output or coverage — only source.
    exclude: { path: '(node_modules|storybook-static|[.]next|dist|coverage|[.]turbo)' },
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
  },
};
