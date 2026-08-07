import type { Priority, Settings, TaskColor } from './types'
import { db } from './schema'
import { currentUserId } from './identity'
import { nowIso } from '@/lib/utils/dates'

/* --------------------------------------------------------------- settings */

export const DEFAULT_SETTINGS: Omit<Settings, 'userId' | 'createdAt' | 'updatedAt'> = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  soundId: 'chime',
  volume: 0.6,
  notificationsEnabled: false,
  hapticsEnabled: true,
  theme: 'system',
  defaultTimerMode: 'ring',
  weekStartsOn: 1,
}

/**
 * Read settings without ever writing — safe inside a Dexie liveQuery.
 *
 * `useLiveQuery` runs its querier in a read-only transaction, so a write here
 * throws `ReadOnlyError` and takes the whole screen down via the error
 * boundary. Reads therefore go through this; only mutations and the one-time
 * startup seed call `ensureSettings`. Defaults are merged over whatever is
 * stored so a field added in a later release still reads sensibly.
 */
export async function readSettings(): Promise<Settings> {
  const userId = await currentUserId()
  const existing = await db.settings.get(userId)
  if (existing) return { ...DEFAULT_SETTINGS, ...existing, userId }
  const now = nowIso()
  return { ...DEFAULT_SETTINGS, userId, createdAt: now, updatedAt: now }
}

/**
 * Creates the settings row on first run. Safe to call repeatedly, but it
 * WRITES — never call it from inside a liveQuery. Use `readSettings` there.
 */
export async function ensureSettings(): Promise<Settings> {
  const userId = await currentUserId()
  const now = nowIso()
  const existing = await db.settings.get(userId)

  if (existing) {
    const filled: Settings = { ...DEFAULT_SETTINGS, ...existing, userId }
    const stored = existing as unknown as Record<string, unknown>
    const missing = Object.keys(DEFAULT_SETTINGS).some((key) => stored[key] === undefined)
    if (missing) await db.settings.put(filled)
    return filled
  }

  const settings: Settings = { ...DEFAULT_SETTINGS, userId, createdAt: now, updatedAt: now }
  await db.settings.put(settings)
  return settings
}

/* -------------------------------------------------------------- templates */

export interface TaskTemplate {
  id: string
  label: string
  icon: string
  color: TaskColor
  priority: Priority
  estimatedPomodoros: number
  /** pre-filled title; the user can overwrite it */
  title: string
}

/** The strip across the top of the create sheet — docs/05-screens.md S5. */
export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'meeting',
    label: 'Meeting',
    icon: 'users',
    color: 'slate',
    priority: 'medium',
    estimatedPomodoros: 1,
    title: 'Meeting',
  },
  {
    id: 'email',
    label: 'Email',
    icon: 'mail',
    color: 'fog',
    priority: 'low',
    estimatedPomodoros: 1,
    title: 'Clear inbox',
  },
  {
    id: 'coding',
    label: 'Coding',
    icon: 'code',
    color: 'sage',
    priority: 'high',
    estimatedPomodoros: 3,
    title: 'Build ',
  },
  {
    id: 'code-review',
    label: 'Code review',
    icon: 'git-pull-request',
    color: 'iris',
    priority: 'medium',
    estimatedPomodoros: 1,
    title: 'Review pull requests',
  },
  {
    id: 'deep-work',
    label: 'Deep work',
    icon: 'brain',
    color: 'plum',
    priority: 'high',
    estimatedPomodoros: 4,
    title: 'Deep work block',
  },
  {
    id: 'reading',
    label: 'Reading',
    icon: 'book-open',
    color: 'clay',
    priority: 'low',
    estimatedPomodoros: 2,
    title: 'Read ',
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'file-text',
    color: 'fog',
    priority: 'low',
    estimatedPomodoros: 1,
    title: 'Admin and paperwork',
  },
  {
    id: 'exercise',
    label: 'Exercise',
    icon: 'activity',
    color: 'moss',
    priority: 'medium',
    estimatedPomodoros: 1,
    title: 'Exercise',
  },
]

