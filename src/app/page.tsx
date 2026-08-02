'use client'

import Link from 'next/link'
import { Settings } from 'lucide-react'
import { Logomark } from '@/components/brand/Logomark'
import { AttachedTask } from '@/components/timer/AttachedTask'
import { Countdown } from '@/components/timer/Countdown'
import { ModeToggle } from '@/components/timer/ModeToggle'
import { PhaseLabel } from '@/components/timer/PhaseLabel'
import { ProgressRing } from '@/components/timer/ProgressRing'
import { StreakCard } from '@/components/timer/StreakCard'
import { TimerControls } from '@/components/timer/TimerControls'
import { TodayTasks } from '@/components/timer/TodayTasks'
import { TimerAnnouncer } from '@/components/timer/TimerAnnouncer'

/**
 * S1 — the Focus Timer. docs/05-screens.md.
 *
 * Opened ten times a day, so it has to be instant and it has to be quiet.
 * Desktop splits into two columns at 1024px; the ring stays the hero either
 * way.
 */
export default function FocusTimerPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          <Logomark size={20} className="text-accent" />
          <span
            className="font-display lowercase text-ink"
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              fontVariationSettings: '"wdth" 112',
            }}
          >
            sukun
          </span>
        </span>

        <Link
          href="/settings"
          aria-label="Settings"
          className="inline-flex size-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-ink"
        >
          <Settings size={20} strokeWidth={1.75} />
        </Link>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="flex flex-col gap-8">
          <ModeToggle />

          <ProgressRing>
            <PhaseLabel />
            <Countdown />
            <AttachedTask />
          </ProgressRing>

          <TimerControls />
        </div>

        <div className="flex flex-col gap-6">
          <StreakCard />
          <TodayTasks />
        </div>
      </div>

      <TimerAnnouncer />
    </div>
  )
}
