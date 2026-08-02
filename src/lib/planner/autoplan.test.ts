import { describe, expect, it } from 'vitest'
import { BLOCK_CAPACITY, blockLoad, planDay, type PlanCandidate } from './autoplan'
import type { DayBlock, Priority } from '@/lib/db/types'

/**
 * The bucketing rules from docs/05-screens.md S2. The one that matters most:
 * running Auto-plan a second time must be safe, which means it is idempotent
 * and it never moves a task the user placed by hand.
 */

let sequence = 0

function task(overrides: Partial<PlanCandidate> & { id: string }): PlanCandidate {
  sequence++
  return {
    priority: 'medium',
    estimatedPomodoros: 1,
    createdAt: `2026-08-0${Math.min(9, sequence)}T09:00:00.000Z`,
    plannedBlock: null,
    plannedOrder: 0,
    plannedManually: false,
    ...overrides,
  }
}

const blockOf = (result: ReturnType<typeof planDay>, id: string): DayBlock | undefined =>
  result.placements.find((p) => p.id === id)?.block

const idsIn = (result: ReturnType<typeof planDay>, block: DayBlock): string[] =>
  result.placements
    .filter((p) => p.block === block)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.id)

describe('priority routing', () => {
  it('sends high priority to the morning while there is room', () => {
    const result = planDay([
      task({ id: 'a', priority: 'high' }),
      task({ id: 'b', priority: 'high' }),
    ])

    expect(blockOf(result, 'a')).toBe('morning')
    expect(blockOf(result, 'b')).toBe('morning')
  })

  it('sends medium to the afternoon and low to the evening', () => {
    const result = planDay([
      task({ id: 'm', priority: 'medium' }),
      task({ id: 'l', priority: 'low' }),
    ])

    expect(blockOf(result, 'm')).toBe('afternoon')
    expect(blockOf(result, 'l')).toBe('evening')
  })

  it('spills high priority into the afternoon once the morning is full', () => {
    const result = planDay(
      Array.from({ length: 6 }, (_, i) => task({ id: `h${i}`, priority: 'high' })),
    )

    expect(idsIn(result, 'morning')).toHaveLength(BLOCK_CAPACITY.morning)
    expect(idsIn(result, 'afternoon')).toHaveLength(2)
    expect(result.overflow).toHaveLength(0)
  })

  it('uses the evening for high priority rather than dropping the task', () => {
    // 4 morning + 4 afternoon fills both; the ninth has to go somewhere
    const result = planDay(
      Array.from({ length: 9 }, (_, i) => task({ id: `h${i}`, priority: 'high' })),
    )

    expect(result.overflow).toHaveLength(0)
    expect(idsIn(result, 'evening')).toHaveLength(1)
  })
})

describe('ordering within the queue', () => {
  it('places bigger jobs before smaller ones at equal priority', () => {
    const result = planDay([
      task({ id: 'small', priority: 'high', estimatedPomodoros: 1 }),
      task({ id: 'big', priority: 'high', estimatedPomodoros: 3 }),
    ])

    expect(idsIn(result, 'morning')).toEqual(['big', 'small'])
  })

  it('breaks ties by age, so an old task cannot be bumped forever', () => {
    const result = planDay([
      task({
        id: 'new',
        priority: 'high',
        createdAt: '2026-08-09T09:00:00.000Z',
      }),
      task({
        id: 'old',
        priority: 'high',
        createdAt: '2026-01-01T09:00:00.000Z',
      }),
    ])

    expect(idsIn(result, 'morning')).toEqual(['old', 'new'])
  })
})

describe('capacity and overflow', () => {
  it('reports what did not fit', () => {
    // 10 pomodoros of capacity in total, 14 requested
    const result = planDay(
      Array.from({ length: 14 }, (_, i) => task({ id: `t${i}`, priority: 'low' })),
    )

    expect(result.placed).toBe(10)
    expect(result.overflow).toHaveLength(4)
    expect(result.placements).toHaveLength(10)
  })

  it('counts an estimate of zero as one slot', () => {
    const result = planDay(
      Array.from({ length: 5 }, (_, i) =>
        task({ id: `z${i}`, priority: 'high', estimatedPomodoros: 0 }),
      ),
    )

    expect(idsIn(result, 'morning')).toHaveLength(4)
  })

  it('lets an oversized task take a whole empty block instead of never fitting', () => {
    const result = planDay([task({ id: 'huge', priority: 'high', estimatedPomodoros: 9 })])

    expect(blockOf(result, 'huge')).toBe('morning')
    expect(result.overflow).toHaveLength(0)
  })

  it('does not wedge an oversized task into a partly used block', () => {
    const result = planDay([
      task({ id: 'first', priority: 'high', estimatedPomodoros: 2 }),
      task({ id: 'huge', priority: 'high', estimatedPomodoros: 9 }),
    ])

    // 'huge' sorts first (bigger), taking the morning; 'first' follows it
    expect(blockOf(result, 'huge')).toBe('morning')
    expect(blockOf(result, 'first')).toBe('afternoon')
  })
})

