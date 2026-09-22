'use client'

import { useState } from 'react'
import { ChevronLeft, Pencil, Plus, UserRound } from 'lucide-react'
import { Card, CardHead } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { HeroCard, HeroWeekBars } from '@/components/ui/HeroCard'
import { IconTile } from '@/components/ui/IconTile'
import { PageHeader } from '@/components/shell/PageHeader'
import { Pill, ChipButton } from '@/components/ui/Pill'
import { StatRow, StatTile } from '@/components/ui/StatTile'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { HabitRow } from './HabitRow'
import { useDevOpen } from '@/lib/dev/state'
import { addDays, fromLocalDate, today as todayLocal } from '@/lib/utils/dates'
import {
  currentStreak,
  isScheduled,
  longestStreak,
  rate30,
  schedLabel,
} from '@/lib/habits/streaks'
import type { Habit, Identity, LocalDate } from '@/lib/db/types'

/**
 * D3 — one identity.
 *
 * The week's check-ins in the hero, then the habits that make the claim true.
 * Adding a habit is a "+" beside the count, not a button at the bottom: the
 * count is what you are looking at when you decide there should be one more.
 */
export function IdentityDetail({
  identity,
  habits,
  logs,
  onBack,
  onRenameIdentity,
  onDeleteIdentity,
  onAddHabit,
  onOpenHabit,
  onToggleToday,
}: {
  identity: Identity
  habits: Habit[]
  logs: Record<string, Set<LocalDate>>
  onBack: () => void
  onRenameIdentity: (name: string) => void
  onDeleteIdentity: () => void
  onAddHabit: () => void
  onOpenHabit: (habitId: string) => void
  onToggleToday: (habitId: string) => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)

  useDevOpen('identity-delete', () => setConfirmOpen(true))
  // Its own "+" sits beside the count it adds to.

  const today = todayLocal()
  const doneOf = (habitId: string) => logs[habitId] ?? new Set<LocalDate>()

  const best = habits.reduce(
    (top, habit) => Math.max(top, longestStreak(habit, doneOf(habit.id), today)),
    0,
  )
  const kept = habits.length
    ? Math.round(
        habits.reduce((sum, habit) => sum + rate30(habit, doneOf(habit.id), today), 0) /
          habits.length,
      )
    : 0
  const checkIns = habits.reduce((sum, habit) => sum + doneOf(habit.id).size, 0)

  // The week, as check-ins against what was scheduled.
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const weekDue = days.reduce(
    (sum, day) => sum + habits.filter((habit) => isScheduled(habit, day)).length,
    0,
  )
  const weekDone = days.reduce(
    (sum, day) =>
      sum +
      habits.filter((habit) => isScheduled(habit, day) && doneOf(habit.id).has(day)).length,
    0,
  )

  const since = fromLocalDate(identity.createdAt.slice(0, 10)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Identity"
        leading={
          <button
            type="button"
            aria-label="Back to identities"
            onClick={onBack}
            className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
        }
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <IconTile icon={UserRound} tone="ink" size={52} />
          {renaming ? (
            <input
              value={identity.name}
              autoFocus
              placeholder="e.g. A guitarist"
              onChange={(e) => onRenameIdentity(e.target.value)}
              onBlur={() => setRenaming(false)}
              onKeyDown={(e) => e.key === 'Enter' && setRenaming(false)}
              className="min-w-0 flex-1 bg-transparent text-title-m text-ink outline-none placeholder:text-ink-3"
            />
          ) : (
            <h2 className="min-w-0 flex-1 truncate text-title-m text-ink">
              {identity.name || 'Untitled identity'}
            </h2>
          )}
          <button
            type="button"
            aria-label="Rename identity"
            onClick={() => setRenaming(true)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
          >
            <Pencil size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill>{`${habits.length} habit${habits.length === 1 ? '' : 's'}`}</Pill>
          <Pill>{`Since ${since}`}</Pill>
          {best > 0 && <Pill tone="dark">{`${best} day best`}</Pill>}
        </div>
      </section>

      <HeroCard
        title="This week"
        chip={<Pill tone="dark">Weekly</Pill>}
        value={`${weekDone} / ${weekDue}`}
        sub={
          weekDue === 0
            ? 'nothing scheduled yet'
            : `habit check-ins · ${weekDone >= weekDue * 0.8 ? 'on track' : 'room to grow'}`
        }
      >
        <HeroWeekBars
          values={days.map((day) => {
            const due = habits.filter((habit) => isScheduled(habit, day))
            if (due.length === 0) return 0
            return due.filter((habit) => doneOf(habit.id).has(day)).length / due.length
          })}
          labels={days.map((day) =>
            fromLocalDate(day).toLocaleDateString(undefined, { weekday: 'short' }),
          )}
        />
      </HeroCard>

      <Card className="flex flex-col gap-3">
        <CardHead title="Habits">
          <Pill>{String(habits.length)}</Pill>
          <button
            type="button"
            aria-label="Add a habit to this identity"
            onClick={onAddHabit}
            className="inline-flex size-8 items-center justify-center rounded-full bg-ink text-green"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </CardHead>

        {habits.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No habits yet"
            body="Add the small, daily things that would prove this identity true."
            action={
              <ChipButton selected onClick={onAddHabit}>
                <Plus size={14} strokeWidth={2} aria-hidden />
                Add a habit
              </ChipButton>
            }
          />
        ) : (
          <ul className="flex flex-col">
            {habits.map((habit) => {
              const streak = currentStreak(habit, doneOf(habit.id), today)
              return (
                <HabitRow
                  key={habit.id}
                  name={habit.name}
                  meta={`${schedLabel(habit.schedule)} · ${streak} day streak`}
                  streak={streak}
                  done={doneOf(habit.id).has(today)}
                  onOpen={() => onOpenHabit(habit.id)}
                  onToggle={() => onToggleToday(habit.id)}
                />
              )
            })}
          </ul>
        )}
      </Card>

      <StatRow>
        <StatTile value={`${kept}%`} label="kept this month" />
        <StatTile value={String(checkIns)} label={`check-ins since ${since}`} />
      </StatRow>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="rounded-lg bg-surface py-4 text-label text-ember shadow-md"
      >
        Delete identity
      </button>

      <ConfirmSheet
        open={confirmOpen}
        title="Delete this identity?"
        body="This identity and all its habits will be removed."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={onDeleteIdentity}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}
