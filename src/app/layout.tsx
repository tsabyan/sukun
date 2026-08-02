import type { Metadata, Viewport } from 'next'
import { Archivo, Instrument_Sans } from 'next/font/google'
import '@/styles/globals.css'
import { themeScript } from '@/lib/theme/script'
import { ThemeProvider } from '@/lib/theme/use-theme'
import { AppShell } from '@/components/shell/AppShell'
import { DaylightLayer } from '@/components/shell/DaylightLayer'
import { DevBridge } from '@/components/dev/DevBridge'
import { TimerEngine } from '@/components/timer/TimerEngine'
import { ToastViewport } from '@/components/ui/Toast'

// Instrument voice — timer digits, headings, condensed data labels.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
})

// Human voice — everything read as a sentence.
const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sukun — Focus Timer',
  description: 'A calm Pomodoro timer and daily planner. Stillness, on a timer.',
  applicationName: 'Sukun',
  appleWebApp: {
    capable: true,
    title: 'Sukun',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F6F8' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1216' },
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
      className={`${archivo.variable} ${instrument.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <DaylightLayer />
          <AppShell>{children}</AppShell>
          <ToastViewport />
          <TimerEngine />
          <DevBridge />
        </ThemeProvider>
      </body>
    </html>
  )
}
