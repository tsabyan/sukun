'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Reorder, useDragControls } from 'motion/react'
import { Check, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { toast } from '@/components/ui/Toast'
import {
  createSubtask,
  deleteSubtask,
  live,
  reorderSubtasks,
  updateSubtask,
} from '@/lib/db/repo'
import { haptic } from '@/lib/utils/haptics'
import { cn } from '@/lib/utils/cn'
import type { Priority, Subtask } from '@/lib/db/types'

const PRIORITY_TONE = { high: 'high', medium: 'medium', low: 'low' } as const
const NEXT_PRIORITY: Record<Priority, Priority> = {
  high: 'medium',
  medium: 'low',
  low: 'high',
}

/**
 * The checklist — docs/05-screens.md S6.
 *
 * Breaking a task into steps is the difference between "someday" and a
 * Pomodoro you start now, so adding a step stays one field and one key.
 *
 * Reordering uses Motion's Reorder rather than a drag-and-drop library; the
 * list is short, vertical, and single-axis, which is exactly what it is for.
 */
export function SubtaskList({ taskId }: { taskId: string }) {
  const stored = useLiveQuery(() => live.subtasks(taskId), [taskId])
  const [draft, setDraft] = useState('')

  /**
   * A drag has to move rows before the write lands, or they snap back
   * mid-gesture. So the reordered list is held locally and dropped the moment
   * the query comes back agreeing with it — adjusted during render rather than
   * in an effect, which would show one frame of the old order.
   */
  const [pending, setPending] = useState<{ signature: string; rows: Subtask[] } | null>(null)
  const signature = stored?.map((s) => s.id).join(',') ?? ''

  if (pending && pending.signature === signature) setPending(null)

  if (!stored) return <Card className="h-[120px] animate-pulse" />

  const order = pending?.rows ?? stored

  const done = stored.filter((s) => s.isDone).length

  const add = async () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    await createSubtask(taskId, title)
  }

  const toggle = async (subtask: Subtask) => {
    haptic('taskComplete')
    await updateSubtask(subtask.id, { isDone: !subtask.isDone })

    // Completing a checklist is not the same as finishing the work, so the
    // parent is never closed silently — it is offered.
    const remaining = stored.filter((s) => s.id !== subtask.id && !s.isDone).length
    if (!subtask.isDone && remaining === 0 && stored.length > 1) {
      toast('All subtasks done. Mark the task complete?', {
        action: {
          label: 'Complete',
          onPress: () => {
            void import('@/lib/db/repo').then((repo) => repo.completeTask(taskId))
          },
        },
        durationMs: 8000,
      })
    }
  }

  const commitOrder = (next: Subtask[]) => {
    setPending({ signature: next.map((s) => s.id).join(','), rows: next })
    void reorderSubtasks(
      taskId,
      next.map((s) => s.id),
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between px-1">
        <h2 className="text-title-m text-ink">
          Subtasks{' '}
          <span className="text-body-sm tabular-nums text-ink-3">
            {done}/{stored.length}
          </span>
        </h2>
      </header>

      {stored.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <Reorder.Group axis="y" values={order} onReorder={commitOrder} className="inset-divider">
            {order.map((subtask) => (
              <SubtaskRow key={subtask.id} subtask={subtask} onToggle={toggle} />
            ))}
          </Reorder.Group>
        </Card>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            void add()
          }}
          placeholder="Add a step…"
          maxLength={200}
          className="h-11 flex-1 rounded-md border border-hairline bg-surface-sunken px-3.5 text-body text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <Button aria-label="Add subtask" disabled={!draft.trim()} onClick={() => void add()}>
          <Plus size={18} strokeWidth={1.75} />
        </Button>
      </div>
    </section>
  )
}

function SubtaskRow({
  subtask,
  onToggle,
}: {
  subtask: Subtask
  onToggle: (subtask: Subtask) => void
}) {
  const controls = useDragControls()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(subtask.title)

  // Pick up a title changed elsewhere (sync, undo) without clobbering what is
  // being typed right now.
  const [lastSeen, setLastSeen] = useState(subtask.title)
  if (lastSeen !== subtask.title) {
    setLastSeen(subtask.title)
    if (!editing) setTitle(subtask.title)
  }

  const commitTitle = async () => {
    setEditing(false)
    const next = title.trim()
    if (!next || next === subtask.title) {
      setTitle(subtask.title)
      return
    }
    await updateSubtask(subtask.id, { title: next })
  }

  return (
    <Reorder.Item
      value={subtask}
      dragListener={false}
      dragControls={controls}
      className="group flex items-center gap-3 bg-surface px-4 py-3"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={subtask.isDone}
        aria-label={subtask.isDone ? `Reopen ${subtask.title}` : `Complete ${subtask.title}`}
        onClick={() => onToggle(subtask)}
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-[8px] border transition-colors',
          subtask.isDone
            ? 'border-accent bg-accent text-on-accent'
            : 'border-hairline-strong text-transparent hover:border-accent',
        )}
      >
        <Check size={14} strokeWidth={2.5} />
      </button>

      <span className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void commitTitle()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitTitle()
              if (e.key === 'Escape') {
                setTitle(subtask.title)
                setEditing(false)
              }
            }}
            className="w-full bg-transparent text-body text-ink focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="block w-full text-left"
          >
            <span
              className={cn(
                'block truncate text-body',
                subtask.isDone ? 'text-ink-3 line-through' : 'text-ink',
              )}
            >
              {subtask.title}
            </span>
            <span className="block text-[11px] text-ink-3">
              Updated {subtask.updatedAt.slice(0, 10)}
            </span>
          </button>
        )}
      </span>

      <button
        type="button"
        aria-label={`Change priority, currently ${subtask.priority}`}
        onClick={() => void updateSubtask(subtask.id, { priority: NEXT_PRIORITY[subtask.priority] })}
      >
        <Pill tone={PRIORITY_TONE[subtask.priority]} className="text-[11px]">
          {subtask.priority}
        </Pill>
      </button>

      {/* Always visible. Hiding this behind hover leaves touch users with no
          way to delete a step at all. */}
      <button
        type="button"
        aria-label={`Delete ${subtask.title}`}
        onClick={() => void deleteSubtask(subtask.id)}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-ink-3 transition-colors hover:text-ember"
      >
        <Trash2 size={16} strokeWidth={1.75} />
      </button>

      <span
        aria-hidden
        onPointerDown={(event) => {
          haptic('dragEngaged')
          controls.start(event)
        }}
        className="cursor-grab touch-none text-ink-3 active:cursor-grabbing"
      >
        <GripVertical size={16} strokeWidth={1.75} />
      </span>
    </Reorder.Item>
  )
}
