'use client'

import { useTimerStore } from '@/lib/timer/store'
import { formatCountdown } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'

/**
 * The digits, and nothing else.
 *
 * The selector rounds to whole seconds, so Zustand only notifies this
 * component when the displayed value actually changes — four ticks a second
 * arrive, one re-render a second leaves. Everything else on the screen is
 * subscribed to state that changes on phase transitions only.
 */
export function Countdown() {
  const seconds = useTimerStore((s) => Math.ceil(s.remainingMs / 1000))
  const hydrated = useTimerStore((s) => s.hydrated)
  const paused = useTimerStore((s) => s.runtime.status === 'paused')

  // A placeholder number that then snaps to the real one is worse than a
  // moment of nothing. IndexedDB resolves in about a frame.
  if (!hydrated) {
    return (
      <span
        aria-hidden
        className="numerals block h-[1em] w-[3.2em] animate-pulse rounded-md bg-hairline text-[clamp(56px,14vw,88px)]"
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'numerals block text-[clamp(56px,14vw,88px)] leading-none tracking-[-0.04em] text-ink',
        'transition-opacity duration-200',
        paused && 'opacity-50',
      )}
    >
      {formatCountdown(seconds * 1000)}
    </span>
  )
}
