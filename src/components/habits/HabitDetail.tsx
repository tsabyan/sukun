'use client'

import { useState } from 'react'
import { ChevronLeft, Pencil } from 'lucide-react'
import { Card, CardHead } from '@/components/ui/Card'
import { HeroCard, HeroWeekBars } from '@/components/ui/HeroCard'
import { PageHeader } from '@/components/shell/PageHeader'
import { Pill } from '@/components/ui/Pill'
import { StatRow, StatTile } from '@/components/ui/StatTile'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { useDevOpen } from '@/lib/dev/state'
import { useHideFab } from '@/lib/ui/fab'
import { cn } from '@/lib/utils/cn'
import { addDays, today as todayLocal, toLocalDate, fromLocalDate } from '@/lib/utils/dates'
import {
  DOW,
  currentStreak,
  isScheduled,
  longestStreak,
  rate30,
  schedLabel,
  type DoneSet,
} from '@/lib/habits/streaks'
import type { Habit, LocalDate } from '@/lib/db/types'

/** Monday-first: the schedule row and the calendar both read as a week. */
const ORDER = [1, 2, 3, 4, 5, 6, 0]

/**
 * D4 — one habit.
 *
 * The streak in the hero, the schedule you can edit in place, and a month you
 * can back-fill by tapping a day. Nothing is locked behind an edit mode: this
 * screen is where a missed check-in gets fixed.
 */
export function HabitDetail({
  habit,
  identityName,
  done,
  onBack,
  onRename,
  onToggleScheduleDay,
  onToggleDay,
  onDelete,
}: {
  habit: Habit
  identityName: string
  done: DoneSet
  onBack: () => void
  onRename: (name: string) => void
  onToggleScheduleDay: (weekday: number) => void
  onToggleDay: (day: LocalDate) => void
  onDelete: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)

  useDevOpen('habit-delete', () => setConfirmOpen(true))
  // Its own "+" sits beside the count it adds to.
  useHideFab()

  const today = todayLocal()
  const streak = currentStreak(habit, done, today)
  const longest = longestStreak(habit, done, today)
  const rate = rate30(habit, done, today)

  const now = fromLocalDate(today)
  const year = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1, 12)
  // Monday-first grid: Sunday (0) sits in the last column.
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const monthDays = Array.from({ length: daysInMonth }, (_, i) =>
    toLocalDate(new Date(year, month, i + 1, 12)),
  )
  const kept = monthDays.filter((day) => done.has(day)).length
  const missed = monthDays.filter(
    (day) => day <= today && isScheduled(habit, day) && !done.has(day),
  ).length

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Habit"
        leading={
          <button
            type="button"
            aria-label="Back to the identity"
            onClick={onBack}
            className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
        }
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {renaming ? (
            <input
              value={habit.name}
              autoFocus
              placeholder="Habit name"
              onChange={(e) => onRename(e.target.value)}
              onBlur={() => setRenaming(false)}
              onKeyDown={(e) => e.key === 'Enter' && setRenaming(false)}
              className="min-w-0 flex-1 bg-transparent text-title-l text-ink outline-none placeholder:text-ink-3"
            />
          ) : (
            <h2 className="min-w-0 flex-1 truncate text-title-l text-ink">
              {habit.name || 'Untitled habit'}
            </h2>
          )}
          <button
            type="button"
            aria-label="Rename habit"
            onClick={() => setRenaming(true)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
          >
            <Pencil size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill>{identityName || 'Untitled identity'}</Pill>
          <Pill>{schedLabel(habit.schedule)}</Pill>
        </div>
      </section>

      <HeroCard
        title="Current streak"
        chip={<Pill tone="dark">{first.toLocaleDateString(undefined, { month: 'short' })}</Pill>}
        value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
        sub={`best ${longest} · ${rate}% kept this month`}
      >
        <HeroWeekBars
          values={week.map((day) => (done.has(day) ? 1 : 0))}
          labels={week.map((day) =>
            fromLocalDate(day).toLocaleDateString(undefined, { weekday: 'short' }),
          )}
        />
      </HeroCard>

      <Card className="flex flex-col gap-3">
        <CardHead title="Schedule">
          <Pill>{schedLabel(habit.schedule)}</Pill>
        </CardHead>
        <div className="flex gap-1.5">
          {ORDER.map((day) => {
            const on = habit.schedule.includes(day)
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={DOW[day]}
                onClick={() => onToggleScheduleDay(day)}
                className={cn(
                  'inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-md',
                  'text-label transition-colors duration-150',
                  on ? 'bg-ink text-green' : 'bg-field text-ink-2',
                )}
              >
                {DOW[day].charAt(0)}
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHead title={monthName}>
          <Pill>Month</Pill>
        </CardHead>
        <div className="grid grid-cols-7 gap-1">
          {ORDER.map((day, i) => (
            <span
              key={`head-${i}`}
              className="pb-1 text-center text-[10px] font-medium text-ink-3"
            >
              {DOW[day].charAt(0)}
            </span>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {monthDays.map((iso, i) => {
            const isDone = done.has(iso)
            const sched = isScheduled(habit, iso)
            const future = iso > today
            const isToday = iso === today
            const clickable = !future && sched
            return (
              <button
                key={iso}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onToggleDay(iso)}
                aria-label={`${iso}${isDone ? ', done' : ''}`}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md',
                  'numerals text-body-sm transition-colors duration-150',
                  isDone && 'bg-green font-medium text-on-accent',
                  !isDone && isToday && 'bg-ink text-green',
                  !isDone && !isToday && sched && !future && 'bg-field text-ink-2',
                  !isDone && !isToday && (!sched || future) && 'text-ink-3',
                )}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </Card>

      <StatRow>
        <StatTile value={String(kept)} label="done this month" />
        <StatTile value={String(missed)} label="missed this month" />
      </StatRow>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="rounded-lg bg-surface py-4 text-label text-ember shadow-md"
      >
        Delete habit
      </button>

      <ConfirmSheet
        open={confirmOpen}
        title="Delete this habit?"
        body={`"${habit.name || 'This habit'}" and its history will be removed.`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={onDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}
