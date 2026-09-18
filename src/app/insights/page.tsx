'use client'

import { createElement, useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BarChart3,
  ChevronRight,
  Flame,
  Lock,
  Play,
  Plus,
  Settings,
  Timer,
  Trophy,
  X,
} from 'lucide-react'
import { AddMenu } from '@/components/shell/AddMenu'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, CardHead } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { HeroCard, HeroWeekBars } from '@/components/ui/HeroCard'
import { IconTile } from '@/components/ui/IconTile'
import { Pill, ChipButton } from '@/components/ui/Pill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { StatRow, StatTile } from '@/components/ui/StatTile'
import { Heatmap, HeatmapLegend } from '@/components/charts/Heatmap'
import { TaskFormSheet } from '@/components/tasks/TaskFormSheet'
import { DaySheet } from '@/components/insights/DaySheet'
import { FocusBars } from '@/components/insights/FocusBars'
import { getInsights } from '@/lib/db/repo'
import { ACHIEVEMENTS } from '@/lib/db/seed'
import { taskIcon } from '@/lib/tasks/icons'
import { useDevOpen } from '@/lib/dev/state'
import { usePageAction } from '@/lib/ui/page-action'
import { formatDuration } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'
import type { InsightRange } from '@/lib/stats/insights'
import type { HeatmapCell } from '@/lib/db/types'

/** How many badges the summary card shows before "see all". */
const BADGE_PREVIEW = 4

/**
 * E1 — Insights. docs/05-screens.md.
 *
 * Reports and Records folded into one screen, because they answered the same
 * question at two different zoom levels and neither earned a tab. Week, month
 * or year at the top; everything below it re-reads through that window.
 */
