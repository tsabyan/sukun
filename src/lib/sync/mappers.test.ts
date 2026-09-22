import { describe, expect, it } from 'vitest'
import {
  CONFLICT_TARGET,
  FULL_PULL_TABLES,
  PULL_TABLES,
  PUSH_ORDER,
  REMOTE_TABLE,
} from './mappers'
import type { SyncTable } from '@/lib/db/types'

/**
 * The sync contract's static half — the three tables of names and orders that
 * decide whether a cycle survives. All three were wrong at once (issue #8):
 * `achievements` was pulled by a delta on a column it does not have, and the
 * push ran in whatever order the outbox batched, which put sessions ahead of
 * their tasks.
 */

const ANON: SyncTable[] = ['waitlist', 'deviceDays']
const SYNCED = (Object.keys(REMOTE_TABLE) as SyncTable[]).filter((t) => !ANON.includes(t))

describe('push order', () => {
  it('covers every synced table', () => {
    expect([...PUSH_ORDER].sort()).toEqual([...SYNCED].sort())
  })

  it.each([
    ['tasks', 'subtasks'],
    ['tasks', 'sessions'],
    ['tasks', 'taskTags'],
    ['tags', 'taskTags'],
    ['identities', 'habits'],
    ['habits', 'habitLogs'],
  ] as const)('puts %s before %s', (parent, child) => {
    expect(PUSH_ORDER.indexOf(parent)).toBeLessThan(PUSH_ORDER.indexOf(child))
  })
})

describe('pull', () => {
  it('walks every synced table', () => {
    expect([...PULL_TABLES].sort()).toEqual([...SYNCED].sort())
  })

  it('pulls whole exactly the tables with no updated_at', () => {
    // Both are append-only or create/remove-only in Postgres and carry no
    // updated_at column; a delta query against them is a 42703.
    expect([...FULL_PULL_TABLES].sort()).toEqual(['achievements', 'taskTags'])
  })
})

describe('conflict targets', () => {
  it('names a target for every synced table', () => {
    for (const table of SYNCED) {
      expect(CONFLICT_TARGET[table as keyof typeof CONFLICT_TARGET]).toBeTruthy()
    }
  })
})
