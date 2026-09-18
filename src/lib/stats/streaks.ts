import type { LocalDate } from '@/lib/db/types'
import { addDays, daysBetween, today } from '@/lib/utils/dates'

/**
 * Streaks — the definition in docs/03-database.md, and the client half of the
 * contract the SQL views must match.
 *
 *   A day counts if it has at least one focus session with completed = true.
 *   Current streak = consecutive counting days ending today OR yesterday.
 *   Longest streak = longest consecutive run in all history.
 *   Gaps are calendar days in the user's timezone. No grace days, no freezes.
 *
 * Ending yesterday still counts as current. The day isn't over, and punishing
 * someone at 00:01 is exactly the anxious-app behaviour this product avoids.
 */

export interface Streaks {
  current: number
  longest: number
}

export function computeStreaks(
  countingDays: Iterable<LocalDate>,
  now: LocalDate = today(),
): Streaks {
  const days = [...new Set(countingDays)].sort()
  if (days.length === 0) return { current: 0, longest: 0 }

  // longest run anywhere in history
  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1
    if (run > longest) longest = run
  }

  // current run, anchored to today or yesterday
  const last = days[days.length - 1]
  const gap = daysBetween(last, now)
  let current = 0
  if (gap === 0 || gap === 1) {
    current = 1
    let cursor = last
    for (let i = days.length - 2; i >= 0; i--) {
      if (daysBetween(days[i], cursor) !== 1) break
      current++
      cursor = days[i]
    }
  }

  return { current, longest }
}

/**
 * The seven dots behind the week bars — docs/05-screens.md B1.
 * Ends today, so the rightmost dot is always the day the user is looking at.
 */
export function weekDots(
  countingDays: Iterable<LocalDate>,
  now: LocalDate = today(),
): Array<{ date: LocalDate; active: boolean }> {
  const set = new Set(countingDays)
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(now, i - 6)
    return { date, active: set.has(date) }
  })
}
