import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  Achievement,
  Habit,
  HabitLog,
  Identity,
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

export class AjegDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  subtasks!: EntityTable<Subtask, 'id'>
  tags!: EntityTable<Tag, 'id'>
  /** compound primary key [taskId+tagId], so not an EntityTable */
  taskTags!: Table<TaskTag, [string, string]>
  sessions!: EntityTable<Session, 'id'>
  achievements!: EntityTable<Achievement, 'key'>
  settings!: EntityTable<Settings, 'userId'>
  identities!: EntityTable<Identity, 'id'>
  habits!: EntityTable<Habit, 'id'>
  /** compound primary key [habitId+day], so not an EntityTable */
  habitLogs!: Table<HabitLog, [string, string]>
  outbox!: EntityTable<OutboxEntry, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor() {
    // The IndexedDB database keeps its original name through the Ajeg rename.
    // It is the identity of every installed copy's local data; renaming it
    // would orphan every task, session and habit already on a device.
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

    // v2 — habits. Existing stores carry over untouched; only the new tables
    // are declared. `deletedAt` is not indexed here for the same reason as the
    // v1 stores: IndexedDB cannot index null, so the alive filter runs in JS.
    this.version(2).stores({
      identities: 'id, position, updatedAt',
      habits: 'id, identityId, position, updatedAt',
      habitLogs: '[habitId+day], habitId, day, updatedAt',
    })
  }
}

/**
 * Dexie's constructor does not touch indexedDB — it only opens on first query
 * — so a module-level instance is safe during SSR and prerender. Anything that
 * actually reads or writes must run in the browser.
 */
export const db = new AjegDB()

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
  isPro: 'isPro',
} as const

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}
