import type { NextConfig } from 'next'

/**
 * No Serwist plugin here on purpose.
 *
 * Classic `withSerwistInit` injects a webpack config, and Next 16 builds with
 * Turbopack by default — the combination is a hard build error. The service
 * worker is generated instead by `serwist.config.mjs` as a post-build step;
 * see `npm run build`.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
}

export default nextConfig