export default function InsightsPage() {
  const [range, setRange] = useState<InsightRange>('week')
  const [selected, setSelected] = useState<HeatmapCell | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [taskFormOpen, setTaskFormOpen] = useState(false)

  const data = useLiveQuery(() => getInsights(range), [range])

  useDevOpen(
    'day-detail',
    () => {
      const cells = data?.heatmap
      if (!cells?.length) return false
      setSelected(cells.filter((c) => c.sessions > 0).at(-1) ?? cells[cells.length - 1])
    },
    [data],
  )

  // The same "+" as everywhere else. Insights owns no list of its own, so it
  // asks what to add rather than inventing a screen-specific action.
  usePageAction({
    label: addOpen ? 'Close the add menu' : 'Add',
    icon: addOpen ? X : Plus,
    onPress: () => setAddOpen((open) => !open),
  })

  const max = Math.max(1, ...(data?.bars.map((bar) => bar.focusSeconds) ?? [1]))
  const unlocked = data?.achievements.unlocked ?? new Set<string>()

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Insights"
        actions={
          <>
            <Link
              href="/insights/achievements"
              aria-label="Achievements"
              className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
            >
              <Trophy size={20} strokeWidth={1.75} />
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
            >
              <Settings size={20} strokeWidth={1.75} />
            </Link>
          </>
        }
      />

      <SegmentedControl<InsightRange>
        aria-label="Insights range"
        segments={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
        value={range}
        onChange={setRange}
      />

      <HeroCard
        title={data?.title ?? 'Focused this week'}
        chip={<Pill tone="dark">{data?.chip ?? 'This week'}</Pill>}
        value={data ? formatDuration(data.focusSeconds) : '—'}
        sub={data?.empty ? 'Your first week starts now' : (data?.delta ?? undefined)}
      >
        <HeroWeekBars
          values={(data?.bars ?? []).map((bar) => bar.focusSeconds / max)}
          labels={(data?.bars ?? []).map((bar) => bar.label)}
        />
      </HeroCard>

      <StatRow>
        <StatTile
          value={data ? String(data.sessions) : '—'}
          label={`sessions ${RANGE_WORD[range]}`}
        />
        <StatTile
          value={data ? String(data.streaks.current) : '—'}
          label={
            data && data.streaks.longest > 0
              ? `day streak · best is ${data.streaks.longest}`
              : 'day streak · starts today'
          }
        />
      </StatRow>

      {data?.empty ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="Nothing to show yet"
            body="Finish one focus session and your rhythm, records and streak start filling in here."
            action={
              <Link href="/focus">
                <ChipButton selected>
                  <Play size={14} strokeWidth={2} aria-hidden />
                  Start a session
                </ChipButton>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <StatRow>
            <StatTile
              value={data?.bestDay ? formatDuration(data.bestDay.focusSeconds) : '—'}
              label={data?.bestDay ? `best day · ${data.bestDay.label}` : 'best day'}
            />
            <StatTile
              value={data ? String(data.tasksCompleted) : '—'}
              label="tasks completed"
            />
          </StatRow>

          {data && data.breakdown.length > 0 && (
            <Card className="flex flex-col gap-3">
              <CardHead title="Where focus went">
                <Pill>By tag</Pill>
              </CardHead>
              <FocusBars slices={data.breakdown} />
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <CardHead title="Focus rhythm">
              <Pill>12 weeks</Pill>
            </CardHead>
            {data ? (
              <>
                <Heatmap
                  cells={data.heatmap}
                  weekStartsOn={data.weekStartsOn}
                  onSelect={setSelected}
                />
                <HeatmapLegend span={data.heatmapLabel} />
              </>
            ) : (
              <div className="h-[120px] animate-pulse rounded-md bg-field" />
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <CardHead title="Records" />
            <ul className="flex flex-col">
              <RecordRow
                icon={Flame}
                label="Longest streak"
                value={data ? `${data.records.longestStreak} days` : '—'}
              />
              <RecordRow
                icon={Play}
                label="Most sessions in a day"
                value={data ? String(data.records.mostSessionsInADay) : '—'}
              />
              <RecordRow
                icon={Timer}
                label="Total focus time"
                value={data ? formatDuration(data.records.totalFocusSeconds) : '—'}
              />
            </ul>
          </Card>
        </>
      )}

      <Link href="/insights/achievements" className="block">
        <Card className="flex flex-col gap-3">
          <CardHead title="Achievements">
            <Pill>{`${unlocked.size} of ${data?.achievements.total ?? ACHIEVEMENTS.length}`}</Pill>
            <ChevronRight size={18} strokeWidth={1.75} className="text-ink-3" aria-hidden />
          </CardHead>
          <ul className="flex gap-2">
            {previewBadges(unlocked).map((badge) => {
              const earned = unlocked.has(badge.key)
              return (
                <li
                  key={badge.key}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md px-1.5 py-2.5',
                    earned ? 'bg-green-soft' : 'bg-field',
                  )}
                >
                  {earned
                    ? createElement(taskIcon(badge.icon), {
                        size: 18,
                        strokeWidth: 1.75,
                        className: 'text-green-deep',
                        'aria-hidden': true,
                      })
                    : createElement(Lock, {
                        size: 15,
                        strokeWidth: 1.75,
                        className: 'text-ink-3',
                        'aria-hidden': true,
                      })}
                  <span
                    className={cn(
                      'max-w-full truncate text-[10px] leading-none',
                      earned ? 'text-ink' : 'text-ink-3',
                    )}
                  >
                    {badge.name}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </Link>

      <AddMenu
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAddTask={() => setTaskFormOpen(true)}
      />

      <TaskFormSheet open={taskFormOpen} onClose={() => setTaskFormOpen(false)} />

      <DaySheet
        cell={selected}
        isBest={selected != null && selected.date === data?.bestDay?.date}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

const RANGE_WORD: Record<InsightRange, string> = {
  week: 'this week',
  month: 'this month',
  year: 'this year',
}

function RecordRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  label: string
  value: string
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <IconTile icon={icon as never} tone="field" size={32} />
      <span className="min-w-0 flex-1 truncate text-body text-ink">{label}</span>
      <span className="numerals shrink-0 text-body font-medium text-ink">{value}</span>
    </li>
  )
}

/** The last few unlocked, then the next few locked — progress, then the goal. */
function previewBadges(unlocked: Set<string>) {
  const earned = ACHIEVEMENTS.filter((badge) => unlocked.has(badge.key))
  const locked = ACHIEVEMENTS.filter((badge) => !unlocked.has(badge.key))
  return [...earned.slice(-BADGE_PREVIEW), ...locked].slice(0, BADGE_PREVIEW)
}
