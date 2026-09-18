import { describe, expect, it } from 'vitest'
import {
  barsFor,
  bestDayIn,
  breakdownByTag,
  deltaLabel,
  inWindow,
  previousWindow,
  rangeChip,
  rangeTitle,
  recordsOf,
  windowOf,
} from './insights'
import type { StatSession } from './aggregate'

/**
 * The Insights screen's windows and slices — docs/06-data-contracts.md §4.
 * Everything keys off `localDate`, so these run identically in any timezone.
 */

const session = (localDate: string, overrides: Partial<StatSession> = {}): StatSession => ({
  localDate,
  actualDurationSec: 1500,
  completed: true,
  mode: 'focus',
  ...overrides,
})

const tagged = (localDate: string, taskId: string | null, seconds = 1500) => ({
  ...session(localDate, { actualDurationSec: seconds }),
  taskId,
})

/** 2026-09-18 is a Friday. */
const FRIDAY = '2026-09-18'

describe('windows', () => {
  it('takes the Monday-start week around the day', () => {
    expect(windowOf('week', FRIDAY, 1)).toEqual({ start: '2026-09-14', end: '2026-09-20' })
  })

  it('follows a Sunday week start', () => {
    expect(windowOf('week', FRIDAY, 0)).toEqual({ start: '2026-09-13', end: '2026-09-19' })
  })

  it('takes the whole calendar month, including a 30-day one', () => {
    expect(windowOf('month', FRIDAY)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('takes the whole calendar year', () => {
    expect(windowOf('year', FRIDAY)).toEqual({ start: '2026-01-01', end: '2026-12-31' })
  })

  it('steps back one period at a time', () => {
    expect(previousWindow('week', windowOf('week', FRIDAY, 1))).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    })
    expect(previousWindow('month', windowOf('month', FRIDAY))).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    })
    expect(previousWindow('year', windowOf('year', FRIDAY))).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    })
  })

  it('crosses a February boundary without losing days', () => {
    expect(previousWindow('month', windowOf('month', '2026-03-15'))).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
  })

  it('includes both ends', () => {
    const window = windowOf('week', FRIDAY, 1)
    expect(inWindow('2026-09-14', window)).toBe(true)
    expect(inWindow('2026-09-20', window)).toBe(true)
    expect(inWindow('2026-09-13', window)).toBe(false)
    expect(inWindow('2026-09-21', window)).toBe(false)
  })
})

describe('labels', () => {
  it('names the period rather than the range', () => {
    expect(rangeTitle('week', windowOf('week', FRIDAY, 1))).toBe('Focused this week')
    expect(rangeTitle('year', windowOf('year', FRIDAY))).toBe('Focused in 2026')
    expect(rangeChip('month')).toBe('This month')
  })

  it('signs a rise and leaves a fall alone', () => {
    const previous = previousWindow('week', windowOf('week', FRIDAY, 1))
    expect(deltaLabel('week', previous, 112, 100)).toBe('+12% vs last week')
    expect(deltaLabel('week', previous, 80, 100)).toBe('-20% vs last week')
  })

  it('says nothing when there is no history to compare against', () => {
    const previous = previousWindow('week', windowOf('week', FRIDAY, 1))
    expect(deltaLabel('week', previous, 3600, 0)).toBeNull()
  })
})

