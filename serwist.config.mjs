import { serwist } from '@serwist/next/config'

/**
 * Serwist in configurator mode — docs/08-deployment.md §5.
 *
 * Classic mode injects a webpack config, which Next 16 rejects now that
 * Turbopack is the default builder. Configurator mode runs as a separate step
 * after `next build` instead, reading the finished output, so the app keeps
 * building with Turbopack.
 *
 * Driven by `npm run build`, which chains the two.
 */
export default await serwist.withNextConfig((nextConfig) => ({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  globDirectory: nextConfig.distDir ?? '.next',
  // Precache the built shell. Data is never cached — it lives in IndexedDB,
  // which is already offline.
  globPatterns: ['static/**/*.{js,css,woff2}'],
  globIgnores: ['**/*.map', '**/manifest*.js'],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  disablePrecacheManifest: false,
}))
