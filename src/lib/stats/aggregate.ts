import { startOfWeek } from 'date-fns'
import type { HeatmapCell, LocalDate, PeriodStat, PersonalBests, Session } from '@/lib/db/types'
import { addDays, fromLocalDate, toLocalDate, today } from '@/lib/utils/dates'

/**
 * Every figure on the reports screens — docs/06-data-contracts.md §4.
 *
 * Pure functions over session rows. Grouping keys off `localDate`, which was
 * written once at the moment each session started, so none of this has to
 * reason about timezones or DST: a session that began at 23:50 already knows
 * which day it belongs to.
 *
 * Break sessions are excluded everywhere. They are recorded because the timer
 * ran, not because resting is an achievement.
 */

export type StatSession = Pick<
  Session,
  'localDate' | 'actualDurationSec' | 'completed' | 'mode'
>

export type Range = 'day' | 'week' | 'month'

export function focusSessions<T extends StatSession>(sessions: T[]): T[] {
  return sessions.filter((s) => s.mode === 'focus')
}

/** Days that count toward a streak: at least one focus session run to zero. */
export function countingDaysOf(sessions: StatSession[]): LocalDate[] {
  return focusSessions(sessions)
    .filter((s) => s.completed)
    .map((s) => s.localDate)
}

/* ------------------------------------------------------------------ totals */

export interface DayTotal {
  date: LocalDate
  sessions: number
  focusSeconds: number
}

export function dailyTotals(sessions: StatSession[]): Map<LocalDate, DayTotal> {
  const totals = new Map<LocalDate, DayTotal>()

  for (const session of focusSessions(sessions)) {
    const existing = totals.get(session.localDate) ?? {
      date: session.localDate,
      sessions: 0,
      focusSeconds: 0,
    }
    existing.sessions++
    existing.focusSeconds += session.actualDurationSec
    totals.set(session.localDate, existing)
  }

  return totals
}

export function weekStartOf(date: LocalDate, weekStartsOn = 1): LocalDate {
  return toLocalDate(
    startOfWeek(fromLocalDate(date), { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 }),
  )
}

export function monthStartOf(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`
}

/* ----------------------------------------------------------------- heatmap */

/**
 * Intensity is relative to the user's own habit, not an absolute scale.
 *
 * A fixed scale makes a two-sessions-a-day user stare at a grid of pale
 * squares and conclude they are failing, which is the opposite of what this
 * screen is for. The p90 floor of 4 stops a single heavy day from washing out
 * everything around it.
 */
export function intensityBaseline(counts: number[]): number {
  const nonZero = counts.filter((n) => n > 0).sort((a, b) => a - b)
  if (nonZero.length === 0) return 4

  const index = Math.max(0, Math.ceil(0.9 * nonZero.length) - 1)
  return Math.max(4, nonZero[index])
}

export function levelFor(sessions: number, baseline: number): HeatmapCell['level'] {
  if (sessions === 0) return 0
  const scaled = Math.ceil((sessions / baseline) * 4)
  return Math.min(4, Math.max(1, scaled)) as HeatmapCell['level']
}

/**
 * A `weeks` × 7 grid ending on the week that contains `end`, in date order.
 * The caller lays it out in columns.
 */
export function buildHeatmap(
  sessions: StatSession[],
  weeks: number,
  end: LocalDate = today(),
  weekStartsOn = 1,
): HeatmapCell[] {
  const totals = dailyTotals(sessions)
  const firstDay = addDays(weekStartOf(end, weekStartsOn), -(weeks - 1) * 7)

  const dates: LocalDate[] = []
  for (let i = 0; i < weeks * 7; i++) dates.push(addDays(firstDay, i))

  const baseline = intensityBaseline(
    dates.map((date) => totals.get(date)?.sessions ?? 0),
  )

  return dates.map((date) => {
    const total = totals.get(date)
    const count = total?.sessions ?? 0
    return {
      date,
      sessions: count,
      focusSeconds: total?.focusSeconds ?? 0,
      level: levelFor(count, baseline),
    }
  })
}

/* ---------------------------------------------------------- period rollups */

function labelForDay(date: LocalDate): string {
  return fromLocalDate(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function labelForWeek(weekStart: LocalDate): string {
  const start = fromLocalDate(weekStart)
  const end = fromLocalDate(addDays(weekStart, 6))
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel =
    start.getMonth() === end.getMonth()
      ? String(end.getDate())
      : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${startLabel}–${endLabel}`
}

