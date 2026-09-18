import type { DayBlock, Priority, Timestamp } from '@/lib/db/types'

/**
 * Auto-plan — docs/05-screens.md B8.
 *
 * A pure function over a list of candidates. No Dexie, no clock, no React:
 * the bucketing rules are the interesting part and they need to be testable
 * on their own.
 *
 * The rule that makes the button safe to press twice: a task the user placed
 * by hand is never moved. Auto-plan fills around it, and its estimate still
 * consumes capacity in whichever block it sits.
 */

export const BLOCKS: DayBlock[] = ['morning', 'afternoon', 'evening']

/** Pomodoros a block can absorb before it is considered full. */
export const BLOCK_CAPACITY: Record<DayBlock, number> = {
  morning: 4,
  afternoon: 4,
  evening: 2,
}

export const BLOCK_LABEL: Record<DayBlock, { name: string; range: string }> = {
  morning: { name: 'Morning', range: 'Before noon' },
  afternoon: { name: 'Afternoon', range: 'Noon – 5pm' },
  evening: { name: 'Evening', range: 'After 5pm' },
}

/**
 * Where each priority would rather sit.
 *
 * The spec lists two blocks for high priority and stops. Evening is appended
 * as a last resort: leaving a high-priority task unplanned while a block still
 * has room is plainly the wrong answer, and overflow should mean "the day is
 * full", not "the day is full in the two places I looked".
 */
const PREFERENCE: Record<Priority, DayBlock[]> = {
  high: ['morning', 'afternoon', 'evening'],
  medium: ['afternoon', 'morning', 'evening'],
  low: ['evening', 'afternoon', 'morning'],
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export interface PlanCandidate {
  id: string
  priority: Priority
  estimatedPomodoros: number
  createdAt: Timestamp
  /** current placement, if any */
  plannedBlock: DayBlock | null
  plannedOrder: number
  /** placed by hand — Auto-plan must not move it */
  plannedManually: boolean
}

export interface Placement {
  id: string
  block: DayBlock
  order: number
}

export interface AutoPlanResult {
  /** every task that ends up on the day, fixed ones included, in final order */
  placements: Placement[]
  /** ids that did not fit anywhere */
  overflow: string[]
  /** how many Auto-plan actually moved */
  placed: number
}

/** An estimate of zero still occupies a slot; nothing takes literally no time. */
function cost(task: PlanCandidate): number {
  return Math.max(1, task.estimatedPomodoros)
}

function fits(remaining: number, capacity: number, taskCost: number): boolean {
  if (remaining <= 0) return false
  if (taskCost <= remaining) return true
  // A task larger than any single block would otherwise never be placeable.
  // It may take a whole empty block and overrun it.
  return taskCost > capacity && remaining === capacity
}

export function planDay(
  candidates: PlanCandidate[],
  capacity: Record<DayBlock, number> = BLOCK_CAPACITY,
): AutoPlanResult {
  const fixed = candidates.filter((t) => t.plannedManually && t.plannedBlock !== null)
  const movable = candidates.filter((t) => !(t.plannedManually && t.plannedBlock !== null))

  const remaining: Record<DayBlock, number> = { ...capacity }
  const buckets: Record<DayBlock, string[]> = { morning: [], afternoon: [], evening: [] }

  // Hand-placed tasks claim their slots first, keeping their relative order.
  for (const task of [...fixed].sort((a, b) => a.plannedOrder - b.plannedOrder)) {
    const block = task.plannedBlock as DayBlock
    buckets[block].push(task.id)
    remaining[block] -= cost(task)
  }

  // Priority first, then the biggest jobs, then oldest — so a long-standing
  // task cannot be perpetually bumped by whatever was created most recently.
  const queue = [...movable].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.estimatedPomodoros - a.estimatedPomodoros ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  )

  const overflow: string[] = []
  let placed = 0

  for (const task of queue) {
    const target = PREFERENCE[task.priority].find((block) =>
      fits(remaining[block], capacity[block], cost(task)),
    )

    if (!target) {
      overflow.push(task.id)
      continue
    }

    buckets[target].push(task.id)
    remaining[target] -= cost(task)
    placed++
  }

  const placements: Placement[] = []
  for (const block of BLOCKS) {
    buckets[block].forEach((id, order) => placements.push({ id, block, order }))
  }

  return { placements, overflow, placed }
}

/** How full each block is, for the count badges and the summary. */
export function blockLoad(
  candidates: PlanCandidate[],
): Record<DayBlock, { tasks: number; pomodoros: number }> {
  const load = {
    morning: { tasks: 0, pomodoros: 0 },
    afternoon: { tasks: 0, pomodoros: 0 },
    evening: { tasks: 0, pomodoros: 0 },
  }

  for (const task of candidates) {
    if (!task.plannedBlock) continue
    load[task.plannedBlock].tasks++
    load[task.plannedBlock].pomodoros += cost(task)
  }

  return load
}