describe('manual placements', () => {
  it('never moves a task the user placed by hand', () => {
    const result = planDay([
      task({
        id: 'pinned',
        priority: 'low',
        plannedBlock: 'morning',
        plannedManually: true,
      }),
      task({ id: 'auto', priority: 'high' }),
    ])

    // a low-priority task would normally be sent to the evening
    expect(blockOf(result, 'pinned')).toBe('morning')
    expect(blockOf(result, 'auto')).toBe('morning')
  })

  it('counts a pinned task against its block capacity', () => {
    const result = planDay([
      task({
        id: 'pinned',
        estimatedPomodoros: 3,
        plannedBlock: 'morning',
        plannedManually: true,
      }),
      ...Array.from({ length: 3 }, (_, i) => task({ id: `h${i}`, priority: 'high' })),
    ])

    // 3 of 4 morning pomodoros are already spoken for, so only one fits
    expect(idsIn(result, 'morning')).toEqual(['pinned', 'h0'])
    expect(blockOf(result, 'h1')).toBe('afternoon')
  })

  it('keeps pinned tasks at the top of their block, in their own order', () => {
    const result = planDay([
      task({ id: 'second', plannedBlock: 'morning', plannedOrder: 1, plannedManually: true }),
      task({ id: 'first', plannedBlock: 'morning', plannedOrder: 0, plannedManually: true }),
      task({ id: 'auto', priority: 'high' }),
    ])

    expect(idsIn(result, 'morning')).toEqual(['first', 'second', 'auto'])
  })

  it('re-plans a task that was placed automatically last time', () => {
    const result = planDay([
      task({
        id: 'was-auto',
        priority: 'high',
        plannedBlock: 'evening',
        plannedManually: false,
      }),
    ])

    expect(blockOf(result, 'was-auto')).toBe('morning')
  })
})

describe('idempotency', () => {
  it('produces the same plan when run twice', () => {
    const candidates: PlanCandidate[] = [
      task({ id: 'a', priority: 'high', estimatedPomodoros: 2 }),
      task({ id: 'b', priority: 'medium' }),
      task({ id: 'c', priority: 'low', estimatedPomodoros: 3 }),
      task({ id: 'd', priority: 'high' }),
      task({ id: 'e', priority: 'medium', estimatedPomodoros: 2 }),
    ]

    const first = planDay(candidates)

    // feed the result back in, exactly as the repo would after writing it
    const after = candidates.map((t) => {
      const placement = first.placements.find((p) => p.id === t.id)
      return {
        ...t,
        plannedBlock: placement?.block ?? null,
        plannedOrder: placement?.order ?? 0,
      }
    })

    const second = planDay(after)
    expect(second.placements).toEqual(first.placements)
    expect(second.overflow).toEqual(first.overflow)
  })

  it('is stable when pinned and automatic tasks are mixed', () => {
    const candidates: PlanCandidate[] = [
      task({ id: 'pin', plannedBlock: 'evening', plannedManually: true }),
      task({ id: 'a', priority: 'high' }),
      task({ id: 'b', priority: 'low' }),
    ]

    const first = planDay(candidates)
    const second = planDay(
      candidates.map((t) => {
        const placement = first.placements.find((p) => p.id === t.id)
        return { ...t, plannedBlock: placement?.block ?? null, plannedOrder: placement?.order ?? 0 }
      }),
    )

    expect(second.placements).toEqual(first.placements)
  })
})

describe('empty input', () => {
  it('plans nothing without complaint', () => {
    const result = planDay([])
    expect(result).toEqual({ placements: [], overflow: [], placed: 0 })
  })
})

describe('blockLoad', () => {
  it('totals tasks and pomodoros per block', () => {
    const load = blockLoad([
      task({ id: 'a', plannedBlock: 'morning', estimatedPomodoros: 2 }),
      task({ id: 'b', plannedBlock: 'morning', estimatedPomodoros: 1 }),
      task({ id: 'c', plannedBlock: 'evening', estimatedPomodoros: 0 }),
      task({ id: 'd' }),
    ])

    expect(load.morning).toEqual({ tasks: 2, pomodoros: 3 })
    expect(load.evening).toEqual({ tasks: 1, pomodoros: 1 })
    expect(load.afternoon).toEqual({ tasks: 0, pomodoros: 0 })
  })
})

describe('priority coverage', () => {
  it.each<[Priority, DayBlock]>([
    ['high', 'morning'],
    ['medium', 'afternoon'],
    ['low', 'evening'],
  ])('sends a lone %s task to the %s', (priority, block) => {
    const result = planDay([task({ id: 'only', priority })])
    expect(blockOf(result, 'only')).toBe(block)
  })
})