/* ----------------------------------------------------------- achievements */

export type AchievementGroup = 'first-steps' | 'volume' | 'streaks' | 'depth' | 'habit'

export interface AchievementDef {
  key: string
  group: AchievementGroup
  name: string
  /** shown on locked badges too — a goal you can't see isn't a goal */
  requirement: string
  icon: string
}

/**
 * The catalog lives in code, not in Postgres — 22 rows that never change per
 * user. Only the unlock timestamps are stored. docs/05-screens.md S7.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  // first steps
  { key: 'first-session', group: 'first-steps', name: 'First session', requirement: 'Complete one focus session', icon: 'play' },
  { key: 'first-task', group: 'first-steps', name: 'First task done', requirement: 'Complete one task', icon: 'check' },
  { key: 'first-full-day', group: 'first-steps', name: 'First full day', requirement: 'Complete four sessions in a day', icon: 'sun' },
  { key: 'first-week', group: 'first-steps', name: 'First week', requirement: 'Focus on five days in one week', icon: 'calendar' },

  // volume
  { key: 'sessions-10', group: 'volume', name: '10 sessions', requirement: 'Complete 10 focus sessions', icon: 'circle' },
  { key: 'sessions-50', group: 'volume', name: '50 sessions', requirement: 'Complete 50 focus sessions', icon: 'circle' },
  { key: 'sessions-100', group: 'volume', name: '100 sessions', requirement: 'Complete 100 focus sessions', icon: 'circle' },
  { key: 'sessions-250', group: 'volume', name: '250 sessions', requirement: 'Complete 250 focus sessions', icon: 'circle' },
  { key: 'sessions-500', group: 'volume', name: '500 sessions', requirement: 'Complete 500 focus sessions', icon: 'circle' },
  { key: 'sessions-1000', group: 'volume', name: '1000 sessions', requirement: 'Complete 1000 focus sessions', icon: 'circle' },

  // streaks
  { key: 'streak-3', group: 'streaks', name: '3 day streak', requirement: 'Focus three days running', icon: 'flame' },
  { key: 'streak-7', group: 'streaks', name: '7 day streak', requirement: 'Focus seven days running', icon: 'flame' },
  { key: 'streak-14', group: 'streaks', name: '14 day streak', requirement: 'Focus fourteen days running', icon: 'flame' },
  { key: 'streak-30', group: 'streaks', name: '30 day streak', requirement: 'Focus thirty days running', icon: 'flame' },
  { key: 'streak-100', group: 'streaks', name: '100 day streak', requirement: 'Focus one hundred days running', icon: 'flame' },

  // depth
  { key: 'depth-4-day', group: 'depth', name: 'Four in a day', requirement: 'Complete four sessions in one day', icon: 'layers' },
  { key: 'depth-8-day', group: 'depth', name: 'Eight in a day', requirement: 'Complete eight sessions in one day', icon: 'layers' },
  { key: 'depth-3h-day', group: 'depth', name: 'Three hours', requirement: 'Focus for three hours in one day', icon: 'clock' },
  { key: 'depth-10h-week', group: 'depth', name: 'Ten hours', requirement: 'Focus for ten hours in one week', icon: 'clock' },

  // habit
  { key: 'habit-full-week', group: 'habit', name: 'Every day of a week', requirement: 'Focus on all seven days of one week', icon: 'calendar-check' },
  { key: 'habit-full-month', group: 'habit', name: 'A month, no gaps', requirement: 'Focus every day for a calendar month', icon: 'calendar-heart' },
  { key: 'habit-100-tasks', group: 'habit', name: '100 tasks', requirement: 'Complete one hundred tasks', icon: 'list-checks' },
]

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length

export function achievementByKey(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key)
}
