'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Flame, Trophy, X } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, SectionLabel } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { getPersonalBests } from '@/lib/db/repo'
import { formatDuration } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'
import type { Range } from '@/lib/stats/aggregate'

const RANGE_NOUN: Record<Range, string> = { day: 'day', week: 'week', month: 'month' }
const MEDALS = ['🥇', '🥈', '🥉']

/**
 * S8 — Personal bests, not a leaderboard.
 *
 * You are the only competitor. Calling it a leaderboard when there is nobody
 * else on it would be dishonest, and competing with your past self is the
 * durable motivation loop anyway — no social pressure, always winnable.
 */
export default function RecordsPage() {
  const router = useRouter()
  const [range, setRange] = useState<Range>('week')

  const bests = useLiveQuery(() => getPersonalBests(range), [range])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Personal bests"
        leading={<Trophy size={20} strokeWidth={1.75} className="text-accent" aria-hidden />}
        actions={
          <IconButton label="Close" onClick={() => router.push('/reports')}>
            <X size={20} strokeWidth={1.75} />
          </IconButton>
        }
      />

      <SegmentedControl<Range>
        aria-label="Range"
        segments={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
        value={range}
        onChange={setRange}
      />

      {!bests ? (
        <Card className="h-[200px] animate-pulse" />
      ) : bests.bestDay === null ? (
        <Card>
          <p className="text-body text-ink-2">
            No sessions yet. Your first record will appear here once you finish one.
          </p>
        </Card>
      ) : (
        <>
          {/* accent at 12% over a raised surface, not a saturated slab */}
          <Card className="accent-quiet flex flex-col gap-4 border-transparent">
            <div>
              <p className="eyebrow text-accent">Best {RANGE_NOUN[range]}</p>
              <p className="numerals mt-1 text-display-m text-ink">
                {formatDuration(
                  (range === 'day'
                    ? bests.bestDay
                    : range === 'week'
                      ? bests.bestWeek
                      : bests.bestMonth
                  )?.focusSeconds ?? 0,
                )}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <HeroStat label="Best day" value={bests.bestDay?.focusSeconds} />
              <HeroStat label="Best week" value={bests.bestWeek?.focusSeconds} />
              <HeroStat label="Best month" value={bests.bestMonth?.focusSeconds} />
            </div>

            {bests.longestStreak > 0 && (
              <div className="flex flex-wrap gap-2">
                <Pill tone="accent">
                  <Flame size={13} strokeWidth={1.75} aria-hidden />
                  {bests.currentStreak} day streak
                </Pill>
                <Pill>Longest {bests.longestStreak} days</Pill>
              </div>
            )}
          </Card>

          <section className="flex flex-col gap-3">
            <SectionLabel className="mb-0">This {RANGE_NOUN[range]}</SectionLabel>
            <Card padding="compact" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="numerals text-title-l text-ink">
                  {formatDuration(bests.currentPeriod.focusSeconds)}
                </span>
                <span
                  className={cn(
                    'text-body-sm tabular-nums',
                    bests.currentPeriod.pctOfBest >= 100 ? 'text-accent' : 'text-ink-2',
                  )}
                >
                  {bests.currentPeriod.pctOfBest >= 100
                    ? 'New best'
                    : `${bests.currentPeriod.pctOfBest}% of best`}
                </span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-full bg-hairline">
                <span
                  className="block h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${Math.min(100, bests.currentPeriod.pctOfBest)}%` }}
                />
              </span>
              <span className="text-body-sm text-ink-3">
                {bests.currentPeriod.sessions}{' '}
                {bests.currentPeriod.sessions === 1 ? 'session' : 'sessions'}
              </span>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel className="mb-0">All-time {RANGE_NOUN[range]}s</SectionLabel>
            <Card padding="none" className="overflow-hidden">
              <ul className="inset-divider">
                {bests.rankings.map((row, index) => (
                  <li
                    key={`${row.label}-${index}`}
                    className={cn(
                      'relative flex items-center gap-3 px-4 py-3',
                      row.isCurrent && 'accent-quiet',
                    )}
                  >
                    {row.isCurrent && (
                      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" />
                    )}
                    <span className="w-6 shrink-0 text-center text-body-sm tabular-nums text-ink-3">
                      {MEDALS[index] ?? index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body text-ink">
                      {row.label}
                      {row.isCurrent && <span className="text-ink-3"> · now</span>}
                    </span>
                    <span className="text-body-sm text-ink-3 tabular-nums">
                      {row.sessions}
                    </span>
                    <span className="w-[7ch] text-right text-body tabular-nums text-ink">
                      {formatDuration(row.focusSeconds)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <p className="px-1 text-body-sm text-ink-3">
              Ranked by focus time. A fifty-minute session and two twenty-fives are the
              same work.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <p className="numerals text-title-m text-ink">{formatDuration(value ?? 0)}</p>
      <p className="text-body-sm text-ink-3">{label}</p>
    </div>
  )
}
