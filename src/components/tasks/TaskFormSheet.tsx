'use client'

import { useEffect, useRef, useState } from 'react'
import { useDevOpen } from '@/lib/dev/state'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Plus, X } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, TextAreaField } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Toggle } from '@/components/ui/Toggle'
import { Stepper } from '@/components/ui/Stepper'
import { ChipButton } from '@/components/ui/Pill'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { TaskIconTile } from './TaskIconTile'
import { ICON_NAMES, taskIcon, TASK_COLOR_VAR } from '@/lib/tasks/icons'
import { TASK_TEMPLATES } from '@/lib/db/seed'
import { createTask, createTag, listTaskTagIds, live, setTaskTags, updateTask } from '@/lib/db/repo'
import { TASK_COLORS, type DayBlock, type Priority, type Task, type TaskColor } from '@/lib/db/types'
import { cn } from '@/lib/utils/cn'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface Draft {
  title: string
  description: string
  icon: string
  color: TaskColor
  priority: Priority
  estimatedPomodoros: number
  recurring: boolean
  recurrenceDays: number[]
  tagIds: string[]
}

const EMPTY: Draft = {
  title: '',
  description: '',
  icon: 'circle-dashed',
  color: 'sage',
  priority: 'medium',
  estimatedPomodoros: 1,
  recurring: false,
  recurrenceDays: [],
  tagIds: [],
}

function draftFrom(task: Task, tagIds: string[]): Draft {
  return {
    title: task.title,
    description: task.description ?? '',
    icon: task.icon,
    color: task.color,
    priority: task.priority,
    estimatedPomodoros: task.estimatedPomodoros,
    recurring: task.recurrence !== null,
    recurrenceDays: task.recurrence?.days ?? [],
    tagIds,
  }
}

interface TaskFormSheetProps {
  open: boolean
  onClose: () => void
  /** omit to create */
  task?: Task
  /** pre-fills the planner block when opened from /plan */
  plannedBlock?: DayBlock
  plannedDate?: string
  onSaved?: (taskId: string) => void
}

/**
 * One sheet for create and edit — docs/05-screens.md C5.
 *
 * Frictionless creation is what drives the session-start rate. A clunky form
 * means fewer Pomodoros ever begin, so everything below the title is optional
 * and pre-filled with something sensible.
 */
