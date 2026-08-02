import { format, parseISO } from 'date-fns'
import type { LocalDate, Timestamp } from '@/lib/db/types'

/**
 * All calendar maths happens in the user's local timezone.
 *
 * A session started at 23:40 in Jakarta is 16:40 UTC the same day; one started
 * at 07:00 Jakarta is 00:00 UTC the day before. Deriving the calendar day from
 * a UTC timestamp gives wrong heatmaps and wrong streaks for anyone outside
 * UTC — so the client writes the local day down at the moment it happens and
 * never recomputes it. docs/03-database.md.
 */

export function nowIso(): Timestamp {
  return new Date().toISOString()
}

/** The user-local calendar day for an instant. */
export function toLocalDate(input: Date | number | Timestamp): LocalDate {
  const date =
    typeof input === 'string' ? parseISO(input) : input instanceof Date ? input : new Date(input)
  return format(date, 'yyyy-MM-dd')
}

export function today(): LocalDate {
  return toLocalDate(new Date())
}

/** Midday avoids DST edges when a local date is turned back into a Date. */
export function fromLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = fromLocalDate(date)
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  const ms = fromLocalDate(to).getTime() - fromLocalDate(from).getTime()
  return Math.round(ms / 86_400_000)
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
