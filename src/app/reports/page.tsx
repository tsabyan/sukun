'use client'

import { createElement, useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Lock, Settings, Trophy } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { Heatmap, HeatmapLegend } from '@/components/charts/Heatmap'
import { BarChart } from '@/components/charts/BarChart'
import { AchievementRing } from '@/components/charts/AchievementRing'
import {
  getAchievements,
  getHeatmap,
  getMonthlyActivity,
  getSessionsOnDay,
  getSettings,
} from '@/lib/db/repo'
import { ACHIEVEMENTS, ACHIEVEMENT_COUNT } from '@/lib/db/seed'
import { taskIcon } from '@/lib/tasks/icons'
import { formatDuration, fromLocalDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'
import type { HeatmapCell } from '@/lib/db/types'

type RangeKey = 'weekly' | 'monthly'

const WEEKS: Record<RangeKey, number> = { weekly: 12, monthly: 26 }

/** S7 — what the last few months actually looked like. */
export default function ReportsPage() {
  const [range, setRange] = useState<RangeKey>('weekly')
  const [selected, setSelected] = useState<HeatmapCell | null>(null)
  const [achievementsOpen, setAchievementsOpen] = useState(false)

  const data = useLiveQuery(async () => {
    const [cells, bars, unlocked, settings] = await Promise.all([
      getHeatmap(WEEKS[range]),
      getMonthlyActivity(6),
      getAchievements(),
      getSettings(),
    ])
    return { cells, bars, unlocked, weekStartsOn: settings.weekStartsOn }
  }, [range])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-title-l font-display text-ink">Report</h1>
        <div className="flex items-center gap-1">
          <Link
            href="/records"
            aria-label="Personal bests"
            className="inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:text-ink"
          >
            <Trophy size={20} strokeWidth={1.75} />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:text-ink"
          >
            <Settings size={20} strokeWidth={1.75} />
          </Link>
        </div>
      </header>

      <button type="button" onClick={() => setAchievementsOpen(true)} className="text-left">
        <Card interactive padding="compact" className="flex items-center gap-4">
          <AchievementRing unlocked={data?.unlocked.length ?? 0} total={ACHIEVEMENT_COUNT} />
          <span className="min-w-0 flex-1">
            <span className="block text-body text-ink">Achievements</span>
            <span className="block text-body-sm text-ink-2">
              {data?.unlocked.length ?? 0} of {ACHIEVEMENT_COUNT} unlocked
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="text-ink-3" aria-hidden />
        </Card>
      </button>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel className="mb-0">Activity</SectionLabel>
          <SegmentedControl<RangeKey>
            aria-label="Activity range"
            className="w-auto min-w-[180px]"
            segments={[
              { value: 'weekly', label: '12 weeks' },
              { value: 'monthly', label: '6 months' },
            ]}
            value={range}
            onChange={setRange}
          />
        </div>

        <Card className="flex flex-col gap-4">
          {data ? (
            <>
              <Heatmap
                cells={data.cells}
                weekStartsOn={data.weekStartsOn}
                onSelect={setSelected}
              />
              <HeatmapLegend />
            </>
          ) : (
            <div className="h-[120px] animate-pulse rounded-md bg-hairline" />
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel className="mb-0">Monthly activity</SectionLabel>
        <Card className="flex flex-col gap-3">
          {data ? (
            <>
              <p className="text-body-sm text-ink-2">
                <span className="numerals text-title-m text-ink">
                  {data.bars.reduce((sum, bar) => sum + bar.sessions, 0)}
                </span>{' '}
                sessions in six months
              </p>
              <BarChart bars={data.bars} />
            </>
          ) : (
            <div className="h-[140px] animate-pulse rounded-md bg-hairline" />
          )}
        </Card>
      </section>

      <DaySheet cell={selected} onClose={() => setSelected(null)} />

      <AchievementsSheet
        open={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        unlocked={new Set((data?.unlocked ?? []).map((a) => a.key))}
      />
    </div>
  )
}

/* ------------------------------------------------------------- day detail */

function DaySheet({ cell, onClose }: { cell: HeatmapCell | null; onClose: () => void }) {
  const sessions = useLiveQuery(
    () => (cell ? getSessionsOnDay(cell.date) : Promise.resolve([])),
    [cell?.date],
    [],
  )

  const focus = sessions.filter((s) => s.mode === 'focus')

  return (
    <Sheet
      open={cell !== null}
      onClose={onClose}
      snapPoints={[0.5, 0.9]}
      title={
        cell
          ? fromLocalDate(cell.date).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })
          : ''
      }
    >
      {focus.length === 0 ? (
        <p className="text-body text-ink-2">No focus sessions on this day.</p>
      ) : (
        <>
          <p className="mb-4 text-body text-ink-2">
            {focus.length} {focus.length === 1 ? 'session' : 'sessions'} ·{' '}
            {formatDuration(focus.reduce((sum, s) => sum + s.actualDurationSec, 0))} focused
          </p>
          <ul className="inset-divider">
            {focus.map((session) => (
              <li key={session.id} className="flex items-center gap-3 py-3">
                <span className="text-body-sm tabular-nums text-ink">
                  {new Date(session.startedAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="flex-1 text-body-sm text-ink-2">
                  {formatDuration(session.actualDurationSec)}
                </span>
                <span className="text-body-sm text-ink-3">
                  {session.completed ? 'completed' : 'interrupted'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------ achievements */

function AchievementsSheet({
  open,
  onClose,
  unlocked,
}: {
  open: boolean
  onClose: () => void
  unlocked: Set<string>
}) {
  return (
    <Sheet open={open} onClose={onClose} snapPoints={[0.7, 0.95]} title="Achievements">
      <p className="mb-5 text-body-sm text-ink-2">
        {unlocked.size} of {ACHIEVEMENT_COUNT} unlocked. Locked badges show what they
        need — a goal you cannot see is not a goal.
      </p>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACHIEVEMENTS.map((badge) => {
          const earned = unlocked.has(badge.key)
          return (
            <li
              key={badge.key}
              className={cn(
                'flex items-center gap-3 rounded-md border p-3',
                earned ? 'border-transparent accent-quiet' : 'border-hairline',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-9 shrink-0 items-center justify-center rounded-full',
                  earned ? 'accent-muted text-accent' : 'bg-surface-sunken text-ink-3',
                )}
              >
                {earned
                  ? createElement(taskIcon(badge.icon), { size: 18, strokeWidth: 1.75 })
                  : createElement(Lock, { size: 15, strokeWidth: 1.75 })}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-body', earned ? 'text-ink' : 'text-ink-2')}>
                  {badge.name}
                </span>
                <span className="block text-body-sm text-ink-3">{badge.requirement}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