export function TaskFormSheet({
  open,
  onClose,
  task,
  plannedBlock,
  plannedDate,
  onSaved,
}: TaskFormSheetProps) {
  const editing = task !== undefined
  const tags = useLiveQuery(() => live.tags(), [], [])

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useDevOpen('task-discard', () => setConfirmDiscard(true))

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
  }

  // Load the task being edited, and reset between openings.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const load = async () => {
      if (task) {
        const tagIds = await listTaskTagIds(task.id)
        if (!cancelled) setDraft(draftFrom(task, tagIds))
      } else {
        if (!cancelled) setDraft(EMPTY)
      }
      if (!cancelled) setDirty(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, task])

  // Desktop only. On mobile an auto-raised keyboard covers the sheet before
  // the user has seen what it contains.
  useEffect(() => {
    if (!open) return
    if (window.matchMedia('(pointer: coarse)').matches) return
    const id = window.setTimeout(() => titleRef.current?.focus(), 260)
    return () => window.clearTimeout(id)
  }, [open])

  const titleValid = draft.title.trim().length > 0
  const recurrenceValid = !draft.recurring || draft.recurrenceDays.length > 0
  const canSave = titleValid && recurrenceValid && !saving

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  const applyTemplate = (templateId: string) => {
    const template = TASK_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    setDraft((d) => ({
      ...d,
      title: template.title,
      icon: template.icon,
      color: template.color,
      priority: template.priority,
      estimatedPomodoros: template.estimatedPomodoros,
    }))
    setDirty(true)
    titleRef.current?.focus()
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)

    try {
      const recurrence = draft.recurring
        ? ({ freq: 'weekly', days: [...draft.recurrenceDays].sort() } as const)
        : null

      if (editing) {
        await updateTask(task.id, {
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          icon: draft.icon,
          color: draft.color,
          priority: draft.priority,
          estimatedPomodoros: draft.estimatedPomodoros,
          recurrence,
        })
        await setTaskTags(task.id, draft.tagIds)
        onSaved?.(task.id)
      } else {
        const created = await createTask({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          icon: draft.icon,
          color: draft.color,
          priority: draft.priority,
          estimatedPomodoros: draft.estimatedPomodoros,
          recurrence,
          plannedBlock: plannedBlock ?? null,
          plannedDate: plannedDate ?? null,
          tagIds: draft.tagIds,
        })
        onSaved?.(created.id)
      }

      setDirty(false)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const addTag = async () => {
    const name = newTag.trim()
    if (!name) return
    const tag = await createTag(name)
    setDraft((d) => ({
      ...d,
      tagIds: d.tagIds.includes(tag.id) ? d.tagIds : [...d.tagIds, tag.id],
    }))
    setDirty(true)
    setNewTag('')
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={requestClose}
        title={editing ? 'Edit task' : 'New task'}
        snapPoints={[0.6, 0.95]}
        action={
          <Button variant="primary" size="sm" disabled={!canSave} onClick={() => void handleSave()}>
            {editing ? 'Save changes' : 'Save'}
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          {!editing && (
            <section className="flex flex-col gap-2">
              <span className="eyebrow text-ink-3">Templates</span>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {TASK_TEMPLATES.map((template) => {
                  const Icon = taskIcon(template.icon)
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template.id)}
                      className="flex w-[72px] shrink-0 flex-col items-center gap-2 rounded-md border border-hairline bg-surface p-2 transition-colors hover:border-hairline-strong"
                    >
                      <Icon
                        size={20}
                        strokeWidth={1.75}
                        style={{ color: TASK_COLOR_VAR[template.color] }}
                        aria-hidden
                      />
                      <span className="w-full truncate text-center text-[11px] text-ink-2">
                        {template.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <Field
            ref={titleRef}
            label="Title"
            placeholder="What do you want to accomplish?"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={200}
          />

          <section className="flex flex-col gap-2">
            <span className="eyebrow text-ink-3">Appearance</span>
            <div className="flex items-center gap-3">
              <TaskIconTile icon={draft.icon} color={draft.color} size={44} />
              <p className="text-body-sm text-ink-3">
                Pick an icon and colour so the task is recognisable in a list.
              </p>
            </div>

            <div className="mt-2 grid grid-cols-8 gap-2">
              {ICON_NAMES.map((name) => {
                const Icon = taskIcon(name)
                const selected = name === draft.icon
                return (
                  <button
                    key={name}
                    type="button"
                    aria-label={name}
                    aria-pressed={selected}
                    onClick={() => set('icon', name)}
                    className={cn(
                      'inline-flex aspect-square items-center justify-center rounded-[10px] border transition-colors',
                      selected
                        ? 'border-accent text-accent'
                        : 'border-hairline text-ink-3 hover:text-ink-2',
                    )}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {TASK_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={color === draft.color}
                  onClick={() => set('color', color)}
                  className={cn(
                    'size-8 rounded-full border-2 transition-transform',
                    color === draft.color
                      ? 'border-ink scale-110'
                      : 'border-transparent hover:scale-105',
                  )}
                  style={{ background: TASK_COLOR_VAR[color] }}
                />
              ))}
            </div>
          </section>

          <TextAreaField
            label="Notes"
            optional
            placeholder="Add details or notes…"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={2000}
          />

          <section className="flex flex-col gap-2">
            <span className="eyebrow text-ink-3">Priority</span>
            <SegmentedControl<Priority>
              aria-label="Priority"
              segments={[
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
              value={draft.priority}
              onChange={(value) => set('priority', value)}
            />
          </section>

          <section className="flex items-center justify-between gap-4">
            <div>
              <p className="text-body text-ink">Estimate</p>
              <p className="text-body-sm text-ink-3">How many sessions will this take?</p>
            </div>
            <Stepper
              label="estimate"
              value={draft.estimatedPomodoros}
              onChange={(value) => set('estimatedPomodoros', value)}
              min={0}
              max={50}
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body text-ink">Repeats</p>
                <p className="text-body-sm text-ink-3">Bring this back on chosen days.</p>
              </div>
              <Toggle
                label="Repeats weekly"
                checked={draft.recurring}
                onChange={(value) => set('recurring', value)}
              />
            </div>

            {draft.recurring && (
              <div className="flex gap-1.5">
                {WEEKDAYS.map((initial, index) => {
                  const selected = draft.recurrenceDays.includes(index)
                  return (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Day ${index + 1}`}
                      aria-pressed={selected}
                      onClick={() =>
                        set(
                          'recurrenceDays',
                          selected
                            ? draft.recurrenceDays.filter((d) => d !== index)
                            : [...draft.recurrenceDays, index],
                        )
                      }
                      className={cn(
                        'size-10 rounded-full border text-label transition-colors',
                        selected
                          ? 'accent-muted border-transparent text-accent'
                          : 'border-hairline text-ink-3 hover:text-ink-2',
                      )}
                    >
                      {initial}
                    </button>
                  )
                })}
              </div>
            )}

            {draft.recurring && draft.recurrenceDays.length === 0 && (
              <p className="text-body-sm text-ember">Pick at least one day to repeat on.</p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <span className="eyebrow text-ink-3">Tags</span>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <ChipButton
                  key={tag.id}
                  selected={draft.tagIds.includes(tag.id)}
                  onClick={() =>
                    set(
                      'tagIds',
                      draft.tagIds.includes(tag.id)
                        ? draft.tagIds.filter((id) => id !== tag.id)
                        : [...draft.tagIds, tag.id],
                    )
                  }
                >
                  {tag.name}
                  {draft.tagIds.includes(tag.id) && <Check size={14} strokeWidth={2} />}
                </ChipButton>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  void addTag()
                }}
                placeholder="Add a tag…"
                maxLength={40}
                className="h-11 flex-1 rounded-md border border-hairline bg-surface-sunken px-3.5 text-body text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
              <Button
                aria-label="Add tag"
                disabled={newTag.trim().length === 0}
                onClick={() => void addTag()}
              >
                <Plus size={18} strokeWidth={1.75} />
              </Button>
            </div>
          </section>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDiscard}
        title={editing ? 'Discard your changes?' : 'Discard this task?'}
        body="Anything you have typed will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setDirty(false)
          onClose()
        }}
        onClose={() => setConfirmDiscard(false)}
      />
    </>
  )
}

/** Small helper for callers that just need a dismiss affordance in a header. */
export function SheetCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-full text-ink-2 hover:text-ink"
    >
      <X size={18} strokeWidth={1.75} />
    </button>
  )
}
