import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import { resetIdentityCache } from './identity'
import { seedDevData } from './dev-seed'
import * as repo from './repo'

/**
 * The fixture generator is a Phase 6 dependency: heatmap and streak numbers get
 * spot-checked by hand against it. That only works if it is deterministic, so
 * that is what this asserts.
 */

beforeEach(async () => {
  await Promise.all([
    db.tasks.clear(),
    db.subtasks.clear(),
    db.tags.clear(),
    db.taskTags.clear(),
    db.sessions.clear(),
    db.settings.clear(),
    db.outbox.clear(),
    db.meta.clear(),
  ])
  resetIdentityCache()
})

describe('seedDevData', () => {
  it('fills the database with a usable spread', async () => {
    const result = await seedDevData(30)

    expect(result.tasks).toBe(15)
    expect(result.subtasks).toBeGreaterThan(15)
    expect(result.sessions).toBeGreaterThan(20)

    expect(await db.tasks.count()).toBe(15)
    expect(await repo.countActiveTasks()).toBe(11) // four are pre-completed
    expect((await repo.listTags()).length).toBeGreaterThan(4)

    const sessions = await db.sessions.toArray()
    expect(sessions.length).toBe(result.sessions)
    expect(sessions.every((s) => s.localDate.match(/^\d{4}-\d{2}-\d{2}$/))).toBe(true)
    expect(sessions.every((s) => s.endedAt >= s.startedAt)).toBe(true)
  }, 30_000)

  it('is deterministic for a given seed', async () => {
    const first = await seedDevData(30, 7)
    const firstDates = (await db.sessions.toArray()).map((s) => s.localDate).sort()

    await Promise.all([db.tasks.clear(), db.sessions.clear(), db.subtasks.clear(), db.tags.clear(), db.taskTags.clear(), db.meta.clear()])
    resetIdentityCache()

    const second = await seedDevData(30, 7)
    const secondDates = (await db.sessions.toArray()).map((s) => s.localDate).sort()

    expect(second.sessions).toBe(first.sessions)
    expect(secondDates).toEqual(firstDates)
  }, 30_000)

  it('leaves a gap so streak logic has something to break on', async () => {
    await seedDevData(60)
    const streaks = await repo.getStreaks()

    // the generator carves out a dead zone 20–34 days back
    expect(streaks.longest).toBeLessThan(60)
    expect(streaks.longest).toBeGreaterThan(0)
  }, 30_000)
})
