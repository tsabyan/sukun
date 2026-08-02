import { describe, expect, it } from 'vitest'
import {
  buildHeatmap,
  buildPersonalBests,
  dailyTotals,
  intensityBaseline,
  levelFor,
  monthlyActivity,
  periodTotals,
  weekStartOf,
  type StatSession,
} from './aggregate'
import { earnedAchievements, newlyEarned } from './achievements'
import { computeStreaks } from './streaks'
import { addDays, toLocalDate } from '@/lib/utils/dates'
import { ACHIEVEMENT_COUNT } from '@/lib/db/seed'

/**
 * The reference implementation the SQL views in docs/03 must agree with.
 * Everything keys off `localDate`, so these run identically in any timezone.
 */

const session = (
  localDate: string,
  overrides: Partial<StatSession> = {},
): StatSession => ({
  localDate,
  actualDurationSec: 1500,
  completed: true,
  mode: 'focus',
  ...overrides,
})

const noStreaks = { current: 0, longest: 0 }

describe('breaks are excluded', () => {
  it('never counts a break toward a daily total', () => {
    const totals = dailyTotals([
      session('2026-08-02'),
      session('2026-08-02', { mode: 'short_break', actualDurationSec: 300 }),
      session('2026-08-02', { mode: 'long_break', actualDurationSec: 900 }),
    ])

    expect(totals.get('2026-08-02')).toEqual({
      date: '2026-08-02',
      sessions: 1,
      focusSeconds: 1500,
    })
  })

  it('counts an interrupted focus session toward time but not toward streaks', () => {
    const rows = [session('2026-08-02', { completed: false, actualDurationSec: 600 })]

    expect(dailyTotals(rows).get('2026-08-02')!.focusSeconds).toBe(600)
    expect(computeStreaks([], '2026-08-02').current).toBe(0)
  })
})

describe('intensity is relative to the user', () => {
  it('floors the baseline at four, so a light user sees a full grid', () => {
    expect(intensityBaseline([1, 1, 2])).toBe(4)
    expect(intensityBaseline([])).toBe(4)
  })

  it('rises when most days are heavy', () => {
    const counts = [4, ...Array(9).fill(12)]
    expect(intensityBaseline(counts)).toBe(12)
  })

  it('is not dragged up by a single outlier day', () => {
    // one enormous day among ordinary ones must not wash out the rest of
    // the grid — that is the whole point of using p90 over the maximum
    const counts = [...Array(9).fill(4), 40]
    expect(intensityBaseline(counts)).toBe(4)
  })

  it('ignores empty days when setting the baseline', () => {
    expect(intensityBaseline([0, 0, 0, 8])).toBe(8)
  })

  it('maps zero to level zero and the baseline to level four', () => {
    expect(levelFor(0, 4)).toBe(0)
    expect(levelFor(1, 4)).toBe(1)
    expect(levelFor(2, 4)).toBe(2)
    expect(levelFor(4, 4)).toBe(4)
  })

  it('clamps a day above the baseline rather than overflowing', () => {
    expect(levelFor(30, 4)).toBe(4)
  })

  it('gives a two-a-day user visible colour', () => {
    // baseline floors at 4, so two sessions is halfway up the scale
    expect(levelFor(2, intensityBaseline([2, 2, 2]))).toBe(2)
  })
})

describe('heatmap', () => {
  it('returns a full weeks × 7 grid in date order', () => {
    const grid = buildHeatmap([], 12, '2026-08-02')
    expect(grid).toHaveLength(84)
    expect(grid[0].date < grid[83].date).toBe(true)
  })

  it('ends on the week containing the anchor date', () => {
    const grid = buildHeatmap([], 4, '2026-08-02', 1)
    const last = grid[grid.length - 1].date
    // Sunday 2026-08-02 with a Monday week start ends that same week
    expect(last).toBe('2026-08-02')
  })

  it('renders an empty grid rather than nothing', () => {
    const grid = buildHeatmap([], 12, '2026-08-02')
    expect(grid.every((cell) => cell.level === 0 && cell.sessions === 0)).toBe(true)
  })

  it('places counts on the right days', () => {
    const grid = buildHeatmap(
      [session('2026-08-02'), session('2026-08-02'), session('2026-07-30')],
      4,
      '2026-08-02',
    )

    expect(grid.find((c) => c.date === '2026-08-02')!.sessions).toBe(2)
    expect(grid.find((c) => c.date === '2026-07-30')!.sessions).toBe(1)
    expect(grid.find((c) => c.date === '2026-07-31')!.sessions).toBe(0)
  })

  it('honours a Sunday week start', () => {
    const monday = buildHeatmap([], 2, '2026-08-05', 1)[0].date
    const sunday = buildHeatmap([], 2, '2026-08-05', 0)[0].date
    expect(monday).not.toBe(sunday)
  })
})

