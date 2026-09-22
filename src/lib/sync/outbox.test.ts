import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db/schema'
import { enqueue, pending, resetAttempts } from './outbox'
import { isReady } from './engine'
import type { OutboxEntry } from '@/lib/db/types'

/**
 * The queue's one hard rule: nothing ever leaves it except by succeeding.
 *
 * An entry that failed ten times used to be dropped from the ready set for
 * good while still being counted as stalled, which pinned the status pill to
 * "Waiting" for the life of the install — issue #8. These tests are what stops
 * that coming back.
 */

const MINUTE = 60_000

const entry = (attempts: number, ageMs: number): OutboxEntry => ({
  id: `e${attempts}-${ageMs}`,
  table: 'tasks',
  rowId: 'row',
  op: 'upsert',
  payload: {},
  createdAt: Date.now() - ageMs,
  attempts,
})

beforeEach(async () => {
  await db.outbox.clear()
})

describe('backoff', () => {
  const now = Date.now()

  it('sends a fresh entry immediately', () => {
    expect(isReady(entry(0, 0), now)).toBe(true)
  })

  it('holds a failed entry until its backoff has elapsed', () => {
    // attempts 3 → 4s
    expect(isReady(entry(3, 1_000), now)).toBe(false)
    expect(isReady(entry(3, 10_000), now)).toBe(true)
  })

  it('keeps retrying past the give-up threshold, at the five-minute cap', () => {
    expect(isReady(entry(10, 4 * MINUTE), now)).toBe(false)
    expect(isReady(entry(10, 6 * MINUTE), now)).toBe(true)
    // and still, an hour and a hundred failures later
    expect(isReady(entry(100, 6 * MINUTE), now)).toBe(true)
  })
})

describe('resetAttempts', () => {
  it('revives every failed entry and leaves the fresh ones alone', async () => {
    await enqueue('tasks', 'a', 'upsert', {})
    await enqueue('tasks', 'b', 'upsert', {})
    const [first] = await pending()
    await db.outbox.update(first.id, { attempts: 7 })

    expect(await resetAttempts()).toBe(1)
    expect((await pending()).every((e) => e.attempts === 0)).toBe(true)
  })

  it('preserves the order of intent', async () => {
    await enqueue('tasks', 'first', 'upsert', {})
    await enqueue('tasks', 'second', 'upsert', {})
    const before = (await pending()).map((e) => e.rowId)

    await db.outbox.toCollection().modify({ attempts: 9 })
    await resetAttempts()

    expect((await pending()).map((e) => e.rowId)).toEqual(before)
  })
})
