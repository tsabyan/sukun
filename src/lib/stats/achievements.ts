import { ACHIEVEMENTS } from '@/lib/db/seed'
import { computeStreaks } from './streaks'
import {
  countingDaysOf,
  dailyTotals,
  focusSessions,
  periodTotals,
  weekStartOf,
  type StatSession,
} from './aggregate'
import { addDays, fromLocalDate } from '@/lib/utils/dates'
import type { LocalDate } from '@/lib/db/types'

/**
 * Unlock rules for the 22-badge catalog in lib/db/seed.ts — docs/05 E3.
 *
 * Evaluated after every completed session. Badges are never revoked: a streak
 * you once held is a thing you did, and taking the badge away when it lapses
 * is exactly the punishing behaviour this product avoids.
 */

export interface AchievementInput {
  sessions: StatSession[]
  completedTasks: number
  weekStartsOn?: number
}

function hasFullWeek(days: Set<LocalDate>, weekStartsOn: number): boolean {
  for (const day of days) {
    const start = weekStartOf(day, weekStartsOn)
    let complete = true
    for (let i = 0; i < 7; i++) {
      if (!days.has(addDays(start, i))) {
        complete = false
        break
      }
    }
    if (complete) return true
  }
  return false
}

function hasFullMonth(days: Set<LocalDate>): boolean {
  const months = new Set([...days].map((day) => day.slice(0, 7)))

  for (const month of months) {
    const first = fromLocalDate(`${month}-01`)
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()

    let complete = true
    for (let day = 1; day <= daysInMonth; day++) {
      if (!days.has(`${month}-${String(day).padStart(2, '0')}`)) {
        complete = false
        break
      }
    }
    if (complete) return true
  }
  return false
}

/** Every badge the data currently justifies. */
export function earnedAchievements({
  sessions,
  completedTasks,
  weekStartsOn = 1,
}: AchievementInput): string[] {
  const focus = focusSessions(sessions)
  const completed = focus.filter((s) => s.completed)
  const totals = [...dailyTotals(sessions).values()]
  const countingDays = new Set(countingDaysOf(sessions))
  const streaks = computeStreaks(countingDays)

  const totalSessions = completed.length
  const maxDaySessions = totals.reduce((max, day) => Math.max(max, day.sessions), 0)
  const maxDaySeconds = totals.reduce((max, day) => Math.max(max, day.focusSeconds), 0)
  const maxWeekSeconds = periodTotals(sessions, 'week', weekStartsOn).reduce(
    (max, week) => Math.max(max, week.focusSeconds),
    0,
  )
  const bestWeekDayCount = (() => {
    const perWeek = new Map<LocalDate, Set<LocalDate>>()
    for (const day of countingDays) {
      const key = weekStartOf(day, weekStartsOn)
      const set = perWeek.get(key) ?? new Set<LocalDate>()
      set.add(day)
      perWeek.set(key, set)
    }
    return [...perWeek.values()].reduce((max, set) => Math.max(max, set.size), 0)
  })()

  const rules: Record<string, boolean> = {
    'first-session': totalSessions >= 1,
    'first-task': completedTasks >= 1,
    'first-full-day': maxDaySessions >= 4,
    'first-week': bestWeekDayCount >= 5,

    'sessions-10': totalSessions >= 10,
    'sessions-50': totalSessions >= 50,
    'sessions-100': totalSessions >= 100,
    'sessions-250': totalSessions >= 250,
    'sessions-500': totalSessions >= 500,
    'sessions-1000': totalSessions >= 1000,

    'streak-3': streaks.longest >= 3,
    'streak-7': streaks.longest >= 7,
    'streak-14': streaks.longest >= 14,
    'streak-30': streaks.longest >= 30,
    'streak-100': streaks.longest >= 100,

    'depth-4-day': maxDaySessions >= 4,
    'depth-8-day': maxDaySessions >= 8,
    'depth-3h-day': maxDaySeconds >= 3 * 3600,
    'depth-10h-week': maxWeekSeconds >= 10 * 3600,

    'habit-full-week': hasFullWeek(countingDays, weekStartsOn),
    'habit-full-month': hasFullMonth(countingDays),
    'habit-100-tasks': completedTasks >= 100,
  }

  return ACHIEVEMENTS.filter((badge) => rules[badge.key]).map((badge) => badge.key)
}

/** Only the ones not already held — what the caller should insert and announce. */
export function newlyEarned(input: AchievementInput, alreadyHeld: Iterable<string>): string[] {
  const held = new Set(alreadyHeld)
  return earnedAchievements(input).filter((key) => !held.has(key))
}