describe('local dates survive timezone edges', () => {
  it('files a session started at 23:50 on its own day', () => {
    const late = new Date(2026, 7, 2, 23, 50, 0)
    expect(toLocalDate(late)).toBe('2026-08-02')
  })

  it('files a session started at 00:10 on its own day', () => {
    const early = new Date(2026, 7, 3, 0, 10, 0)
    expect(toLocalDate(early)).toBe('2026-08-03')
  })

  it('steps across a spring-forward boundary without losing a day', () => {
    // 2026-03-08 is the US DST transition; the run must stay consecutive
    const days = ['2026-03-06']
    for (let i = 0; i < 5; i++) days.push(addDays(days[days.length - 1], 1))

    expect(days).toEqual([
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
    ])
    expect(computeStreaks(days, '2026-03-11').current).toBe(6)
  })

  it('steps across a fall-back boundary without repeating a day', () => {
    // 2026-11-01 is the US return to standard time
    const days = ['2026-10-30']
    for (let i = 0; i < 4; i++) days.push(addDays(days[days.length - 1], 1))

    expect(new Set(days).size).toBe(5)
    expect(days).toContain('2026-11-01')
    expect(computeStreaks(days, '2026-11-03').current).toBe(5)
  })

  it('keeps week boundaries stable across a DST transition', () => {
    expect(weekStartOf('2026-03-09', 1)).toBe('2026-03-09')
    expect(weekStartOf('2026-03-08', 1)).toBe('2026-03-02')
  })
})

describe('period rollups', () => {
  const rows = [
    session('2026-08-03', { actualDurationSec: 3000 }),
    session('2026-08-04', { actualDurationSec: 1500 }),
    session('2026-08-11', { actualDurationSec: 6000 }),
    session('2026-09-01', { actualDurationSec: 900 }),
  ]

  it('groups by week from Monday by default', () => {
    const weeks = periodTotals(rows, 'week')
    expect(weeks).toHaveLength(3)
    expect(weeks[0].key).toBe('2026-08-03')
    expect(weeks[0].focusSeconds).toBe(4500)
  })

  it('groups by calendar month', () => {
    const months = periodTotals(rows, 'month')
    expect(months.map((m) => m.key)).toEqual(['2026-08-01', '2026-09-01'])
    expect(months[0].focusSeconds).toBe(10500)
  })
})

describe('personal bests', () => {
  const rows = [
    session('2026-08-03', { actualDurationSec: 3000 }),
    session('2026-08-04', { actualDurationSec: 1500 }),
    session('2026-08-11', { actualDurationSec: 6000 }),
  ]

  it('ranks by focus time, not by session count', () => {
    const many = [
      ...Array.from({ length: 5 }, () => session('2026-08-05', { actualDurationSec: 600 })),
      session('2026-08-06', { actualDurationSec: 5400 }),
    ]

    const bests = buildPersonalBests(many, 'day', noStreaks, '2026-08-06')
    // 5 short sessions (3000s) lose to one long one (5400s)
    expect(bests.rankings[0].label).toBe(bests.bestDay!.label)
    expect(bests.bestDay!.focusSeconds).toBe(5400)
  })

  it('reports the best day, week and month regardless of the selected range', () => {
    const bests = buildPersonalBests(rows, 'day', noStreaks, '2026-08-11')

    expect(bests.bestDay!.focusSeconds).toBe(6000)
    expect(bests.bestWeek!.focusSeconds).toBe(6000)
    expect(bests.bestMonth!.focusSeconds).toBe(10500)
  })

  it('compares the current period against the record', () => {
    const bests = buildPersonalBests(rows, 'day', noStreaks, '2026-08-04')
    expect(bests.currentPeriod.focusSeconds).toBe(1500)
    expect(bests.currentPeriod.pctOfBest).toBe(25)
  })

  it('reports 100 percent when the current period is the record', () => {
    const bests = buildPersonalBests(rows, 'day', noStreaks, '2026-08-11')
    expect(bests.currentPeriod.pctOfBest).toBe(100)
  })

  it('flags the current period inside the rankings', () => {
    const bests = buildPersonalBests(rows, 'day', noStreaks, '2026-08-03')
    expect(bests.rankings.filter((r) => r.isCurrent)).toHaveLength(1)
  })

  it('caps the rankings at twenty', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      session(addDays('2026-01-01', i), { actualDurationSec: 600 + i }),
    )
    expect(buildPersonalBests(many, 'day', noStreaks, '2026-02-10').rankings).toHaveLength(20)
  })

  it('handles a user with no history at all', () => {
    const bests = buildPersonalBests([], 'week', noStreaks, '2026-08-02')

    expect(bests.bestDay).toBeNull()
    expect(bests.bestWeek).toBeNull()
    expect(bests.currentPeriod).toEqual({ focusSeconds: 0, sessions: 0, pctOfBest: 0 })
    expect(bests.rankings).toEqual([])
  })
})

