import type { Habit, LocalDate } from '@/lib/db/types'
import { addDays, fromLocalDate, today as todayLocal } from '@/lib/utils/dates'

/**
 * Habit streak and completion maths — ported from the Tend prototype's
 * dates.ts, rebased onto Sukun's LocalDate strings so every calendar figure is
 * computed in the user's own timezone (docs/03-database.md). A "done set" is
 * the set of LocalDate strings a habit was completed on; callers build it from
 * the live, non-deleted habit_logs.
 */

/** 0 = Sunday … 6 = Saturday, matching Date.getDay() and the schedule array. */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
/** Two-letter, Sunday-first — calendar column headers. */
export const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
/** Three-letter, Sunday-first — schedule chips. */
export const DOW_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type DoneSet = Set<LocalDate>

/** Weekday index (0–6) for a LocalDate, in local time. */
export function weekdayOf(date: LocalDate): number {
  return fromLocalDate(date).getDay()
}

export function isScheduled(habit: Habit, date: LocalDate): boolean {
  return (habit.schedule ?? ALL_DAYS).includes(weekdayOf(date))
}

export function schedLabel(schedule: number[] | null): string {
  const s = schedule ?? ALL_DAYS
  if (s.length === 7) return 'Every day'
  if (s.length === 5 && [1, 2, 3, 4, 5].every((d) => s.includes(d))) return 'Weekdays'
  return s
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DOW[d])
    .join(' ')
}

/**
 * Consecutive scheduled days completed, counting back from today. Today not yet
 * done does not break the streak (the day is not over); any earlier missed
 * scheduled day does. Bounded to two years back — the cap the original used.
 */
export function currentStreak(habit: Habit, done: DoneSet, today: LocalDate = todayLocal()): number {
  let count = 0
  let day = today
  for (let i = 0; i < 730; i++) {
    if (isScheduled(habit, day)) {
      if (done.has(day)) count++
      else if (day !== today) break
    }
    day = addDays(day, -1)
  }
  return count
}

/** Longest run of consecutive scheduled days ever completed. */
export function longestStreak(habit: Habit, done: DoneSet, today: LocalDate = todayLocal()): number {
  let day = habit.createdAt ? addDays(today, -daysSince(habit.createdAt, today)) : today
  let max = 0
  let run = 0
  while (day <= today) {
    if (isScheduled(habit, day)) {
      if (done.has(day)) {
        run++
        if (run > max) max = run
      } else run = 0
    }
    day = addDays(day, 1)
  }
  return max
}

/** Completion rate over the last 30 days, as a whole percent of scheduled days. */
export function rate30(habit: Habit, done: DoneSet, today: LocalDate = todayLocal()): number {
  let scheduled = 0
  let completed = 0
  let day = addDays(today, -29)
  while (day <= today) {
    if (isScheduled(habit, day)) {
      scheduled++
      if (done.has(day)) completed++
    }
    day = addDays(day, 1)
  }
  return scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100)
}

/** Whole days between an ISO timestamp's local date and today (never negative). */
function daysSince(createdAt: string, today: LocalDate): number {
  const created = fromLocalDate(createdAt.slice(0, 10))
  const now = fromLocalDate(today)
  const diff = Math.round((now.getTime() - created.getTime()) / 86_400_000)
  return Math.max(0, diff)
}
