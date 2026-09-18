import { db, META_KEYS, setMeta } from './schema'
import { currentUserId } from './identity'
import { ensureSettings, TASK_TEMPLATES } from './seed'
import {
  createTask,
  createSubtask,
  createTag,
  setTaskTags,
  recordSession,
  createIdentity,
  createHabit,
  toggleHabitDay,
} from './repo'
import { addDays, fromLocalDate, today, toLocalDate } from '@/lib/utils/dates'
import type { Priority, TaskColor } from './types'

/**
 * Development fixtures. Never imported by product code — only /dev/seed.
 *
 * The generator is seeded so the same call produces the same data every time.
 * Phase 6 spot-checks heatmap and streak numbers by hand against this, which
 * only works if the fixture is stable.
 */

function mulberry32(seed: number) {
  return function random() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SAMPLE_TASKS: Array<{
  title: string
  description: string
  icon: string
  color: TaskColor
  priority: Priority
  estimate: number
  subtasks: string[]
  tags: string[]
}> = [
  { title: 'Complete Q1 proposal', description: 'Draft and submit the Q1 project proposal', icon: 'file-text', color: 'clay', priority: 'high', estimate: 3, subtasks: ['Research requirements', 'Create initial draft', 'Review and refine', 'Get feedback'], tags: ['work', 'urgent'] },
  { title: 'Review pull requests', description: 'Review and provide feedback on open PRs', icon: 'git-pull-request', color: 'iris', priority: 'medium', estimate: 2, subtasks: ['Backend PRs', 'Frontend PRs'], tags: ['code-review'] },
  { title: 'Team standup preparation', description: 'Notes for tomorrow morning', icon: 'users', color: 'slate', priority: 'low', estimate: 1, subtasks: [], tags: ['work'] },
  { title: 'Update documentation', description: 'Bring the API docs in line with the new endpoints', icon: 'book-open', color: 'sage', priority: 'medium', estimate: 2, subtasks: ['Audit current docs', 'Write missing sections'], tags: ['docs'] },
  { title: 'Fix login bug', description: 'Investigate and fix the authentication timeout', icon: 'bug', color: 'apricot', priority: 'high', estimate: 2, subtasks: ['Reproduce locally', 'Write a failing test', 'Ship the fix'], tags: ['bug', 'urgent'] },
  { title: 'Weekly planning session', description: 'Plan the week ahead', icon: 'calendar', color: 'fog', priority: 'medium', estimate: 1, subtasks: [], tags: ['work'] },
  { title: 'Learn the timer internals', description: 'Read through the background-accuracy approach', icon: 'brain', color: 'plum', priority: 'low', estimate: 4, subtasks: ['Read the spec', 'Try a prototype'], tags: ['learning'] },
  { title: 'Exercise', description: 'Daily workout routine', icon: 'activity', color: 'moss', priority: 'medium', estimate: 1, subtasks: [], tags: ['health'] },
  { title: 'Clear inbox', description: 'Get to zero', icon: 'mail', color: 'fog', priority: 'low', estimate: 1, subtasks: [], tags: ['work'] },
  { title: 'Design review', description: 'Walk through the new screens', icon: 'palette', color: 'iris', priority: 'medium', estimate: 2, subtasks: ['Prep the deck', 'Collect notes'], tags: ['work'] },
  { title: 'Refactor the settings module', description: 'Split the god object', icon: 'code', color: 'sage', priority: 'low', estimate: 3, subtasks: ['Map dependencies', 'Extract helpers', 'Delete dead code'], tags: ['code-review'] },
  { title: 'Read Deep Work', description: 'Two chapters', icon: 'book-open', color: 'clay', priority: 'low', estimate: 2, subtasks: [], tags: ['learning'] },
  { title: 'Quarterly expenses', description: 'File receipts and reconcile', icon: 'file-text', color: 'fog', priority: 'medium', estimate: 1, subtasks: ['Gather receipts', 'Reconcile'], tags: ['admin'] },
  { title: 'Write launch post', description: 'Draft the Show HN post', icon: 'edit', color: 'apricot', priority: 'high', estimate: 2, subtasks: ['Outline', 'Draft', 'Edit down'], tags: ['work'] },
  { title: 'Backup the laptop', description: 'Full disk image before the OS upgrade', icon: 'hard-drive', color: 'slate', priority: 'low', estimate: 1, subtasks: [], tags: ['admin'] },
]

const SAMPLE_IDENTITIES: Array<{ name: string; habits: Array<{ name: string; schedule: number[] }> }> = [
  {
    name: 'A focused engineer',
    habits: [
      { name: 'Read one spec', schedule: [1, 2, 3, 4, 5] },
      { name: 'Ship something small', schedule: [1, 2, 3, 4, 5] },
    ],
  },
  {
    name: 'Someone who moves',
    habits: [
      { name: 'Morning walk', schedule: [0, 1, 2, 3, 4, 5, 6] },
      { name: 'Stretch before bed', schedule: [0, 1, 2, 3, 4, 5, 6] },
    ],
  },
  {
    name: 'A calm reader',
    habits: [{ name: 'Ten pages', schedule: [0, 2, 4, 6] }],
  },
]

export interface SeedResult {
  tasks: number
  subtasks: number
  tags: number
  sessions: number
  days: number
  identities: number
  habits: number
}

export async function seedDevData(days = 90, seed = 42): Promise<SeedResult> {
  const random = mulberry32(seed)
  await ensureSettings()
  await currentUserId()

  /* — tags */
  const tagNames = [...new Set(SAMPLE_TASKS.flatMap((t) => t.tags))]
  const tagIds = new Map<string, string>()
  for (const name of tagNames) {
    const tag = await createTag(name)
    tagIds.set(name, tag.id)
  }

  /* — tasks + subtasks */
  let subtaskCount = 0
  const taskIds: string[] = []
  const start = addDays(today(), -days)

  for (const [index, sample] of SAMPLE_TASKS.entries()) {
    const task = await createTask({
      title: sample.title,
      description: sample.description,
      icon: sample.icon,
      color: sample.color,
      priority: sample.priority,
      estimatedPomodoros: sample.estimate,
    })
    taskIds.push(task.id)

    await setTaskTags(
      task.id,
      sample.tags.map((n) => tagIds.get(n)!).filter(Boolean),
    )

    for (const title of sample.subtasks) {
      const subtask = await createSubtask(task.id, title)
      subtaskCount++
      // roughly a third of steps already done
      if (random() < 0.35) {
        await db.subtasks.update(subtask.id, { isDone: true })
      }
    }

    // the oldest few tasks are finished
    if (index >= SAMPLE_TASKS.length - 4) {
      await db.tasks.update(task.id, {
        status: 'completed',
        completedAt: new Date(Date.parse(start) + index * 86_400_000).toISOString(),
      })
    }
  }

  /* — sessions across the window
     Weighted so the heatmap has real texture: quiet weekends, a dead stretch
     three weeks back, and a couple of heavy days. */
  let sessionCount = 0
  const settings = await ensureSettings()
  const focusSec = settings.focusMinutes * 60

  for (let offset = days; offset >= 0; offset--) {
    const date = addDays(today(), -offset)
    // fromLocalDate, not new Date(date): the latter parses as UTC midnight and
    // reports the wrong weekday for anyone west of Greenwich.
    const weekday = fromLocalDate(date).getDay()
    const isWeekend = weekday === 0 || weekday === 6

    // a two-week gap, so streak logic has something to break on
    const inDeadZone = offset > 20 && offset < 34
    if (inDeadZone) continue

    const roll = random()
    let count = 0
    if (isWeekend) count = roll < 0.55 ? 0 : Math.floor(random() * 3)
    else if (roll < 0.12) count = 0
    else if (roll < 0.75) count = 2 + Math.floor(random() * 3)
    else count = 5 + Math.floor(random() * 4)

    for (let i = 0; i < count; i++) {
      const hour = 9 + Math.floor(random() * 9)
      const minute = Math.floor(random() * 60)
      const startedAt = new Date(`${date}T00:00:00`)
      startedAt.setHours(hour, minute, 0, 0)

      const completed = random() > 0.12
      const actual = completed
        ? focusSec
        : Math.floor(focusSec * (0.2 + random() * 0.6))
      const endedAt = new Date(startedAt.getTime() + actual * 1000)

      await recordSession({
        taskId: random() < 0.8 ? taskIds[Math.floor(random() * taskIds.length)] : null,
        mode: 'focus',
        plannedDurationSec: focusSec,
        actualDurationSec: actual,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        localDate: toLocalDate(startedAt),
        completed,
        interrupted: !completed,
      })
      sessionCount++
    }
  }

  /* — identities, habits and 60 days of habit logs */
  let habitCount = 0
  for (const sample of SAMPLE_IDENTITIES) {
    const identity = await createIdentity(sample.name)
    for (const h of sample.habits) {
      const habit = await createHabit(identity.id, h.name, h.schedule)
      habitCount++
      for (let offset = 60; offset >= 0; offset--) {
        const date = addDays(today(), -offset)
        if (!h.schedule.includes(fromLocalDate(date).getDay())) continue
        if (random() < 0.28) continue
        await toggleHabitDay(habit.id, date)
      }
    }
  }

  await setMeta(META_KEYS.seededAt, new Date().toISOString())

  return {
    tasks: SAMPLE_TASKS.length,
    subtasks: subtaskCount,
    tags: tagNames.length,
    sessions: sessionCount,
    days,
    identities: SAMPLE_IDENTITIES.length,
    habits: habitCount,
  }
}

/** Handy in the console while poking at fixtures. */
export const devTemplates = TASK_TEMPLATES
