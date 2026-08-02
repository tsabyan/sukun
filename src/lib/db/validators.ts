import { z } from 'zod'
import { TASK_COLORS } from './types'

/**
 * Applied at exactly two boundaries — docs/06-data-contracts.md §5:
 *   1. form submit, before createTask / updateTask
 *   2. import and sync pull, where the data came from outside this device
 *
 * Not applied on internal calls. Validating every read is a tax with no payer.
 */

const priority = z.enum(['low', 'medium', 'high'])
const dayBlock = z.enum(['morning', 'afternoon', 'evening'])
const taskColor = z.enum(TASK_COLORS)
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const recurrenceSchema = z.object({
  freq: z.literal('weekly'),
  days: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one day'),
})

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Give the task a title').max(200),
  description: z.string().max(2000).nullable().default(null),
  icon: z.string().default('circle-dashed'),
  color: taskColor.default('sage'),
  category: z.string().max(60).nullable().default(null),
  priority: priority.default('medium'),
  estimatedPomodoros: z.number().int().min(0).max(50).default(1),
  dueDate: localDate.nullable().default(null),
  plannedDate: localDate.nullable().default(null),
  plannedBlock: dayBlock.nullable().default(null),
  recurrence: recurrenceSchema.nullable().default(null),
  tagIds: z.array(z.string()).default([]),
})

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(['active', 'completed', 'archived']).optional(),
  completedPomodoros: z.number().int().min(0).optional(),
  plannedOrder: z.number().int().min(0).optional(),
  plannedManually: z.boolean().optional(),
})

export const subtaskSchema = z.object({
  title: z.string().trim().min(1, 'Give the step a title').max(200),
  priority: priority.default('medium'),
  isDone: z.boolean().default(false),
})

export const tagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: taskColor.default('slate'),
})

export const settingsSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180),
  shortBreakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(120),
  sessionsUntilLongBreak: z.number().int().min(2).max(12),
  autoStartBreaks: z.boolean(),
  autoStartFocus: z.boolean(),
  soundId: z.string(),
  volume: z.number().min(0).max(1),
  notificationsEnabled: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']),
  defaultTimerMode: z.enum(['ring', 'flip']),
  weekStartsOn: z.number().int().min(0).max(6),
})

export const sessionDraftSchema = z.object({
  taskId: z.string().nullable(),
  mode: z.enum(['focus', 'short_break', 'long_break']),
  plannedDurationSec: z.number().int().min(0),
  actualDurationSec: z.number().int().min(0),
  startedAt: z.string(),
  endedAt: z.string(),
  localDate,
  completed: z.boolean(),
  interrupted: z.boolean(),
})

/** Import is additive and idempotent — never trust a file from disk. */
export const exportBundleSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  tasks: z.array(z.looseObject({ id: z.string(), updatedAt: z.string() })),
  subtasks: z.array(z.looseObject({ id: z.string(), updatedAt: z.string() })),
  tags: z.array(z.looseObject({ id: z.string(), updatedAt: z.string() })),
  taskTags: z.array(z.object({ taskId: z.string(), tagId: z.string() })),
  sessions: z.array(z.looseObject({ id: z.string(), updatedAt: z.string() })),
  achievements: z.array(z.looseObject({ key: z.string() })),
  settings: z.looseObject({}),
})

export type CreateTaskFields = z.input<typeof createTaskSchema>
export type UpdateTaskFields = z.input<typeof updateTaskSchema>
