'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Flame } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { getDayStats, getStreaks, getWeekDots } from '@/lib/db/repo'
import { formatDuration } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * Current streak, the last seven days, and what today has amounted to.
 *
 * One live query for all three so a completed session refreshes the card in a
 * single pass. No "streak at risk" warning — loss aversion is the anxious-app
 * pattern this product is deliberately avoiding.
 */
export function StreakCard() {
  const stats = useLiveQuery(async () => {
    const [streaks, dots, today] = await Promise.all([
      getStreaks(),
      getWeekDots(),
      getDayStats(),
    ])
    return { streaks, dots, today }
  }, [])

  if (!stats) return <Card className="h-[92px] animate-pulse" />

  const { streaks, dots, today } = stats
  const hasHistory = streaks.longest > 0 || today.sessions > 0

  return (
    <Link href="/reports" className="block">
      <Card interactive padding="compact" className="flex items-center gap-4">
        <Flame
          size={20}
          strokeWidth={1.75}
          className={streaks.current > 0 ? 'text-accent' : 'text-ink-3'}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <p className="text-body text-ink">
            {hasHistory
              ? streaks.current > 0
                ? `${streaks.current} day streak`
                : 'Start a new streak'
              : 'No sessions yet'}
          </p>
          <p className="text-body-sm text-ink-2">
            {today.sessions === 0
              ? 'Nothing today'
              : `${today.sessions} today · ${formatDuration(today.focusSeconds)} focused`}
          </p>
        </div>

        <div className="flex items-center gap-1.5" aria-hidden>
          {dots.map((dot, i) => (
            <span key={dot.date} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'block size-2 rounded-full',
                  dot.active ? 'bg-accent' : 'bg-hairline-strong',
                )}
              />
              <span className="text-[9px] leading-none text-ink-3">
                {DAY_INITIALS[new Date(`${dot.date}T12:00:00`).getDay()] ?? DAY_INITIALS[i]}
              </span>
            </span>
          ))}
        </div>

        <ChevronRight size={18} strokeWidth={1.75} className="text-ink-3" aria-hidden />
      </Card>
    </Link>
  )
}
