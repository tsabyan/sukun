'use client'

import Link from 'next/link'
import { Pause, Play, Timer } from 'lucide-react'
import { motion } from 'motion/react'
import { IconTile } from '@/components/ui/IconTile'
import { useTimerStore } from '@/lib/timer/store'
import { formatCountdown } from '@/lib/utils/dates'
import { spring } from '@/lib/motion/tokens'

const PHASE_WORD = {
  focus: 'Focusing',
  short_break: 'Short break',
  long_break: 'Long break',
} as const

/**
 * B2 — the running session, seen from Home.
 *
 * Home is a dashboard, not the timer, so a live session needs a thread back to
 * it: a charcoal strip that says what is running and how long is left, taps
 * through to the focus screen, and carries the one control worth having here.
 * It renders nothing while the machine is idle.
 */
export function NowFocusingBanner() {
  const status = useTimerStore((s) => s.runtime.status)
  const phase = useTimerStore((s) => s.runtime.phase)
  const seconds = useTimerStore((s) => Math.ceil(s.remainingMs / 1000))
  const cycleCount = useTimerStore((s) => s.runtime.cycleCount)
  const perCycle = useTimerStore((s) => s.durations.sessionsUntilLongBreak)
  const taskTitle = useTimerStore((s) => s.attachedTaskTitle)

  if (status === 'idle') return null

  const running = status === 'running'
  const title =
    phase === 'focus' && taskTitle ? `Focusing · ${taskTitle}` : PHASE_WORD[phase]

  return (
    <section className="flex items-center gap-3 rounded-lg bg-ink p-3 text-surface">
      <Link
        href="/focus"
        className="flex min-w-0 flex-1 items-center gap-3"
        aria-label="Open the focus screen"
      >
        <IconTile icon={Timer} tone="green" size={40} className="bg-green [&>svg]:text-ink" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium">{title}</span>
          <span className="block truncate text-body-sm text-surface/60">
            <span className="numerals">{formatCountdown(seconds * 1000)}</span> left ·{' '}
            {phase === 'focus'
              ? `session ${(cycleCount % perCycle) + 1} of ${perCycle}`
              : 'tap to open'}
          </span>
        </span>
      </Link>

      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        transition={spring.snappy}
        aria-label={running ? 'Pause session' : 'Resume session'}
        onClick={() => useTimerStore.getState().toggle()}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-green text-on-accent"
      >
        {running ? (
          <Pause size={16} strokeWidth={2} fill="currentColor" />
        ) : (
          <Play size={16} strokeWidth={2} fill="currentColor" />
        )}
      </motion.button>
    </section>
  )
}
