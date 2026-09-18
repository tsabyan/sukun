import type { LocalDate } from '@/lib/db/types'
import { addDays, fromLocalDate, toLocalDate } from '@/lib/utils/dates'
import { dailyTotals, focusSessions, weekStartOf, type StatSession } from './aggregate'

/**
 * The Insights screen's own aggregates — docs/06-data-contracts.md §4.
 *
 * Everything here is a pure function over session rows and a window, so the
 * screen can swap Week/Month/Year without a second thought about timezones:
 * `localDate` already decided which day each session belongs to.
 */

export type InsightRange = 'week' | 'month' | 'year'

/** Inclusive on both ends. */
export interface RangeWindow {
  start: LocalDate
  end: LocalDate
}

export interface InsightBar {
  key: string
  label: string
  focusSeconds: number
}

export interface BreakdownSlice {
  name: string
  focusSeconds: number
  /** 0–100, rounded, and the slices always sum to 100 */
  share: number
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/* ----------------------------------------------------------------- windows */

function lastDayOfMonth(monthStart: LocalDate): LocalDate {
  const date = fromLocalDate(monthStart)
  return toLocalDate(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12))
}

export function windowOf(
  range: InsightRange,
  now: LocalDate,
  weekStartsOn = 1,
): RangeWindow {
  if (range === 'week') {
    const start = weekStartOf(now, weekStartsOn)
    return { start, end: addDays(start, 6) }
  }
  if (range === 'month') {
    const start: LocalDate = `${now.slice(0, 7)}-01`
    return { start, end: lastDayOfMonth(start) }
  }
  const year = now.slice(0, 4)
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

/** The same length of time, immediately before `window`. */
export function previousWindow(range: InsightRange, window: RangeWindow): RangeWindow {
  if (range === 'week') {
    const start = addDays(window.start, -7)
    return { start, end: addDays(start, 6) }
  }
  if (range === 'month') {
    const date = fromLocalDate(window.start)
    const start = toLocalDate(new Date(date.getFullYear(), date.getMonth() - 1, 1, 12))
    return { start, end: lastDayOfMonth(start) }
  }
  const year = Number(window.start.slice(0, 4)) - 1
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

export function inWindow(date: LocalDate, window: RangeWindow): boolean {
  return date >= window.start && date <= window.end
}

/* ------------------------------------------------------------------ labels */

export function rangeTitle(range: InsightRange, window: RangeWindow): string {
  if (range === 'week') return 'Focused this week'
  if (range === 'month') {
    return `Focused in ${fromLocalDate(window.start).toLocaleDateString(undefined, { month: 'long' })}`
  }
  return `Focused in ${window.start.slice(0, 4)}`
}

export function rangeChip(range: InsightRange): string {
  return { week: 'This week', month: 'This month', year: 'This year' }[range]
}

function previousLabel(range: InsightRange, previous: RangeWindow): string {
  if (range === 'week') return 'last week'
  if (range === 'month') {
    return fromLocalDate(previous.start).toLocaleDateString(undefined, { month: 'long' })
  }
  return previous.start.slice(0, 4)
}

/**
 * "+12% vs August". Null when there is nothing to compare against — a first
 * week with no history should not read as an infinite improvement.
 */
export function deltaLabel(
  range: InsightRange,
  previous: RangeWindow,
  current: number,
  before: number,
): string | null {
  if (before === 0) return null
  const pct = Math.round(((current - before) / before) * 100)
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}% vs ${previousLabel(range, previous)}`
}

/* -------------------------------------------------------------------- bars */

/** Seven days, weeks of the month, or twelve months — whatever the range is. */
export function barsFor(
  range: InsightRange,
  sessions: StatSession[],
  window: RangeWindow,
): InsightBar[] {
  const totals = dailyTotals(sessions)
  const secondsOn = (date: LocalDate) => totals.get(date)?.focusSeconds ?? 0

  if (range === 'week') {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(window.start, i)
      return {
        key: date,
        label: fromLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' }),
        focusSeconds: secondsOn(date),
      }
    })
  }

  if (range === 'month') {
    const bars: InsightBar[] = []
    let cursor = window.start
    let index = 1
    while (cursor <= window.end) {
      let focusSeconds = 0
      for (let i = 0; i < 7; i++) {
        const date = addDays(cursor, i)
        if (date > window.end) break
        focusSeconds += secondsOn(date)
      }
      bars.push({ key: cursor, label: `W${index}`, focusSeconds })
      cursor = addDays(cursor, 7)
      index++
    }
    return bars
  }

  const year = window.start.slice(0, 4)
  const byMonth = new Map<string, number>()
  for (const session of focusSessions(sessions)) {
    const month = session.localDate.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + session.actualDurationSec)
  }
  return MONTH_INITIALS.map((label, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    return { key, label, focusSeconds: byMonth.get(key) ?? 0 }
  })
}

/* --------------------------------------------------------------- breakdown */

/**
 * Where the hours went, by tag. A task carries its first tag only: splitting a
 * session across two tags would make the shares add up to more than the time
 * actually spent, which is worse than a rough answer.
 */
export function breakdownByTag(
  sessions: Array<StatSession & { taskId: string | null }>,
  tagOfTask: (taskId: string) => string | null,
  limit = 3,
): BreakdownSlice[] {
  const byName = new Map<string, number>()

  for (const session of focusSessions(sessions)) {
    const name = (session.taskId && tagOfTask(session.taskId)) || 'Untagged'
    byName.set(name, (byName.get(name) ?? 0) + session.actualDurationSec)
  }

  const total = [...byName.values()].reduce((sum, n) => sum + n, 0)
  if (total === 0) return []

  const sorted = [...byName.entries()].sort((a, b) => b[1] - a[1])
  const head = sorted.slice(0, limit)
  const tail = sorted.slice(limit).reduce((sum, [, seconds]) => sum + seconds, 0)
  if (tail > 0) head.push(['Other', tail])

  // Largest-remainder: the shares are read as a whole, so they have to total
  // 100 even after rounding.
  const exact = head.map(([name, seconds]) => ({
    name,
    focusSeconds: seconds,
    raw: (seconds / total) * 100,
  }))
  const slices = exact.map((s) => ({ ...s, share: Math.floor(s.raw) }))
  let remainder = 100 - slices.reduce((sum, s) => sum + s.share, 0)
  const order = [...slices].sort((a, b) => b.raw - b.share - (a.raw - a.share))
  for (const slice of order) {
    if (remainder <= 0) break
    slice.share++
    remainder--
  }

  // Biggest first, "Other" included: the bubbles are sized and toned by rank,
  // so the order has to be the order of the answer.
  return slices
    .map(({ name, focusSeconds, share }) => ({ name, focusSeconds, share }))
    .sort((a, b) => b.share - a.share)
}

/* ----------------------------------------------------------------- records */

export interface Records {
  longestStreak: number
  mostSessionsInADay: number
  totalFocusSeconds: number
}

export function recordsOf(sessions: StatSession[], longestStreak: number): Records {
  const totals = [...dailyTotals(sessions).values()]
  return {
    longestStreak,
    mostSessionsInADay: totals.reduce((top, day) => Math.max(top, day.sessions), 0),
    totalFocusSeconds: totals.reduce((sum, day) => sum + day.focusSeconds, 0),
  }
}

/* ---------------------------------------------------------------- best day */

export interface BestDay {
  date: LocalDate
  label: string
  focusSeconds: number
  sessions: number
}

export function bestDayIn(sessions: StatSession[], window: RangeWindow): BestDay | null {
  const days = [...dailyTotals(sessions).values()].filter((d) => inWindow(d.date, window))
  if (days.length === 0) return null

  const top = days.reduce((best, day) => (day.focusSeconds > best.focusSeconds ? day : best))
  return {
    date: top.date,
    label: fromLocalDate(top.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    focusSeconds: top.focusSeconds,
    sessions: top.sessions,
  }
}
