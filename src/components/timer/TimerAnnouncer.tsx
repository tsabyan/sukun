'use client'

import { useTimerStore } from '@/lib/timer/store'
import { formatCountdown } from '@/lib/utils/dates'

const PHASE_NAME = {
  focus: 'Focus',
  short_break: 'Short break',
  long_break: 'Long break',
} as const

const STATUS_VERB = {
  idle: 'ready',
  running: 'running',
  paused: 'paused',
} as const

/**
 * The screen-reader half of the timer.
 *
 * The countdown itself is aria-hidden — announcing a number every second is
 * unusable. This announces phase and status changes only, and carries a
 * readable summary of the remaining time at the moment of the change.
 */
export function TimerAnnouncer() {
  const phase = useTimerStore((s) => s.runtime.phase)
  const status = useTimerStore((s) => s.runtime.status)
  const hydrated = useTimerStore((s) => s.hydrated)

  // Read at render rather than subscribed, so this does not re-render per tick.
  const remaining = hydrated ? useTimerStore.getState().remainingMs : 0

  return (
    <p aria-live="polite" className="sr-only">
      {hydrated
        ? `${PHASE_NAME[phase]} ${STATUS_VERB[status]}. ${formatCountdown(remaining)} remaining.`
        : 'Loading timer.'}
    </p>
  )
}
