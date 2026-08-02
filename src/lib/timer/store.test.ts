import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getMeta, META_KEYS } from '@/lib/db/schema'
import { resetIdentityCache } from '@/lib/db/identity'
import * as repo from '@/lib/db/repo'
import type { TimerRuntime } from './machine'
import {
  flushTimerWrites,
  resetTimerStoreForTests,
  useTimerStore,
} from './store'

/**
 * The Phase 2 done-criteria, executed rather than clicked:
 *   - a backgrounded 25-minute session comes back accurate
 *   - a reload mid-session resumes exactly where it was
 *   - a session that ended while the tab was away is recorded with its true
 *     duration and its true end time
 */

const MIN = 60_000
const T0 = 1_800_000_000_000

let clock = T0
const advance = (ms: number) => {
  clock += ms
}

const store = () => useTimerStore.getState()

beforeEach(async () => {
  clock = T0
  vi.spyOn(Date, 'now').mockImplementation(() => clock)

  await Promise.all([
    db.tasks.clear(),
    db.sessions.clear(),
    db.settings.clear(),
    db.outbox.clear(),
    db.meta.clear(),
  ])
  resetIdentityCache()
  resetTimerStoreForTests()
})

afterEach(async () => {
  await flushTimerWrites()
  resetTimerStoreForTests()
  vi.restoreAllMocks()
})

/** Simulates closing and reopening the tab: state gone, IndexedDB intact. */
async function reload() {
  await flushTimerWrites()
  resetTimerStoreForTests()
  await store().hydrate()
  // hydrate can complete a phase retroactively, which queues its own write
  await flushTimerWrites()
}

describe('hydration', () => {
  it('starts from stored settings', async () => {
    await repo.updateSettings({ focusMinutes: 50 })
    await store().hydrate()

    expect(store().hydrated).toBe(true)
    expect(store().durations.focus).toBe(3000)
    expect(store().remainingMs).toBe(3000 * 1000)
  })

  it('is idempotent', async () => {
    await store().hydrate()
    await store().hydrate()
    expect(store().runtime.status).toBe('idle')
  })
})

describe('accuracy while backgrounded', () => {
  it('is exact after ten minutes away', async () => {
    await store().hydrate()
    store().start()

    advance(10 * MIN)
    store().tick()

    expect(store().remainingMs).toBe(15 * MIN)
    expect(store().runtime.status).toBe('running')
  })

  it('drifts by nothing across many partial ticks', async () => {
    await store().hydrate()
    store().start()

    // 250ms ticks for a simulated two minutes, then a long jump
    for (let i = 0; i < 480; i++) {
      advance(250)
      store().tick()
    }
    advance(13 * MIN)
    store().tick()

    expect(store().remainingMs).toBe(10 * MIN)
  })

  it('never reports a negative remainder', async () => {
    await store().hydrate()
    store().start()

    advance(90 * MIN)
    store().tick()

    expect(store().remainingMs).toBeGreaterThanOrEqual(0)
  })
})

describe('reload mid-session', () => {
  it('resumes exactly where it was', async () => {
    await store().hydrate()
    store().start()
    const endsAt = store().runtime.endsAt

    advance(10 * MIN)
    await reload()

    expect(store().runtime.status).toBe('running')
    expect(store().runtime.endsAt).toBe(endsAt)
    expect(store().remainingMs).toBe(15 * MIN)
  })

  it('keeps a paused timer paused, with its remainder intact', async () => {
    await store().hydrate()
    store().start()
    advance(4 * MIN)
    store().pause()

    advance(30 * MIN)
    await reload()

    expect(store().runtime.status).toBe('paused')
    expect(store().remainingMs).toBe(21 * MIN)
  })

  it('keeps the attached task across the reload', async () => {
    const task = await repo.createTask({ title: 'Ship the timer' })
    await store().hydrate()
    store().attachTask(task.id, task.title)
    store().start()

    await reload()
    expect(store().runtime.taskId).toBe(task.id)
  })
})