describe('bars', () => {
  it('draws seven days for a week, in date order', () => {
    const window = windowOf('week', FRIDAY, 1)
    const bars = barsFor('week', [session('2026-09-16', { actualDurationSec: 600 })], window)

    expect(bars).toHaveLength(7)
    expect(bars[0].key).toBe('2026-09-14')
    expect(bars[2].focusSeconds).toBe(600)
    expect(bars[6].focusSeconds).toBe(0)
  })

  it('chunks a month into weeks and keeps the tail', () => {
    const window = windowOf('month', FRIDAY)
    const bars = barsFor('month', [session('2026-09-30', { actualDurationSec: 900 })], window)

    // 30 days in seven-day chunks is five bars, the last one short.
    expect(bars).toHaveLength(5)
    expect(bars.map((bar) => bar.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5'])
    expect(bars[4].focusSeconds).toBe(900)
  })

  it('draws twelve months for a year and ignores other years', () => {
    const window = windowOf('year', FRIDAY)
    const bars = barsFor(
      'year',
      [session('2026-03-02', { actualDurationSec: 1200 }), session('2025-03-02')],
      window,
    )

    expect(bars).toHaveLength(12)
    expect(bars[2].focusSeconds).toBe(1200)
    expect(bars.reduce((sum, bar) => sum + bar.focusSeconds, 0)).toBe(1200)
  })

  it('leaves breaks out of every bar', () => {
    const window = windowOf('week', FRIDAY, 1)
    const bars = barsFor(
      'week',
      [session('2026-09-16', { mode: 'short_break', actualDurationSec: 300 })],
      window,
    )
    expect(bars[2].focusSeconds).toBe(0)
  })
})

describe('breakdown by tag', () => {
  const tagOf = (taskId: string) =>
    ({ a: 'work', b: 'work', c: 'learning', d: 'health' })[taskId] ?? null

  it('groups by tag and always totals one hundred', () => {
    const slices = breakdownByTag(
      [
        tagged('2026-09-16', 'a', 3000),
        tagged('2026-09-16', 'b', 1000),
        tagged('2026-09-17', 'c', 1000),
        tagged('2026-09-17', 'd', 1000),
      ],
      tagOf,
    )

    expect(slices.map((s) => s.name)).toEqual(['work', 'learning', 'health'])
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBe(100)
    expect(slices[0].focusSeconds).toBe(4000)
  })

  it('files an untagged or task-less session under Untagged', () => {
    const slices = breakdownByTag([tagged('2026-09-16', null), tagged('2026-09-16', 'zz')], tagOf)
    expect(slices).toEqual([{ name: 'Untagged', focusSeconds: 3000, share: 100 }])
  })

  it('merges everything past the limit into Other, biggest first', () => {
    const slices = breakdownByTag(
      [
        tagged('2026-09-16', 'a', 1000),
        tagged('2026-09-16', 'c', 1000),
        tagged('2026-09-16', 'd', 1000),
        tagged('2026-09-16', null, 9000),
      ],
      tagOf,
      2,
    )

    expect(slices[0].name).toBe('Untagged')
    expect(slices.some((s) => s.name === 'Other')).toBe(true)
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBe(100)
  })

  it('returns nothing rather than a zero slice when there is no focus time', () => {
    expect(breakdownByTag([], tagOf)).toEqual([])
  })
})

describe('records and best day', () => {
  const rows = [
    session('2026-09-14', { actualDurationSec: 1500 }),
    session('2026-09-16', { actualDurationSec: 1500 }),
    session('2026-09-16', { actualDurationSec: 2400 }),
    session('2026-09-16', { actualDurationSec: 600 }),
  ]

  it('counts the heaviest day and the total', () => {
    expect(recordsOf(rows, 9)).toEqual({
      longestStreak: 9,
      mostSessionsInADay: 3,
      totalFocusSeconds: 6000,
    })
  })

  it('ranks the best day by time, not by session count', () => {
    const best = bestDayIn(
      [
        session('2026-09-14', { actualDurationSec: 5400 }),
        session('2026-09-16', { actualDurationSec: 900 }),
        session('2026-09-16', { actualDurationSec: 900 }),
        session('2026-09-16', { actualDurationSec: 900 }),
      ],
      windowOf('week', FRIDAY, 1),
    )

    expect(best?.date).toBe('2026-09-14')
    expect(best?.focusSeconds).toBe(5400)
  })

  it('ignores days outside the window', () => {
    expect(bestDayIn([session('2026-09-01')], windowOf('week', FRIDAY, 1))).toBeNull()
  })
})
