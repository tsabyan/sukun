import type {
  Achievement,
  Session,
  Settings,
  Subtask,
  SyncTable,
  Tag,
  Task,
  TaskTag,
} from '@/lib/db/types'

/**
 * The single camelCase ↔ snake_case boundary — docs/02-architecture.md §4.
 *
 * Every other file in the app is camelCase. Postgres is snake_case. If that
 * conversion appears anywhere else, it will eventually appear inconsistently,
 * and the bug shows up as a column that silently never syncs.
 */

type Row = Record<string, unknown>

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

function convertKeys(input: Row, convert: (key: string) => string): Row {
  const output: Row = {}
  for (const [key, value] of Object.entries(input)) output[convert(key)] = value
  return output
}

/** Local row → the shape Postgres expects. */
export function toRemote(table: SyncTable, row: unknown): Row {
  const converted = convertKeys(row as Row, toSnake)

  // `recurrence` is jsonb and its inner keys belong to the app, not the
  // database — converting them would rename `freq` and `days` for no reason.
  if (table === 'tasks' && (row as Task).recurrence) {
    converted.recurrence = (row as Task).recurrence
  }

  return converted
}

/** Postgres row → the shape the app expects. */
export function fromRemote<T>(row: Row): T {
  return convertKeys(row, toCamel) as T
}

export const fromRemoteTask = (row: Row) => fromRemote<Task>(row)
export const fromRemoteSubtask = (row: Row) => fromRemote<Subtask>(row)
export const fromRemoteTag = (row: Row) => fromRemote<Tag>(row)
export const fromRemoteTaskTag = (row: Row) => fromRemote<TaskTag>(row)
export const fromRemoteSession = (row: Row) => fromRemote<Session>(row)
export const fromRemoteSettings = (row: Row) => fromRemote<Settings>(row)
export const fromRemoteAchievement = (row: Row) => fromRemote<Achievement>(row)

/** Postgres table names, which differ from the local ones only in case. */
export const REMOTE_TABLE: Record<SyncTable, string> = {
  tasks: 'tasks',
  subtasks: 'subtasks',
  sessions: 'sessions',
  tags: 'tags',
  taskTags: 'task_tags',
  settings: 'settings',
  achievements: 'achievements',
  waitlist: 'waitlist',
  deviceDays: 'device_days',
}

/**
 * Which columns identify a row for upsert.
 *
 * `waitlist` and `deviceDays` are absent on purpose — both are pushed with a
 * plain insert. An upsert needs INSERT and UPDATE policies, and both tables
 * have only the former by design.
 */
export const CONFLICT_TARGET: Record<Exclude<SyncTable, 'waitlist' | 'deviceDays'>, string> = {
  tasks: 'id',
  subtasks: 'id',
  sessions: 'id',
  tags: 'id',
  taskTags: 'task_id,tag_id',
  settings: 'user_id',
  achievements: 'user_id,key',
}

/** Tables the pull step walks, in dependency order. */
export const PULL_TABLES: SyncTable[] = [
  'settings',
  'tags',
  'tasks',
  'subtasks',
  'taskTags',
  'sessions',
  'achievements',
]
