'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { FlipDigit } from '@/components/timer/FlipDigit'
import { useTimerStore } from '@/lib/timer/store'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { updateSettings } from '@/lib/db/repo'
import { formatCountdown } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'

const PHASE_RAIL = {
  focus: 'FOCUS',
  short_break: 'BREAK',
  long_break: 'REST',
} as const

const IDLE_HIDE_MS = 3000

/**
 * S3 — the flip clock.
 *
 * A dedicated, distraction-free view of the same running machine. This is the
 * screen people screenshot, which is the argument for it existing at all: it
 * turns a utility into an identity.
 *
 * Deliberately not orientation-locked. A browser tab cannot hold a lock
 * reliably, and a landscape flip clock on a propped-up phone is the best
 * version of this screen — so the layout reflows rather than fighting it.
 */
export default function FlipClockPage() {
  const router = useRouter()

  const seconds = useTimerStore((s) => Math.ceil(s.remainingMs / 1000))
  const status = useTimerStore((s) => s.runtime.status)
  const phase = useTimerStore((s) => s.runtime.phase)
  const hydrated = useTimerStore((s) => s.hydrated)
  const muted = useTimerStore((s) => s.muted)

  const [controlsVisible, setControlsVisible] = useState(true)
  const reduceMotion = usePrefersReducedMotion()
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* — controls get out of the way, and come back on any input */
  const wake = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), IDLE_HIDE_MS)
  }, [])

  useEffect(() => {
    // Controls already render visible, so this only starts the countdown —
    // no state is set synchronously here.
    hideTimer.current = setTimeout(() => setControlsVisible(false), IDLE_HIDE_MS)

    const events: Array<keyof WindowEventMap> = ['pointermove', 'pointerdown', 'keydown']
    events.forEach((event) => window.addEventListener(event, wake))
    return () => {
      events.forEach((event) => window.removeEventListener(event, wake))
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [wake])

  /* — Esc leaves, space toggles; the timer keeps running either way */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') router.push('/')
      if (event.key === ' ') {
        event.preventDefault()
        useTimerStore.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  /* — keep the screen on while someone is staring at it */
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let released = false

    const request = async () => {
      try {
        sentinel = (await navigator.wakeLock?.request('screen')) ?? null
      } catch {
        // Unsupported, or refused because the tab is not visible. Neither is
        // worth telling the user about — the clock still runs.
      }
    }

    void request()

    // The lock is dropped whenever the tab is hidden, so it has to be re-taken
    // on return or the screen sleeps for the rest of the session.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) void request()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [])

  const exit = () => {
    void updateSettings({ defaultTimerMode: 'ring' })
    router.push('/')
  }

  const display = hydrated ? formatCountdown(seconds * 1000) : '--:--'
  const [m1, m2, s1, s2] = display.replace(':', '').split('')
  const running = status === 'running'
  const digitSize = { fontSize: 'clamp(72px, 22vw, 180px)' }

  return (
    <main
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-6"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <p aria-live="polite" className="sr-only">
        {hydrated ? `${display} remaining, ${status}` : 'Loading timer'}
      </p>

      {/* portrait stacks the pairs; landscape lays all four in a row */}
      <div className="flex flex-col items-center gap-3 landscape:flex-row landscape:gap-4">
        <div className="flex gap-2 landscape:gap-3" style={digitSize}>
          <FlipDigit value={m1} animate={!reduceMotion} />
          <FlipDigit value={m2} animate={!reduceMotion} />
        </div>

        <Separator />

        <div className="flex gap-2 landscape:gap-3" style={digitSize}>
          <FlipDigit value={s1} animate={!reduceMotion} />
          <FlipDigit value={s2} animate={!reduceMotion} />
        </div>
      </div>

      <span
        aria-hidden
        className="eyebrow pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-3"
        style={{ writingMode: 'vertical-rl' }}
      >
        {PHASE_RAIL[phase]}
      </span>

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 pb-8',
          'transition-opacity duration-500',
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <RailButton label="Reset" onClick={() => useTimerStore.getState().reset()}>
          <RotateCcw size={18} strokeWidth={1.75} />
        </RailButton>

        <RailButton
          label={running ? 'Pause' : 'Start'}
          primary
          onClick={() => useTimerStore.getState().toggle()}
        >
          {running ? (
            <Pause size={22} strokeWidth={1.75} fill="currentColor" />
          ) : (
            <Play size={22} strokeWidth={1.75} fill="currentColor" className="ml-0.5" />
          )}
        </RailButton>

        <RailButton label="Skip" onClick={() => useTimerStore.getState().skip()}>
          <SkipForward size={18} strokeWidth={1.75} />
        </RailButton>

        <RailButton
          label={muted ? 'Unmute alerts' : 'Mute alerts'}
          onClick={() => useTimerStore.getState().toggleMuted()}
        >
          {muted ? (
            <VolumeX size={18} strokeWidth={1.75} />
          ) : (
            <Volume2 size={18} strokeWidth={1.75} />
          )}
        </RailButton>

        <RailButton label="Exit flip clock" onClick={exit}>
          <X size={18} strokeWidth={1.75} />
        </RailButton>
      </div>
    </main>
  )
}

function Separator() {
  return (
    <span
      aria-hidden
      className="flex gap-2 px-[0.15em] landscape:flex-col landscape:gap-3"
    >
      {[0, 1].map((i) => (
        <span
          key={i}
          className="block size-2.5 rounded-full bg-accent"
          style={{ animation: 'sukun-pulse 2s ease-in-out infinite' }}
        />
      ))}
    </span>
  )
}

function RailButton({
  label,
  primary,
  onClick,
  children,
}: {
  label: string
  primary?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-full transition-colors',
        primary
          ? 'size-14 bg-accent text-canvas'
          : 'size-11 text-ink-3 hover:bg-surface hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
