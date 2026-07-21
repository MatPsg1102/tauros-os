/** @type {import('next').NextConfig} */
const nextConfig = {
  // fonte TS dos pacotes usa specifiers ESM '.js' (NodeNext) — mapeia p/ .ts
  webpack: (config, { webpack }) => {
    // infraestrutura inclui verificador de cadeia (server-side) com node:crypto;
    // o cliente não o invoca — remapeia o scheme e não faz polyfill
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:crypto$/, 'crypto'));
    config.resolve.fallback = { ...config.resolve.fallback, crypto: false };
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
  reactStrictMode: true,
  transpilePackages: [
    '@tauros/tokens',
    '@tauros/theme',
    '@tauros/ui-primitives',
    '@tauros/ui-composites',
    '@tauros/ui-operational',
    '@tauros/ui-infrastructure',
    '@tauros/ui-layouts',
    '@tauros/ui-metadata',
    '@tauros/interaction',
    '@tauros/domain',
    '@tauros/application',
    '@tauros/infrastructure',
    '@tauros/config-engine',
    '@tauros/contracts',
  ],
};

export default nextConfig;
