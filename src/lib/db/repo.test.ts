import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import { resetIdentityCache } from './identity'
import * as repo from './repo'
import { computeStreaks, weekDots } from '@/lib/stats/streaks'
import { addDays, today, toLocalDate } from '@/lib/utils/dates'

/**
 * Phase 1 done-criteria, executed rather than eyeballed: full CRUD through the
 * repo, soft delete, the outbox writing alongside every mutation, and the
 * streak definition from docs/03-database.md.
 */

async function wipe() {
  await Promise.all([
    db.tasks.clear(),
    db.subtasks.clear(),
    db.tags.clear(),
    db.taskTags.clear(),
    db.sessions.clear(),
    db.achievements.clear(),
    db.settings.clear(),
    db.outbox.clear(),
    db.meta.clear(),
  ])
  resetIdentityCache()
}

beforeEach(wipe)

describe('tasks', () => {
  it('creates and reads back', async () => {
    const task = await repo.createTask({ title: 'Write the spec', priority: 'high' })

    expect(task.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(task.status).toBe('active')
    expect(task.completedPomodoros).toBe(0)

    const read = await repo.getTask(task.id)
    expect(read?.title).toBe('Write the spec')
    expect(read?.priority).toBe('high')
  })

  it('applies defaults for omitted fields', async () => {
    const task = await repo.createTask({ title: 'Bare' })
    expect(task.icon).toBe('circle-dashed')
    expect(task.color).toBe('sage')
    expect(task.priority).toBe('medium')
    expect(task.estimatedPomodoros).toBe(1)
    expect(task.plannedManually).toBe(false)
  })

  it('updates and moves updatedAt forward', async () => {
    const task = await repo.createTask({ title: 'Before' })
    await new Promise((r) => setTimeout(r, 5))
    await repo.updateTask(task.id, { title: 'After' })

    const read = await repo.getTask(task.id)
    expect(read?.title).toBe('After')
    expect(read!.updatedAt > task.updatedAt).toBe(true)
  })

  it('soft-deletes: the row survives but reads stop returning it', async () => {
    const task = await repo.createTask({ title: 'Doomed' })
    await repo.deleteTask(task.id)

    expect(await repo.getTask(task.id)).toBeUndefined()
    expect(await repo.listTasks()).toHaveLength(0)

    // still physically present, which is what makes undo free
    const raw = await db.tasks.get(task.id)
    expect(raw).toBeDefined()
    expect(raw!.deletedAt).not.toBeNull()

    await repo.restoreTask(task.id)
    expect(await repo.getTask(task.id)).toBeDefined()
  })

  it('counts only live active tasks', async () => {
    const a = await repo.createTask({ title: 'a' })
    await repo.createTask({ title: 'b' })
    const c = await repo.createTask({ title: 'c' })

    await repo.completeTask(a.id)
    await repo.deleteTask(c.id)

    expect(await repo.countActiveTasks()).toBe(1)
  })

  it('sorts by priority, then due date with undated last', async () => {
    await repo.createTask({ title: 'low', priority: 'low' })
    await repo.createTask({ title: 'high', priority: 'high' })
    await repo.createTask({ title: 'medium', priority: 'medium' })

    const byPriority = await repo.listTasks({ sort: 'priority' })
    expect(byPriority.map((t) => t.title)).toEqual(['high', 'medium', 'low'])

    await wipe()
    await repo.createTask({ title: 'undated' })
    await repo.createTask({ title: 'later', dueDate: '2026-12-01' })
    await repo.createTask({ title: 'sooner', dueDate: '2026-01-01' })

    const byDue = await repo.listTasks({ sort: 'due' })
    expect(byDue.map((t) => t.title)).toEqual(['sooner', 'later', 'undated'])
  })
})

describe('subtasks', () => {
  it('appends in order, reorders, and soft-deletes', async () => {
    const task = await repo.createTask({ title: 'Parent' })
    const one = await repo.createSubtask(task.id, 'One')
    const two = await repo.createSubtask(task.id, 'Two')
    const three = await repo.createSubtask(task.id, 'Three')

    expect((await repo.listSubtasks(task.id)).map((s) => s.title)).toEqual([
      'One',
      'Two',
      'Three',
    ])

    await repo.reorderSubtasks(task.id, [three.id, one.id, two.id])
    expect((await repo.listSubtasks(task.id)).map((s) => s.title)).toEqual([
      'Three',
      'One',
      'Two',
    ])

    await repo.deleteSubtask(one.id)
    expect((await repo.listSubtasks(task.id)).map((s) => s.title)).toEqual(['Three', 'Two'])
  })
})

describe('tags', () => {
  it('does not duplicate an existing tag name', async () => {
    const first = await repo.createTag('work')
    const second = await repo.createTag('work')
    expect(second.id).toBe(first.id)
    expect(await repo.listTags()).toHaveLength(1)
  })

  it('replaces the tag set on a task and filters by any selected tag', async () => {
    const work = await repo.createTag('work')
    const home = await repo.createTag('home')
    const task = await repo.createTask({ title: 'Tagged' })
    await repo.createTask({ title: 'Untagged' })

    await repo.setTaskTags(task.id, [work.id, home.id])
    expect((await repo.listTaskTagIds(task.id)).sort()).toEqual([work.id, home.id].sort())

    await repo.setTaskTags(task.id, [home.id])
    expect(await repo.listTaskTagIds(task.id)).toEqual([home.id])

    const filtered = await repo.listTasks({ tagIds: [home.id] })
    expect(filtered.map((t) => t.title)).toEqual(['Tagged'])
  })
})

describe('sessions', () => {
  const draft = (overrides: Partial<Parameters<typeof repo.recordSession>[0]> = {}) => ({
    taskId: null,
    mode: 'focus' as const,
    plannedDurationSec: 1500,
    actualDurationSec: 1500,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    localDate: today(),
    completed: true,
    interrupted: false,
    ...overrides,
  })

  it('advances the attached task only on a completed focus session', async () => {
    const task = await repo.createTask({ title: 'Tracked' })

    await repo.recordSession(draft({ taskId: task.id }))
    expect((await repo.getTask(task.id))!.completedPomodoros).toBe(1)

    await repo.recordSession(draft({ taskId: task.id, completed: false, interrupted: true }))
    expect((await repo.getTask(task.id))!.completedPomodoros).toBe(1)

    await repo.recordSession(draft({ taskId: task.id, mode: 'short_break' }))
    expect((await repo.getTask(task.id))!.completedPomodoros).toBe(1)
  })

  it('lists a task history newest first', async () => {
    const task = await repo.createTask({ title: 'History' })
    await repo.recordSession(draft({ taskId: task.id, startedAt: '2026-08-01T09:00:00.000Z' }))
    await repo.recordSession(draft({ taskId: task.id, startedAt: '2026-08-02T09:00:00.000Z' }))

    const history = await repo.listSessionsForTask(task.id)
    expect(history[0].startedAt).toBe('2026-08-02T09:00:00.000Z')
  })

  it('reports today totals from completed focus sessions', async () => {
    await repo.recordSession(draft({ actualDurationSec: 1500 }))
    await repo.recordSession(draft({ actualDurationSec: 900 }))

    const stats = await repo.getDayStats()
    expect(stats.sessions).toBe(2)
    expect(stats.focusSeconds).toBe(2400)
  })
})

describe('outbox', () => {
  it('records an entry alongside every mutation', async () => {
    const task = await repo.createTask({ title: 'Queued' })
    await repo.updateTask(task.id, { title: 'Queued again' })
    await repo.deleteTask(task.id)

    const entries = await db.outbox.where('table').equals('tasks').toArray()
    expect(entries).toHaveLength(3)
    expect(entries.every((e) => e.rowId === task.id)).toBe(true)
    expect(entries.every((e) => e.attempts === 0)).toBe(true)
    // soft delete travels as an ordinary upsert
    expect(entries.every((e) => e.op === 'upsert')).toBe(true)
  })

  it('queues a delete when a tag link is removed', async () => {
    const tag = await repo.createTag('work')
    const task = await repo.createTask({ title: 'Linked' })
    await repo.setTaskTags(task.id, [tag.id])
    await repo.setTaskTags(task.id, [])

    const ops = (await db.outbox.where('table').equals('taskTags').toArray()).map((e) => e.op)
    expect(ops).toContain('upsert')
    expect(ops).toContain('delete')
  })
})

describe('waitlist', () => {
  it('queues the email for sync and remembers it locally', async () => {
    await repo.joinWaitlist('someone@example.com', 'task_cap')

    const queued = await db.outbox.where('table').equals('waitlist').toArray()
    expect(queued).toHaveLength(1)
    expect(queued[0].op).toBe('upsert')
    expect((queued[0].payload as { email: string }).email).toBe('someone@example.com')
    expect((queued[0].payload as { source: string }).source).toBe('task_cap')

    expect(await repo.getWaitlistEmail()).toBe('someone@example.com')
  })

  it('reports no email before anyone signs up', async () => {
    expect(await repo.getWaitlistEmail()).toBeNull()
  })
})

describe('free tier', () => {
  it('counts toward the cap only while tasks are open', async () => {
    for (let i = 0; i < repo.FREE_TASK_LIMIT; i++) {
      await repo.createTask({ title: `task ${i}` })
    }
    expect(await repo.countActiveTasks()).toBe(repo.FREE_TASK_LIMIT)

    const [first] = await repo.listTasks({ status: 'active' })
    await repo.completeTask(first.id)

    expect(await repo.countActiveTasks()).toBe(repo.FREE_TASK_LIMIT - 1)
  })
})

describe('settings', () => {
  it('backfills a field added after the row was written', async () => {
    const settings = await repo.getSettings()

    // simulate a row stored before hapticsEnabled existed
    const legacy = { ...settings } as Record<string, unknown>
    delete legacy.hapticsEnabled
    await db.settings.put(legacy as never)

    const read = await repo.getSettings()
    expect(read.hapticsEnabled).toBe(true)
    expect(read.focusMinutes).toBe(settings.focusMinutes)

    // and the backfill is persisted, not recomputed on every read
    const stored = await db.settings.get(settings.userId)
    expect(stored!.hapticsEnabled).toBe(true)
  })

  it('creates defaults on first read and patches in place', async () => {
    const settings = await repo.getSettings()
    expect(settings.focusMinutes).toBe(25)
    expect(settings.sessionsUntilLongBreak).toBe(4)

    await repo.updateSettings({ focusMinutes: 50 })
    const updated = await repo.getSettings()
    expect(updated.focusMinutes).toBe(50)
    expect(updated.shortBreakMinutes).toBe(5)
  })
})

describe('export and import', () => {
  it('round-trips and stays idempotent', async () => {
    const task = await repo.createTask({ title: 'Portable' })
    await repo.createSubtask(task.id, 'Step')

    const bundle = await repo.exportAll()
    expect(bundle.tasks).toHaveLength(1)

    await repo.importAll(bundle)
    await repo.importAll(bundle)
    expect(await repo.listTasks()).toHaveLength(1)
    expect(await repo.listSubtasks(task.id)).toHaveLength(1)
  })

  it('never overwrites newer local data with a stale backup', async () => {
    const task = await repo.createTask({ title: 'Original' })
    const stale = await repo.exportAll()

    await new Promise((r) => setTimeout(r, 5))
    await repo.updateTask(task.id, { title: 'Edited since the backup' })

    await repo.importAll(stale)
    expect((await repo.getTask(task.id))!.title).toBe('Edited since the backup')
  })
})

describe('streaks', () => {
  const day = (offset: number) => addDays(today(), offset)

  it('counts a run ending today', () => {
    expect(computeStreaks([day(-2), day(-1), day(0)]).current).toBe(3)
  })

  it('still counts a run ending yesterday — the day is not over', () => {
    expect(computeStreaks([day(-3), day(-2), day(-1)]).current).toBe(3)
  })

  it('breaks once a full day is missed', () => {
    expect(computeStreaks([day(-4), day(-3), day(-2)]).current).toBe(0)
  })

  it('reports the longest historical run independently', () => {
    const days = [day(-20), day(-19), day(-18), day(-17), day(-1), day(0)]
    const streaks = computeStreaks(days)
    expect(streaks.current).toBe(2)
    expect(streaks.longest).toBe(4)
  })

  it('ignores duplicate days', () => {
    expect(computeStreaks([day(0), day(0), day(-1)]).current).toBe(2)
  })

  it('returns zeroes with no history', () => {
    expect(computeStreaks([])).toEqual({ current: 0, longest: 0 })
  })

  it('renders seven dots ending today', () => {
    const dots = weekDots([day(0), day(-3)])
    expect(dots).toHaveLength(7)
    expect(dots[6].date).toBe(today())
    expect(dots[6].active).toBe(true)
    expect(dots[3].active).toBe(true)
    expect(dots[0].active).toBe(false)
  })

  it('derives counting days from completed focus sessions only', async () => {
    const base = {
      taskId: null,
      plannedDurationSec: 1500,
      actualDurationSec: 1500,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    }
    await repo.recordSession({
      ...base,
      mode: 'focus',
      localDate: today(),
      completed: true,
      interrupted: false,
    })
    await repo.recordSession({
      ...base,
      mode: 'focus',
      localDate: addDays(today(), -1),
      completed: false,
      interrupted: true,
    })

    // yesterday was interrupted, so it does not count and the streak is 1
    expect(await repo.getStreaks()).toEqual({ current: 1, longest: 1 })
  })
})

describe('local dates', () => {
  it('keeps a late-evening session on its own local day', () => {
    const lateLocal = new Date(2026, 7, 2, 23, 50, 0)
    expect(toLocalDate(lateLocal)).toBe('2026-08-02')
  })

  it('keeps an early-morning session on its own local day', () => {
    const earlyLocal = new Date(2026, 7, 2, 0, 10, 0)
    expect(toLocalDate(earlyLocal)).toBe('2026-08-02')
  })
})

describe('stats through the repo', () => {
  it('builds a heatmap from recorded sessions', async () => {
    await repo.recordSession({
      taskId: null,
      mode: 'focus',
      plannedDurationSec: 1500,
      actualDurationSec: 1500,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      localDate: today(),
      completed: true,
      interrupted: false,
    })

    const grid = await repo.getHeatmap(12)
    expect(grid).toHaveLength(84)
    expect(grid.find((cell) => cell.date === today())!.sessions).toBe(1)
  })

  it('unlocks an achievement once and stays quiet after', async () => {
    await repo.recordSession({
      taskId: null,
      mode: 'focus',
      plannedDurationSec: 1500,
      actualDurationSec: 1500,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      localDate: today(),
      completed: true,
      interrupted: false,
    })

    const first = await repo.evaluateAchievements()
    expect(first).toContain('first-session')

    const second = await repo.evaluateAchievements()
    expect(second).toEqual([])

    expect(await repo.getAchievements()).toHaveLength(first.length)
  })

  it('returns empty personal bests for a new user', async () => {
    const bests = await repo.getPersonalBests('week')
    expect(bests.bestWeek).toBeNull()
    expect(bests.rankings).toEqual([])
  })
})

describe('auto-plan through the repo', () => {
  it('writes placements and reports the overflow', async () => {
    for (let i = 0; i < 12; i++) {
      await repo.createTask({ title: `t${i}`, priority: 'low' })
    }

    const result = await repo.autoPlan(today())
    expect(result.placed).toBe(10)
    expect(result.overflow).toBe(2)

    const planned = await repo.listPlanned(today())
    expect(planned).toHaveLength(10)
    expect(planned.every((t) => t.plannedBlock !== null)).toBe(true)
  })

  it('leaves a hand-placed task exactly where it was put', async () => {
    const pinned = await repo.createTask({ title: 'pinned', priority: 'low' })
    await repo.setPlacement(pinned.id, 'morning', 0, true, today())
    await repo.createTask({ title: 'auto', priority: 'high' })

    await repo.autoPlan(today())

    const after = await repo.getTask(pinned.id)
    expect(after!.plannedBlock).toBe('morning')
    expect(after!.plannedManually).toBe(true)
  })

  it('restores the previous plan on undo', async () => {
    const task = await repo.createTask({ title: 'movable', priority: 'high' })
    expect((await repo.getTask(task.id))!.plannedDate).toBeNull()

    await repo.autoPlan(today())
    expect((await repo.getTask(task.id))!.plannedBlock).toBe('morning')

    await repo.undoAutoPlan()
    const restored = await repo.getTask(task.id)
    expect(restored!.plannedDate).toBeNull()
    expect(restored!.plannedBlock).toBeNull()
  })

  it('does nothing on undo when nothing has been planned', async () => {
    await expect(repo.undoAutoPlan()).resolves.toBeUndefined()
  })

  it('ignores tasks planned for another day', async () => {
    const other = await repo.createTask({ title: 'tomorrow', priority: 'high' })
    await repo.setPlacement(other.id, 'morning', 0, true, addDays(today(), 1))

    await repo.autoPlan(today())

    const after = await repo.getTask(other.id)
    expect(after!.plannedDate).toBe(addDays(today(), 1))
  })
})
