/**
 * Domain types — docs/06-data-contracts.md §1.
 *
 * camelCase here, snake_case in Postgres. The conversion lives in exactly one
 * place (lib/sync/mappers.ts, Phase 8) and nowhere else.
 */

export type Priority = 'low' | 'medium' | 'high'
export type TaskStatus = 'active' | 'completed' | 'archived'
export type SessionMode = 'focus' | 'short_break' | 'long_break'
export type DayBlock = 'morning' | 'afternoon' | 'evening'

export const TASK_COLORS = [
  'sage',
  'slate',
  'iris',
  'apricot',
  'clay',
  'moss',
  'fog',
  'plum',
] as const
export type TaskColor = (typeof TASK_COLORS)[number]

export const PRIORITIES: Priority[] = ['low', 'medium', 'high']
export const DAY_BLOCKS: DayBlock[] = ['morning', 'afternoon', 'evening']

/** ISO date, no time: '2026-08-02' */
export type LocalDate = string
/** ISO 8601 with offset */
export type Timestamp = string

export interface Recurrence {
  freq: 'weekly'
  /** 0 = Sunday … 6 = Saturday */
  days: number[]
}

export interface Task {
  id: string
  userId: string
  title: string
  description: string | null
  icon: string
  color: TaskColor
  category: string | null
  priority: Priority
  status: TaskStatus
  estimatedPomodoros: number
  completedPomodoros: number
  dueDate: LocalDate | null
  plannedDate: LocalDate | null
  plannedBlock: DayBlock | null
  plannedOrder: number
  /** local only — Auto-plan must never move a task the user placed by hand */
  plannedManually: boolean
  recurrence: Recurrence | null
  createdAt: Timestamp
  updatedAt: Timestamp
  completedAt: Timestamp | null
  deletedAt: Timestamp | null
}

export interface Subtask {
  id: string
  userId: string
  taskId: string
  title: string
  priority: Priority
  isDone: boolean
  position: number
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export interface Tag {
  id: string
  userId: string
  name: string
  color: TaskColor
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export interface TaskTag {
  taskId: string
  tagId: string
  userId: string
  createdAt: Timestamp
}

export interface Session {
  id: string
  userId: string
  taskId: string | null
  mode: SessionMode
  plannedDurationSec: number
  actualDurationSec: number
  startedAt: Timestamp
  endedAt: Timestamp
  /** user-local calendar day — drives every stat. Written once, never recomputed. */
  localDate: LocalDate
  /** ran to zero */
  completed: boolean
  /** skipped or reset early */
  interrupted: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export interface Settings {
  userId: string
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  soundId: string
  /** 0–1 */
  volume: number
  notificationsEnabled: boolean
  hapticsEnabled: boolean
  theme: 'system' | 'light' | 'dark'
  defaultTimerMode: 'ring' | 'flip'
  /** 0 = Sunday … 6 = Saturday */
  weekStartsOn: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Achievement {
  key: string
  userId: string
  unlockedAt: Timestamp
}

/* -------------------------------------------------------------- habits */

/** "Who you want to become" — the parent of a set of habits. */
export interface Identity {
  id: string
  userId: string
  name: string
  position: number
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export interface Habit {
  id: string
  userId: string
  identityId: string
  name: string
  /** 0 = Sunday … 6 = Saturday. Weekdays the habit is scheduled. */
  schedule: number[]
  position: number
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

/**
 * One row per (habit, day) the habit was marked done. Toggling a day off soft-
 * deletes the row rather than removing it, so the untoggle still syncs.
 * Compound primary key [habitId+day] — there is no surrogate id.
 */
export interface HabitLog {
  habitId: string
  userId: string
  day: LocalDate
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

/* ------------------------------------------------------------------ inputs */

export interface CreateTaskInput {
  title: string
  description?: string | null
  icon?: string
  color?: TaskColor
  category?: string | null
  priority?: Priority
  estimatedPomodoros?: number
  dueDate?: LocalDate | null
  plannedDate?: LocalDate | null
  plannedBlock?: DayBlock | null
  recurrence?: Recurrence | null
  tagIds?: string[]
}

export interface SessionDraft {
  taskId: string | null
  mode: SessionMode
  plannedDurationSec: number
  actualDurationSec: number
  startedAt: Timestamp
  endedAt: Timestamp
  localDate: LocalDate
  completed: boolean
  interrupted: boolean
}

/* ------------------------------------------------------------------- stats */

export interface HeatmapCell {
  date: LocalDate
  sessions: number
  focusSeconds: number
  level: 0 | 1 | 2 | 3 | 4
}

export interface PeriodStat {
  label: string
  focusSeconds: number
  sessions: number
}

export interface PersonalBests {
  bestDay: PeriodStat | null
  bestWeek: PeriodStat | null
  bestMonth: PeriodStat | null
  currentStreak: number
  longestStreak: number
  currentPeriod: { focusSeconds: number; sessions: number; pctOfBest: number }
  rankings: Array<PeriodStat & { isCurrent: boolean }>
}

export interface DayStats {
  date: LocalDate
  sessions: number
  focusSeconds: number
}

/* ------------------------------------------------------------- sync / local */

export type SyncTable =
  | 'tasks'
  | 'subtasks'
  | 'sessions'
  | 'tags'
  | 'taskTags'
  | 'settings'
  | 'achievements'
  | 'identities'
  | 'habits'
  | 'habitLogs'
  /** both insert-only; read from the Supabase dashboard, never from the app */
  | 'waitlist'
  | 'deviceDays'

export interface OutboxEntry {
  id: string
  table: SyncTable
  rowId: string
  op: 'upsert' | 'delete'
  payload: unknown
  createdAt: number
  attempts: number
}

/** Key/value scratch space. Never synced — a running timer is device-local. */
export interface MetaEntry {
  key: string
  value: unknown
}

export interface ExportBundle {
  version: 1
  exportedAt: Timestamp
  tasks: Task[]
  subtasks: Subtask[]
  tags: Tag[]
  taskTags: Array<{ taskId: string; tagId: string }>
  sessions: Session[]
  achievements: Achievement[]
  settings: Settings
}
