'use client'

import { useTimerStore } from '@/lib/timer/store'

const PHASE_NAME = {
  focus: 'Focus',
  short_break: 'Short break',
  long_break: 'Long break',
} as const

/**
 * The line above the digits. Reads "FOCUS · 3 OF 4" during work, and simply
 * "PAUSED" when the clock is held — the phase name is redundant once nothing
 * is moving.
 */
export function PhaseLabel() {
  const phase = useTimerStore((s) => s.runtime.phase)
  const status = useTimerStore((s) => s.runtime.status)
  const cycleCount = useTimerStore((s) => s.runtime.cycleCount)
  const perCycle = useTimerStore((s) => s.durations.sessionsUntilLongBreak)

  if (status === 'paused') {
    return <span className="eyebrow text-ink-3">Paused</span>
  }

  const position = phase === 'focus' ? `${(cycleCount % perCycle) + 1} of ${perCycle}` : null

  return (
    <span className="eyebrow text-accent">
      {PHASE_NAME[phase]}
      {position && <span className="text-ink-3"> · {position}</span>}
    </span>
  )
}