function labelForMonth(monthStart: LocalDate): string {
  return fromLocalDate(monthStart).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function periodKeyOf(date: LocalDate, range: Range, weekStartsOn = 1): LocalDate {
  if (range === 'day') return date
  if (range === 'week') return weekStartOf(date, weekStartsOn)
  return monthStartOf(date)
}

export function periodLabel(key: LocalDate, range: Range): string {
  if (range === 'day') return labelForDay(key)
  if (range === 'week') return labelForWeek(key)
  return labelForMonth(key)
}

export interface PeriodTotal extends PeriodStat {
  key: LocalDate
}

export function periodTotals(
  sessions: StatSession[],
  range: Range,
  weekStartsOn = 1,
): PeriodTotal[] {
  const totals = new Map<LocalDate, PeriodTotal>()

  for (const session of focusSessions(sessions)) {
    const key = periodKeyOf(session.localDate, range, weekStartsOn)
    const existing = totals.get(key) ?? {
      key,
      label: periodLabel(key, range),
      focusSeconds: 0,
      sessions: 0,
    }
    existing.focusSeconds += session.actualDurationSec
    existing.sessions++
    totals.set(key, existing)
  }

  return [...totals.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function best(totals: PeriodTotal[]): PeriodStat | null {
  if (totals.length === 0) return null
  return totals.reduce((top, row) => (row.focusSeconds > top.focusSeconds ? row : top))
}

const RANKING_LIMIT = 20

/**
 * Ranked by focus time, never by session count.
 *
 * A fifty-minute session and two twenty-fives are the same work; ranking by
 * count would quietly reward chopping the day into smaller pieces.
 */
export function buildPersonalBests(
  sessions: StatSession[],
  range: Range,
  streaks: { current: number; longest: number },
  now: LocalDate = today(),
  weekStartsOn = 1,
): PersonalBests {
  const days = periodTotals(sessions, 'day', weekStartsOn)
  const weeks = periodTotals(sessions, 'week', weekStartsOn)
  const months = periodTotals(sessions, 'month', weekStartsOn)

  const forRange = range === 'day' ? days : range === 'week' ? weeks : months
  const currentKey = periodKeyOf(now, range, weekStartsOn)
  const current = forRange.find((row) => row.key === currentKey)

  const bestForRange = best(forRange)
  const pctOfBest =
    bestForRange && bestForRange.focusSeconds > 0
      ? Math.round(((current?.focusSeconds ?? 0) / bestForRange.focusSeconds) * 100)
      : 0

  const rankings = [...forRange]
    .sort((a, b) => b.focusSeconds - a.focusSeconds || a.key.localeCompare(b.key))
    .slice(0, RANKING_LIMIT)
    .map((row) => ({
      label: row.label,
      focusSeconds: row.focusSeconds,
      sessions: row.sessions,
      isCurrent: row.key === currentKey,
    }))

  return {
    bestDay: best(days),
    bestWeek: best(weeks),
    bestMonth: best(months),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    currentPeriod: {
      focusSeconds: current?.focusSeconds ?? 0,
      sessions: current?.sessions ?? 0,
      pctOfBest,
    },
    rankings,
  }
}

/* -------------------------------------------------------------- bar charts */

export interface MonthlyBar {
  key: LocalDate
  label: string
  sessions: number
  focusSeconds: number
}

/** The last `count` months, including empty ones — a gap is information. */
export function monthlyActivity(
  sessions: StatSession[],
  count = 6,
  now: LocalDate = today(),
): MonthlyBar[] {
  const totals = new Map(periodTotals(sessions, 'month').map((row) => [row.key, row]))
  const anchor = fromLocalDate(monthStartOf(now))
  const bars: MonthlyBar[] = []

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1, 12)
    const key = toLocalDate(date)
    const total = totals.get(key)
    bars.push({
      key,
      label: date.toLocaleDateString(undefined, { month: 'short' }),
      sessions: total?.sessions ?? 0,
      focusSeconds: total?.focusSeconds ?? 0,
    })
  }

  return bars
}
