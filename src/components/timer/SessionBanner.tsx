'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
 * B2 — the running session, at the top of every screen.
 *
 * It was Home's alone, which meant a session you walked away from left no
 * trace: three taps into Habits you could not tell the timer was running or
 * get back to it. It now renders directly under every screen's header, in the
 * flow — a strip floating over the tab bar was tried first and read as a
 * notification rather than as part of the page. Issue #6.
 *
 * `PageHeader` renders it, so every titled screen gets it in the same place
 * without asking; Home, whose header is its own, places it by hand.
 *
 * **Sticky.** The header scrolls away; this does not. A session is the one
 * piece of state that stays true no matter how far down a screen you are, and
 * a control you have to scroll back up to reach is one you stop using. The
 * outer element carries the canvas bleed — negative margins undo `<main>`'s
 * side padding — so page content passes *behind* an opaque strip rather than
 * showing through the gaps around the card's rounded corners.
 *
 * Not on Settings (you are there to change the machine, not watch it), not on
 * /focus (that screen *is* the session), and nothing at all while idle.
 *
 * No session counter. It used to read "session 1 of 4" from the long-break
 * cycle, which is a claim about the cycle wearing the clothes of a claim about
 * the task — see the focus pill in docs/05-screens.md §S2.
 */
const HIDDEN_ON = ['/settings', '/focus']

export function SessionBanner() {
  const pathname = usePathname()
  const status = useTimerStore((s) => s.runtime.status)
  const phase = useTimerStore((s) => s.runtime.phase)
  const seconds = useTimerStore((s) => Math.ceil(s.remainingMs / 1000))
  const taskTitle = useTimerStore((s) => s.attachedTaskTitle)

  if (status === 'idle') return null
  if (HIDDEN_ON.some((route) => pathname.startsWith(route))) return null

  const running = status === 'running'
  const title =
    phase === 'focus' && taskTitle ? `Focusing · ${taskTitle}` : PHASE_WORD[phase]

  return (
    <div className="sticky top-0 z-20 -mx-4 bg-canvas px-4 pb-2 pt-1.5">
      <section className="flex items-center gap-3 rounded-lg bg-ink p-3 text-surface shadow-sm">
        <Link
          href="/focus"
          className="flex min-w-0 flex-1 items-center gap-3"
          aria-label={`Open the focus screen · ${formatCountdown(seconds * 1000)} left`}
        >
          <IconTile icon={Timer} tone="green" size={40} className="bg-green [&>svg]:text-ink" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-medium">{title}</span>
            <span className="block truncate text-body-sm text-surface/60">
              <span className="numerals">{formatCountdown(seconds * 1000)}</span> left
              {running ? '' : ' · paused'}
            </span>
          </span>
        </Link>

        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          transition={spring.snappy}
          aria-label={running ? 'Pause session' : 'Resume session'}
          onClick={() => useTimerStore.getState().toggle()}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-green text-on-accent"
        >
          {running ? (
            <Pause size={16} strokeWidth={2} fill="currentColor" />
          ) : (
            <Play size={16} strokeWidth={2} fill="currentColor" />
          )}
        </motion.button>
      </section>
    </div>
  )
}