describe('a phase that ended while the tab was away', () => {
  it('is recorded with its true end time, not the wake-up time', async () => {
    await store().hydrate()
    store().start()
    const endsAt = store().runtime.endsAt!

    advance(65 * MIN) // gone well past the finish
    await reload()

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].completed).toBe(true)
    expect(sessions[0].actualDurationSec).toBe(1500)
    expect(new Date(sessions[0].endedAt).getTime()).toBe(endsAt)
    expect(store().runtime.phase).toBe('short_break')
    expect(store().runtime.status).toBe('idle')
  })

  it('advances the attached task exactly once', async () => {
    const task = await repo.createTask({ title: 'Tracked' })
    await store().hydrate()
    store().attachTask(task.id, task.title)
    store().start()

    advance(40 * MIN)
    await reload()

    expect((await repo.getTask(task.id))!.completedPomodoros).toBe(1)
  })

  it('does not chain through phases the user was not present for', async () => {
    await repo.updateSettings({ autoStartBreaks: true, autoStartFocus: true })
    await store().hydrate()
    store().start()

    // away for hours — auto-start would otherwise manufacture a whole run
    advance(6 * 60 * MIN)
    await reload()

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(store().runtime.status).toBe('idle')
  })
})

describe('controls', () => {
  it('toggles through running, paused, running', async () => {
    await store().hydrate()

    store().toggle()
    expect(store().runtime.status).toBe('running')

    advance(3 * MIN)
    store().toggle()
    expect(store().runtime.status).toBe('paused')

    advance(2 * MIN)
    store().toggle()
    expect(store().runtime.status).toBe('running')
    expect(store().remainingMs).toBe(22 * MIN)
  })

  it('records a skip as interrupted with the real elapsed time', async () => {
    await store().hydrate()
    store().start()
    advance(7 * MIN)
    store().skip()
    await flushTimerWrites()

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].interrupted).toBe(true)
    expect(sessions[0].completed).toBe(false)
    expect(sessions[0].actualDurationSec).toBe(7 * 60)
    expect(store().runtime.phase).toBe('short_break')
  })

  it('records a reset and returns to the same phase', async () => {
    await store().hydrate()
    store().start()
    advance(2 * MIN)
    store().reset()
    await flushTimerWrites()

    const sessions = await db.sessions.toArray()
    expect(sessions[0].actualDurationSec).toBe(2 * 60)
    expect(store().runtime.phase).toBe('focus')
    expect(store().remainingMs).toBe(25 * MIN)
  })

  it('writes no session for a reset with nothing elapsed', async () => {
    await store().hydrate()
    store().start()
    store().reset()
    await flushTimerWrites()

    expect(await db.sessions.count()).toBe(0)
  })
})

describe('completion in the foreground', () => {
  it('records the session and moves to the break', async () => {
    await store().hydrate()
    store().start()

    advance(25 * MIN)
    store().tick()
    await flushTimerWrites()

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].mode).toBe('focus')
    expect(sessions[0].completed).toBe(true)
    expect(store().runtime.phase).toBe('short_break')
    expect(store().runtime.cycleCount).toBe(1)
  })

  it('files the session under the local day it started on', async () => {
    await store().hydrate()

    // 23:50 local, running past midnight
    const lateNight = new Date(2026, 7, 2, 23, 50, 0).getTime()
    clock = lateNight
    store().start()
    advance(25 * MIN)
    store().tick()
    await flushTimerWrites()

    const sessions = await db.sessions.toArray()
    expect(sessions[0].localDate).toBe('2026-08-02')
  })
})

describe('persistence', () => {
  it('writes the runtime on every transition', async () => {
    await store().hydrate()
    store().start()
    await flushTimerWrites()

    const stored = await getMeta<TimerRuntime>(META_KEYS.timerRuntime)
    expect(stored?.status).toBe('running')
    expect(stored?.endsAt).toBe(T0 + 25 * MIN)

    store().pause()
    await flushTimerWrites()
    expect((await getMeta<TimerRuntime>(META_KEYS.timerRuntime))?.status).toBe('paused')
  })
})

describe('settings changed while idle', () => {
  it('shows the new duration immediately', async () => {
    await store().hydrate()
    await repo.updateSettings({ focusMinutes: 45 })
    await store().refreshSettings()

    expect(store().remainingMs).toBe(45 * MIN)
  })
})
