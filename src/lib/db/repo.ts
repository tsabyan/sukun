import { db, assertBrowser, META_KEYS, setMeta } from './schema'
import { currentUserId } from './identity'
import { ensureSettings, DEFAULT_SETTINGS } from './seed'
import { enqueue } from '@/lib/sync/outbox'
import { newId } from '@/lib/utils/ids'
import { nowIso, today } from '@/lib/utils/dates'
import { computeStreaks, weekDots, type Streaks } from '@/lib/stats/streaks'
import type {
  Achievement,
  CreateTaskInput,
  DayStats,
  ExportBundle,
  HeatmapCell,
  LocalDate,
  PersonalBests,
  Session,
  SessionDraft,
  Settings,
  Subtask,
  Tag,
  Task,
  TaskColor,
  TaskStatus,
} from './types'

/**
 * The only path to data — docs/06-data-contracts.md §3.
 *
 * No component imports Dexie or the Supabase client. Everything goes through
 * here, which is what keeps the sync layer swappable and the components
 * testable.
 *
 * Two halves:
 *   - async methods below, for mutations and computed reads
 *   - `live` at the bottom, for queries that feed useLiveQuery
 */

function notUntilPhase(method: string, phase: number, doc: string): never {
  throw new Error(
    `repo.${method}() arrives in Phase ${phase} (${doc}). ` +
      'Nothing should be calling it yet.',
  )
}

const alive = <T extends { deletedAt: string | null }>(row: T) => row.deletedAt === null

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const

/* =========================================================== tasks */

