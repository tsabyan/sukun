import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  Achievement,
  MetaEntry,
  OutboxEntry,
  Session,
  Settings,
  Subtask,
  Tag,
  Task,
  TaskTag,
} from './types'

/**
 * IndexedDB mirror of the Postgres schema — docs/03-database.md.
 *
 * Two deviations from the doc's sketch, both forced by IndexedDB itself:
 *
 * 1. Index names are camelCase, matching the stored objects. The doc listed
 *    them snake_case, but Dexie indexes property names and the rows we store
 *    are camelCase all the way through.
 *
 * 2. `deletedAt` is not indexed. IndexedDB cannot index null, so a record with
 *    `deletedAt: null` is simply absent from that index — which makes
 *    "where deletedAt is null" impossible to express as a range query. Live
 *    rows are the overwhelming majority, so the filter runs in JS instead.
 */

export class SukunDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  subtasks!: EntityTable<Subtask, 'id'>
  tags!: EntityTable<Tag, 'id'>
  /** compound primary key [taskId+tagId], so not an EntityTable */
  taskTags!: Table<TaskTag, [string, string]>
  sessions!: EntityTable<Session, 'id'>
  achievements!: EntityTable<Achievement, 'key'>
  settings!: EntityTable<Settings, 'userId'>
  outbox!: EntityTable<OutboxEntry, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor() {
    super('sukun')

    this.version(1).stores({
      tasks: 'id, status, plannedDate, updatedAt, completedAt, [status+plannedDate]',
      subtasks: 'id, taskId, updatedAt, [taskId+position]',
      tags: 'id, name, updatedAt',
      taskTags: '[taskId+tagId], taskId, tagId',
      sessions: 'id, localDate, taskId, updatedAt, [mode+localDate]',
      achievements: 'key, unlockedAt',
      settings: 'userId',
      // local only — never synced
      outbox: 'id, table, createdAt',
      meta: 'key',
    })
  }
}

/**
 * Dexie's constructor does not touch indexedDB — it only opens on first query
 * — so a module-level instance is safe during SSR and prerender. Anything that
 * actually reads or writes must run in the browser.
 */
export const db = new SukunDB()

export function assertBrowser(operation: string) {
  if (typeof indexedDB === 'undefined') {
    throw new Error(
      `${operation} requires IndexedDB. Data access must run in the browser — ` +
        'keep repo calls inside client components.',
    )
  }
}

/* ------------------------------------------------------------------ meta */

export const META_KEYS = {
  userId: 'userId',
  timerRuntime: 'timerRuntime',
  lastAutoPlan: 'lastAutoPlan',
  seededAt: 'seededAt',
  lastPulledAt: 'lastPulledAt',
  waitlistEmail: 'waitlistEmail',
  onboardedAt: 'onboardedAt',
  notificationsAskedAt: 'notificationsAskedAt',
  deviceId: 'deviceId',
  lastHeartbeatDate: 'lastHeartbeatDate',
} as const

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}
