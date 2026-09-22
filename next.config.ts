import type { NextConfig } from 'next'

/**
 * No Serwist plugin here on purpose.
 *
 * Classic `withSerwistInit` injects a webpack config, and Next 16 builds with
 * Turbopack by default — the combination is a hard build error. The service
 * worker is generated instead by `serwist.config.mjs` as a post-build step;
 * see `npm run build`.
 */

/**
 * Security headers — docs/08-deployment.md §3.
 *
 * Read the CSP honestly. `script-src` carries `'unsafe-inline'` because Next
 * emits inline bootstrap and hydration scripts, and this app adds one of its
 * own: the blocking theme script in `<head>`, which has to run before first
 * paint. The nonce-based alternative needs middleware on every request, which
 * would turn a statically prerendered, local-first app into a dynamic one to
 * defend against an injection vector it does not have — no user-generated
 * HTML is ever rendered, and there are no third-party scripts at all.
 *
 * `'unsafe-eval'` is added in development and only there. React's development
 * build uses eval() to reconstruct call stacks from another environment, so a
 * dev server under the production CSP throws on every error overlay. Guarding
 * it on NODE_ENV keeps the deployed policy exactly as strict as it reads,
 * while the local one stops fighting the debugger.
 *
 * So the value here is in the other directives, and they are real:
 *   - `frame-ancestors` / X-Frame-Options stop the app being framed, which is
 *     the actual clickjacking risk for a one-tap UI.
 *   - `connect-src` means a stray script could not exfiltrate anywhere but
 *     Supabase, which is the single thing this app is allowed to talk to.
 *   - `base-uri` and `form-action` close the two classic redirect tricks.
 *   - `object-src 'none'` retires the plugin surface entirely.
 */
const dev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // data: for the inlined mascot and icon variants; blob: for canvas exports.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // next/font self-hosts, so there is no font CDN here. Supabase is the only
  // origin this app is ever allowed to reach.
  // ws: is the dev server's hot-reload socket, which does not exist in a
  // production build.
  `connect-src 'self' https://*.supabase.co${dev ? ' ws: http://localhost:*' : ''}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Omitted in development: the dev server is plain http on localhost, and
  // there is nothing to upgrade to.
  ...(dev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The app asks for notifications and a wake lock, both of which stay
  // available to itself by default. Everything it has no business touching is
  // switched off, so a future dependency cannot quietly start asking.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // The worker is served from the origin root and must not be cached by a
      // CDN longer than the build that produced it, or an update ships to
      // nobody. Serwist versions the precache, not this file.
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
