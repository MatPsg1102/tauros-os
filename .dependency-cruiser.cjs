/**
 * Architectural boundaries — the package graph is the enforcement mechanism.
 * These rules turn the SAS (Clean Architecture) and the Component Library
 * Governance dependency rules into CI failures. Do not relax without an ADR.
 */
module.exports = {
  forbidden: [
    {
      name: 'web-ui-no-infrastructure',
      comment: 'UI do app fala com contratos de aplicação; só o wiring monta adapters (7.1 §42).',
      severity: 'error',
      from: { path: '^apps/web/src/(app|ui|controllers|navigation)/' },
      to: { path: '^packages/(infrastructure|config-engine)/' },
    },
    {
      name: 'core-no-react',
      comment: 'Domínio/aplicação nunca importam React/Next/browser frameworks (7.1 §42).',
      severity: 'error',
      from: { path: '^packages/(domain|application|contracts)/' },
      to: { path: '^(react|react-dom|next)($|/)|node_modules/(react|react-dom|next)/' },
    },
    {
      name: 'storybook-no-backend',
      comment: 'Storybook documenta o Design System; nunca importa backend/domínio (6.3.8 §26).',
      severity: 'error',
      from: { path: '^apps/storybook/' },
      to: {
        path: '^packages/(infrastructure|domain|application|config-engine|contracts)/|node_modules/(@supabase|@prisma|prisma)',
      },
    },
    {
      name: 'storybook-public-imports-only',
      comment: 'Stories consomem apenas a API pública (index) dos pacotes do DS (6.3.8 §5).',
      severity: 'error',
      from: { path: '^apps/storybook/' },
      to: { path: '^packages/(ui-[a-z-]+|theme|tokens)/src/(?!index.ts$).+' },
    },
    {
      name: 'ui-no-router',
      comment: 'Design System nunca acopla roteador (contrato neutro de links — 6.3.6 §1).',
      severity: 'error',
      from: { path: '^packages/ui-' },
      to: {
        path: '^(react-router|react-router-dom|next/router|next/navigation|@tanstack/react-router)|node_modules/(react-router|@remix-run|@tanstack/react-router|next/(dist/)?client/(components/)?(navigation|router))',
      },
    },
    {
      name: 'ui-no-external-backend',
      comment: 'Pacotes de UI nunca importam Prisma/Supabase (backend fica atrás de ports).',
      severity: 'error',
      from: { path: '^packages/ui-' },
      to: { path: 'node_modules/(@prisma|prisma|@supabase)' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },

    // --- apps/carcass-cost (regras ADITIVAS — mesmas invariantes de camada
    // dos pacotes, aplicadas ao app isolado; nenhuma regra existente mudou) ---
    {
      name: 'carcass-domain-is-pure',
      comment: 'Domínio da calculadora é TS puro: sem React e sem camadas de cima (ui/state).',
      severity: 'error',
      from: { path: '^apps/carcass-cost/src/domain/' },
      to: {
        path: '^(react|react-dom)($|/)|node_modules/(react|react-dom)/|^apps/carcass-cost/src/(ui|state)/',
      },
    },
    {
      name: 'carcass-ui-presents-only',
      comment: 'Telas apresentam; persistência entra só pelo controller (state/use-calculator).',
      severity: 'error',
      from: { path: '^apps/carcass-cost/src/ui/' },
      to: { path: '^apps/carcass-cost/src/state/storage[.]ts' },
    },

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
