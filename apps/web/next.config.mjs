/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@tauros/tokens',
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
