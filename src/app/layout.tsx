import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import '@/styles/globals.css'
import { themeScript } from '@/lib/theme/script'
import { ThemeProvider } from '@/lib/theme/use-theme'
import { AppShell } from '@/components/shell/AppShell'
import { DaylightLayer } from '@/components/shell/DaylightLayer'
import { DevBridge } from '@/components/dev/DevBridge'
import { MobileViewport } from '@/components/dev/MobileViewport'
import { TimerEngine } from '@/components/timer/TimerEngine'
import { ToastViewport } from '@/components/ui/Toast'
import { SyncIndicator } from '@/components/sync/SyncIndicator'
import { DeferredProviders } from '@/components/shell/DeferredProviders'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { KeyboardShortcuts } from '@/components/shell/KeyboardShortcuts'

/**
 * One family for the whole app — docs/04 §2. Outfit's geometric lowercase
 * suits the brand, and its 300 weight is what makes the big numerals read as
 * an instrument panel rather than a headline.
 */
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sukun — Focus Timer',
  description: 'A calm Pomodoro timer and daily planner. Stillness, on a timer.',
  applicationName: 'Sukun',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Sukun',
    statusBarStyle: 'black-translucent',
  },
  // No `icons` block on purpose. Next picks up app/icon.svg, app/icon.png and
  // app/apple-icon.png from the file convention, and an explicit block here
  // overrides all three — which is how the tab icon ended up being a 192px PNG
  // rendered into a 16px slot, with the scalable SVG never linked at all.
  // The app is a tool, not a page. Nothing here should be indexed as content.
  robots: { index: true, follow: true },
  formatDetection: { telephone: false, date: false, address: false, email: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F0F0F1' },
    { media: '(prefers-color-scheme: dark)', color: '#1B1C1E' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the blocking script below sets data-theme,
    // data-phase, and --daylight-tint before React ever sees the document.
    <html
      lang="en"
      suppressHydrationWarning
      className={outfit.variable}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <DaylightLayer />
          <SyncIndicator />
          <AppShell>{children}</AppShell>
          <ToastViewport />
          <Onboarding />
          <TimerEngine />
          <KeyboardShortcuts />
          <DeferredProviders />
          <DevBridge />
          <MobileViewport />
        </ThemeProvider>
      </body>
    </html>
  )
}