export async function listTasks(filter?: {
  status?: TaskStatus
  tagIds?: string[]
  sort?: 'recent' | 'priority' | 'due' | 'alpha'
}): Promise<Task[]> {
  assertBrowser('listTasks')

  let rows = filter?.status
    ? await db.tasks.where('status').equals(filter.status).toArray()
    : await db.tasks.toArray()

  rows = rows.filter(alive)

  // Chips are inclusive: a task matching any selected tag stays in.
  if (filter?.tagIds?.length) {
    const links = await db.taskTags.where('tagId').anyOf(filter.tagIds).toArray()
    const matching = new Set(links.map((l) => l.taskId))
    rows = rows.filter((t) => matching.has(t.id))
  }

  switch (filter?.sort ?? 'recent') {
    case 'priority':
      return rows.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          b.updatedAt.localeCompare(a.updatedAt),
      )
    case 'due':
      // no due date sorts last — an undated task isn't overdue
      return rows.sort((a, b) => {
        if (a.dueDate === b.dueDate) return b.updatedAt.localeCompare(a.updatedAt)
        if (a.dueDate === null) return 1
        if (b.dueDate === null) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
    case 'alpha':
      return rows.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
}

export async function getTask(id: string): Promise<Task | undefined> {
  assertBrowser('getTask')
  const row = await db.tasks.get(id)
  return row && alive(row) ? row : undefined
}

export async function countActiveTasks(): Promise<number> {
  assertBrowser('countActiveTasks')
  const rows = await db.tasks.where('status').equals('active').toArray()
  return rows.filter(alive).length
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  assertBrowser('createTask')
  const userId = await currentUserId()
  const now = nowIso()
  const { tagIds = [], ...rest } = input

  const task: Task = {
    id: newId(),
    userId,
    title: rest.title,
    description: rest.description ?? null,
    icon: rest.icon ?? 'circle-dashed',
    color: rest.color ?? 'sage',
    category: rest.category ?? null,
    priority: rest.priority ?? 'medium',
    status: 'active',
    estimatedPomodoros: rest.estimatedPomodoros ?? 1,
    completedPomodoros: 0,
    dueDate: rest.dueDate ?? null,
    plannedDate: rest.plannedDate ?? null,
    plannedBlock: rest.plannedBlock ?? null,
    plannedOrder: 0,
    plannedManually: rest.plannedBlock != null,
    recurrence: rest.recurrence ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    deletedAt: null,
  }

  await db.transaction('rw', [db.tasks, db.taskTags, db.outbox], async () => {
    await db.tasks.add(task)
    await enqueue('tasks', task.id, 'upsert', task)

    for (const tagId of tagIds) {
      const link = { taskId: task.id, tagId, userId, createdAt: now }
      await db.taskTags.put(link)
      await enqueue('taskTags', `${task.id}:${tagId}`, 'upsert', link)
    }
  })

  return task
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  assertBrowser('updateTask')

  await db.transaction('rw', [db.tasks, db.outbox], async () => {
    const existing = await db.tasks.get(id)
    if (!existing) throw new Error(`No task ${id}`)

    const next: Task = { ...existing, ...patch, id, updatedAt: nowIso() }
    await db.tasks.put(next)
    await enqueue('tasks', id, 'upsert', next)
  })
}

export async function completeTask(id: string): Promise<void> {
  const now = nowIso()
  await updateTask(id, { status: 'completed', completedAt: now })
}

export async function reopenTask(id: string): Promise<void> {
  await updateTask(id, { status: 'active', completedAt: null })
}

/** Soft delete. Rows survive 30 days so undo and delete-sync both stay trivial. */
export async function deleteTask(id: string): Promise<void> {
  await updateTask(id, { deletedAt: nowIso() })
}

export async function restoreTask(id: string): Promise<void> {
  await updateTask(id, { deletedAt: null })
}

/* ========================================================= planner */

export async function listPlanned(date: LocalDate): Promise<Task[]> {
  assertBrowser('listPlanned')
  const rows = await db.tasks.where('plannedDate').equals(date).toArray()
  return rows
    .filter(alive)
    .sort((a, b) => a.plannedOrder - b.plannedOrder || a.createdAt.localeCompare(b.createdAt))
}

export async function setPlacement(
  id: string,
  block: Task['plannedBlock'],
  order: number,
  manual: boolean,
  date: LocalDate = today(),
): Promise<void> {
  await updateTask(id, {
    plannedBlock: block,
    plannedOrder: order,
    plannedManually: manual,
    plannedDate: block === null ? null : date,
  })
}

export async function autoPlan(): Promise<{ placed: number; overflow: number }> {
  return notUntilPhase('autoPlan', 5, 'docs/05-screens.md S2')
}

export async function undoAutoPlan(): Promise<void> {
  return notUntilPhase('undoAutoPlan', 5, 'docs/05-screens.md S2')
}

/* ======================================================== subtasks */

export async function listSubtasks(taskId: string): Promise<Subtask[]> {
  assertBrowser('listSubtasks')
  const rows = await db.subtasks.where('taskId').equals(taskId).toArray()
  return rows.filter(alive).sort((a, b) => a.position - b.position)
}

export async function createSubtask(taskId: string, title: string): Promise<Subtask> {
  assertBrowser('createSubtask')
  const userId = await currentUserId()
  const siblings = await listSubtasks(taskId)
  const now = nowIso()

  const subtask: Subtask = {
    id: newId(),
    userId,
    taskId,
    title,
    priority: 'medium',
    isDone: false,
    position: siblings.length,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  await db.transaction('rw', [db.subtasks, db.outbox], async () => {
    await db.subtasks.add(subtask)
    await enqueue('subtasks', subtask.id, 'upsert', subtask)
  })

  return subtask
}

export async function updateSubtask(id: string, patch: Partial<Subtask>): Promise<void> {
  assertBrowser('updateSubtask')

  await db.transaction('rw', [db.subtasks, db.outbox], async () => {
    const existing = await db.subtasks.get(id)
    if (!existing) throw new Error(`No subtask ${id}`)

    const next: Subtask = { ...existing, ...patch, id, updatedAt: nowIso() }
    await db.subtasks.put(next)
    await enqueue('subtasks', id, 'upsert', next)
  })
}

export async function reorderSubtasks(taskId: string, orderedIds: string[]): Promise<void> {
  assertBrowser('reorderSubtasks')
  const now = nowIso()

  await db.transaction('rw', [db.subtasks, db.outbox], async () => {
    for (const [position, id] of orderedIds.entries()) {
      const existing = await db.subtasks.get(id)
      if (!existing || existing.taskId !== taskId) continue

      const next: Subtask = { ...existing, position, updatedAt: now }
      await db.subtasks.put(next)
      await enqueue('subtasks', id, 'upsert', next)
    }
  })
}

export async function deleteSubtask(id: string): Promise<void> {
  await updateSubtask(id, { deletedAt: nowIso() })
}

/* ============================================================ tags */

export async function listTags(): Promise<Tag[]> {
  assertBrowser('listTags')
  const rows = await db.tags.toArray()
  return rows.filter(alive).sort((a, b) => a.name.localeCompare(b.name))
}

export async function createTag(name: string, color: TaskColor = 'slate'): Promise<Tag> {
  assertBrowser('createTag')
  const userId = await currentUserId()

  const existing = await db.tags.where('name').equals(name).first()
  if (existing && alive(existing)) return existing

  const now = nowIso()
  const tag: Tag = { id: newId(), userId, name, color, createdAt: now, updatedAt: now, deletedAt: null }

  await db.transaction('rw', [db.tags, db.outbox], async () => {
    await db.tags.put(tag)
    await enqueue('tags', tag.id, 'upsert', tag)
  })

  return tag
}

export async function listTaskTagIds(taskId: string): Promise<string[]> {
  assertBrowser('listTaskTagIds')
  const links = await db.taskTags.where('taskId').equals(taskId).toArray()
  return links.map((l) => l.tagId)
}

export async function setTaskTags(taskId: string, tagIds: string[]): Promise<void> {
  assertBrowser('setTaskTags')
  const userId = await currentUserId()
  const now = nowIso()

  await db.transaction('rw', [db.taskTags, db.outbox], async () => {
    const existing = await db.taskTags.where('taskId').equals(taskId).toArray()
    const next = new Set(tagIds)

    for (const link of existing) {
      if (next.has(link.tagId)) continue
      await db.taskTags.delete([link.taskId, link.tagId])
      await enqueue('taskTags', `${taskId}:${link.tagId}`, 'delete', {
        taskId,
        tagId: link.tagId,
      })
    }

    const had = new Set(existing.map((l) => l.tagId))
    for (const tagId of next) {
      if (had.has(tagId)) continue
      const link = { taskId, tagId, userId, createdAt: now }
      await db.taskTags.put(link)
      await enqueue('taskTags', `${taskId}:${tagId}`, 'upsert', link)
    }
  })
}

/* ======================================================== sessions */

export async function recordSession(draft: SessionDraft): Promise<Session> {
  assertBrowser('recordSession')
  const userId = await currentUserId()
  const now = nowIso()

  const session: Session = {
    id: newId(),
    userId,
    ...draft,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  await db.transaction('rw', [db.sessions, db.tasks, db.outbox], async () => {
    await db.sessions.add(session)
    await enqueue('sessions', session.id, 'upsert', session)

    // A completed focus session is the only thing that advances a task.
    if (session.mode === 'focus' && session.completed && session.taskId) {
      const task = await db.tasks.get(session.taskId)
      if (task) {
        const next: Task = {
          ...task,
          completedPomodoros: task.completedPomodoros + 1,
          updatedAt: now,
        }
        await db.tasks.put(next)
        await enqueue('tasks', next.id, 'upsert', next)
      }
    }
  })

  return session
}

export async function listSessions(range: {
  from: LocalDate
  to: LocalDate
}): Promise<Session[]> {
  assertBrowser('listSessions')
  const rows = await db.sessions
    .where('localDate')
    .between(range.from, range.to, true, true)
    .toArray()
  return rows.filter(alive).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

export async function listSessionsForTask(taskId: string): Promise<Session[]> {
  assertBrowser('listSessionsForTask')
  const rows = await db.sessions.where('taskId').equals(taskId).toArray()
  return rows.filter(alive).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/* =========================================================== stats */

/** Local days with at least one completed focus session. */
async function countingDays(): Promise<LocalDate[]> {
  const rows = await db.sessions.where('mode').equals('focus').toArray()
  return rows.filter((s) => alive(s) && s.completed).map((s) => s.localDate)
}

export async function getStreaks(): Promise<Streaks> {
  assertBrowser('getStreaks')
  return computeStreaks(await countingDays())
}

export async function getWeekDots() {
  assertBrowser('getWeekDots')
  return weekDots(await countingDays())
}

export async function getDayStats(date: LocalDate = today()): Promise<DayStats> {
  assertBrowser('getDayStats')
  const rows = await db.sessions.where('[mode+localDate]').equals(['focus', date]).toArray()
  const live = rows.filter(alive)
  return {
    date,
    sessions: live.length,
    focusSeconds: live.reduce((sum, s) => sum + s.actualDurationSec, 0),
  }
}

export async function getHeatmap(): Promise<HeatmapCell[]> {
  return notUntilPhase('getHeatmap', 6, 'docs/06-data-contracts.md §4')
}

export async function getPersonalBests(): Promise<PersonalBests> {
  return notUntilPhase('getPersonalBests', 6, 'docs/05-screens.md S8')
}

export async function getAchievements(): Promise<Achievement[]> {
  assertBrowser('getAchievements')
  return db.achievements.toArray()
}

export async function evaluateAchievements(): Promise<string[]> {
  return notUntilPhase('evaluateAchievements', 6, 'docs/05-screens.md S7')
}

/* ======================================================== settings */

export async function getSettings(): Promise<Settings> {
  assertBrowser('getSettings')
  return ensureSettings()
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  assertBrowser('updateSettings')
  const current = await ensureSettings()

  await db.transaction('rw', [db.settings, db.outbox], async () => {
    const next: Settings = { ...current, ...patch, userId: current.userId, updatedAt: nowIso() }
    await db.settings.put(next)
    await enqueue('settings', next.userId, 'upsert', next)
  })
}

/* ============================================================ data */

export async function exportAll(): Promise<ExportBundle> {
  assertBrowser('exportAll')
  const settings = await ensureSettings()

  const [tasks, subtasks, tags, taskTags, sessions, achievements] = await Promise.all([
    db.tasks.toArray(),
    db.subtasks.toArray(),
    db.tags.toArray(),
    db.taskTags.toArray(),
    db.sessions.toArray(),
    db.achievements.toArray(),
  ])

  return {
    version: 1,
    exportedAt: nowIso(),
    tasks: tasks.filter(alive),
    subtasks: subtasks.filter(alive),
    tags: tags.filter(alive),
    taskTags: taskTags.map(({ taskId, tagId }) => ({ taskId, tagId })),
    sessions: sessions.filter(alive),
    achievements,
    settings,
  }
}

/**
 * Additive and idempotent: upsert by id, newer updatedAt wins. Never
 * wipe-and-replace — importing a stale backup must not cost you this week's
 * work. docs/06-data-contracts.md §7.
 */
export async function importAll(bundle: ExportBundle): Promise<void> {
  assertBrowser('importAll')
  const userId = await currentUserId()
  const now = nowIso()

  await db.transaction(
    'rw',
    [db.tasks, db.subtasks, db.tags, db.taskTags, db.sessions, db.achievements, db.outbox],
    async () => {
      // Unrolled per table. A generic helper reads tidier but collapses four
      // different Dexie row types into a union that `put` will not accept.
      for (const row of bundle.tasks) {
        const existing = await db.tasks.get(row.id)
        if (existing && existing.updatedAt >= row.updatedAt) continue
        const owned: Task = { ...row, userId }
        await db.tasks.put(owned)
        await enqueue('tasks', row.id, 'upsert', owned)
      }

      for (const row of bundle.subtasks) {
        const existing = await db.subtasks.get(row.id)
        if (existing && existing.updatedAt >= row.updatedAt) continue
        const owned: Subtask = { ...row, userId }
        await db.subtasks.put(owned)
        await enqueue('subtasks', row.id, 'upsert', owned)
      }

      for (const row of bundle.tags) {
        const existing = await db.tags.get(row.id)
        if (existing && existing.updatedAt >= row.updatedAt) continue
        const owned: Tag = { ...row, userId }
        await db.tags.put(owned)
        await enqueue('tags', row.id, 'upsert', owned)
      }

      for (const row of bundle.sessions) {
        const existing = await db.sessions.get(row.id)
        if (existing && existing.updatedAt >= row.updatedAt) continue
        const owned: Session = { ...row, userId }
        await db.sessions.put(owned)
        await enqueue('sessions', row.id, 'upsert', owned)
      }

      for (const { taskId, tagId } of bundle.taskTags) {
        const link = { taskId, tagId, userId, createdAt: now }
        await db.taskTags.put(link)
        await enqueue('taskTags', `${taskId}:${tagId}`, 'upsert', link)
      }

      for (const achievement of bundle.achievements) {
        const existing = await db.achievements.get(achievement.key)
        if (existing) continue
        const owned = { ...achievement, userId }
        await db.achievements.put(owned)
        await enqueue('achievements', achievement.key, 'upsert', owned)
      }
    },
  )
}

export async function deleteAllData(): Promise<void> {
  assertBrowser('deleteAllData')

  await db.transaction(
    'rw',
    [
      db.tasks,
      db.subtasks,
      db.tags,
      db.taskTags,
      db.sessions,
      db.achievements,
      db.settings,
      db.outbox,
      db.meta,
    ],
    async () => {
      await Promise.all([
        db.tasks.clear(),
        db.subtasks.clear(),
        db.tags.clear(),
        db.taskTags.clear(),
        db.sessions.clear(),
        db.achievements.clear(),
        db.settings.clear(),
        db.outbox.clear(),
      ])
      await db.meta.where('key').notEqual(META_KEYS.userId).delete()
    },
  )

  await setMeta(META_KEYS.seededAt, null)
  const userId = await currentUserId()
  await db.settings.put({
    ...DEFAULT_SETTINGS,
    userId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })
}

/* ============================================================ live */

/**
 * Query builders for useLiveQuery. These return promises Dexie can track for
 * re-render on write — the async methods above are for mutations and computed
 * reads. docs/06-data-contracts.md §3.
 */
export const live = {
  tasks: (status?: TaskStatus) =>
    status
      ? db.tasks
          .where('status')
          .equals(status)
          .filter(alive)
          .toArray()
      : db.tasks.filter(alive).toArray(),

  task: (id: string) => db.tasks.get(id),

  subtasks: (taskId: string) =>
    db.subtasks
      .where('taskId')
      .equals(taskId)
      .filter(alive)
      .sortBy('position'),

  tags: () => db.tags.filter(alive).sortBy('name'),

  planned: (date: LocalDate) =>
    db.tasks.where('plannedDate').equals(date).filter(alive).sortBy('plannedOrder'),

  sessionsOn: (date: LocalDate) =>
    db.sessions.where('[mode+localDate]').equals(['focus', date]).filter(alive).toArray(),

  settings: (userId: string) => db.settings.get(userId),

  activeTaskCount: () => db.tasks.where('status').equals('active').filter(alive).count(),

  outboxCount: () => db.outbox.count(),
}

/** Namespace object matching the Repo interface in docs/06 §3. */
export const repo = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  completeTask,
  reopenTask,
  deleteTask,
  restoreTask,
  countActiveTasks,
  listPlanned,
  setPlacement,
  autoPlan,
  undoAutoPlan,
  listSubtasks,
  createSubtask,
  updateSubtask,
  reorderSubtasks,
  deleteSubtask,
  listTags,
  createTag,
  listTaskTagIds,
  setTaskTags,
  recordSession,
  listSessions,
  listSessionsForTask,
  getStreaks,
  getWeekDots,
  getDayStats,
  getHeatmap,
  getPersonalBests,
  getAchievements,
  evaluateAchievements,
  getSettings,
  updateSettings,
  exportAll,
  importAll,
  deleteAllData,
  live,
}

export type Repo = typeof repo