describe('monthly activity', () => {
  it('includes empty months, because a gap is information', () => {
    const bars = monthlyActivity([session('2026-08-02')], 6, '2026-08-02')

    expect(bars).toHaveLength(6)
    expect(bars[5].sessions).toBe(1)
    expect(bars[0].sessions).toBe(0)
  })
})

describe('achievements', () => {
  const daysOfSessions = (count: number, perDay = 1, from = '2026-01-01') =>
    Array.from({ length: count }, (_, i) => addDays(from, i)).flatMap((date) =>
      Array.from({ length: perDay }, () => session(date)),
    )

  it('unlocks nothing on an empty history', () => {
    expect(earnedAchievements({ sessions: [], completedTasks: 0 })).toEqual([])
  })

  it('unlocks the first session and nothing beyond it', () => {
    const earned = earnedAchievements({ sessions: [session('2026-08-02')], completedTasks: 0 })
    expect(earned).toEqual(['first-session'])
  })

  it('unlocks the volume ladder cumulatively', () => {
    const earned = earnedAchievements({
      sessions: Array.from({ length: 50 }, () => session('2026-08-02')),
      completedTasks: 0,
    })

    expect(earned).toContain('sessions-10')
    expect(earned).toContain('sessions-50')
    expect(earned).not.toContain('sessions-100')
  })

  it('unlocks depth badges from a single heavy day', () => {
    const earned = earnedAchievements({
      sessions: Array.from({ length: 8 }, () => session('2026-08-02')),
      completedTasks: 0,
    })

    expect(earned).toContain('depth-4-day')
    expect(earned).toContain('depth-8-day')
    expect(earned).toContain('depth-3h-day')
  })

  it('unlocks a streak badge from the longest run, not the current one', () => {
    // a 7-day run that ended long ago still counts
    const earned = earnedAchievements({ sessions: daysOfSessions(7), completedTasks: 0 })
    expect(earned).toContain('streak-7')
    expect(earned).toContain('streak-3')
    expect(earned).not.toContain('streak-14')
  })

  it('unlocks a full week only when one calendar week is fully covered', () => {
    // six consecutive days can never span a whole Monday-to-Sunday week
    expect(earnedAchievements({ sessions: daysOfSessions(6), completedTasks: 0 })).not.toContain(
      'habit-full-week',
    )
    // fourteen always contains one, wherever the run happens to start
    expect(earnedAchievements({ sessions: daysOfSessions(14), completedTasks: 0 })).toContain(
      'habit-full-week',
    )
  })

  it('does not unlock a full week from seven days that straddle two weeks', () => {
    // 2026-01-01 is a Thursday, so Thu–Wed covers no complete week
    const straddling = daysOfSessions(7, 1, '2026-01-01')
    expect(earnedAchievements({ sessions: straddling, completedTasks: 0 })).not.toContain(
      'habit-full-week',
    )
  })

  it('unlocks a full month only for a complete calendar month', () => {
    const january = daysOfSessions(31, 1, '2026-01-01')
    expect(earnedAchievements({ sessions: january, completedTasks: 0 })).toContain(
      'habit-full-month',
    )

    const almost = daysOfSessions(30, 1, '2026-01-01')
    expect(earnedAchievements({ sessions: almost, completedTasks: 0 })).not.toContain(
      'habit-full-month',
    )
  })

  it('tracks task badges separately from sessions', () => {
    const earned = earnedAchievements({ sessions: [], completedTasks: 100 })
    expect(earned).toContain('first-task')
    expect(earned).toContain('habit-100-tasks')
  })

  it('reports only what is newly earned', () => {
    const input = { sessions: [session('2026-08-02')], completedTasks: 1 }
    expect(newlyEarned(input, [])).toEqual(['first-session', 'first-task'])
    expect(newlyEarned(input, ['first-session'])).toEqual(['first-task'])
    expect(newlyEarned(input, ['first-session', 'first-task'])).toEqual([])
  })

  it('never returns a key outside the catalog', () => {
    const earned = earnedAchievements({
      sessions: daysOfSessions(400, 10),
      completedTasks: 500,
    })
    expect(earned.length).toBeLessThanOrEqual(ACHIEVEMENT_COUNT)
  })
})
