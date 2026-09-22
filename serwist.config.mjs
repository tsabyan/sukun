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
  // The brand art the shell renders with no network: the offline screen's
  // mascot, the error screen's, the placeholder's, and the install slide's
  // icon. They live in `public/`, which is outside globDirectory, and the
  // runtime image cache only helps after a file has already been fetched
  // once — which is exactly not the case on the screen that explains that
  // there is no network. ~25KB in total. docs/04-design-system.md §0.1.
  additionalPrecacheEntries: [
    { url: '/images/mascot/resting.png', revision: null },
    { url: '/images/mascot/surprised.png', revision: null },
    { url: '/images/mascot/thinking.png', revision: null },
    { url: '/images/mascot/normal.png', revision: null },
    { url: '/icons/192.png', revision: null },
  ],
  globIgnores: ['**/*.map', '**/manifest*.js'],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  disablePrecacheManifest: false,
}))
