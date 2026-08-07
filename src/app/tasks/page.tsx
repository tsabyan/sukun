'use client'

import { Suspense, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDownUp, Plus, Settings, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ChipButton, Pill } from '@/components/ui/Pill'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { toast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shell/PageHeader'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskFormSheet } from '@/components/tasks/TaskFormSheet'
import { UpsellSheet } from '@/components/tasks/UpsellSheet'
import {
  FREE_TASK_LIMIT,
  FREE_TASK_WARN_AT,
  completeTask,
  deleteTask,
  listTasks,
  live,
  reopenTask,
  restoreTask,
} from '@/lib/db/repo'
import type { Task, TaskStatus } from '@/lib/db/types'

type SortKey = 'recent' | 'priority' | 'due' | 'alpha'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'recent', label: 'Recent' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due date' },
  { key: 'alpha', label: 'A–Z' },
]

/** Above this, render only what fits on screen — docs/02-architecture.md §7. */
const VIRTUALIZE_ABOVE = 100
const ROW_HEIGHT = 84

/**
 * useSearchParams opts a route out of static prerendering unless it sits
 * inside a Suspense boundary, so the screen is split from the route.
 */
export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-2 pt-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-[76px] animate-pulse" />
          ))}
        </div>
      }
    >
      <TasksScreen />
    </Suspense>
  )
}

function TasksScreen() {
  // The N shortcut routes here with ?new=1 rather than reaching into this
  // page's state from a global handler.
  const searchParams = useSearchParams()
  const wantsNew = searchParams.get('new') === '1'

  const [status, setStatus] = useState<TaskStatus>('active')
  const [sort, setSort] = useState<SortKey>('recent')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [sortOpen, setSortOpen] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [upsellOpen, setUpsellOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)

  const tags = useLiveQuery(() => live.tags(), [], [])
  const activeCount = useLiveQuery(() => live.activeTaskCount(), [], 0)
  const completedCount = useLiveQuery(() => live.completedTaskCount(), [], 0)

  const tasks = useLiveQuery(
    () => listTasks({ status, tagIds: tagIds.length ? tagIds : undefined, sort }),
    [status, sort, tagIds.join(',')],
    undefined,
  )

  const atLimit = activeCount >= FREE_TASK_LIMIT
  const showMeter = activeCount >= FREE_TASK_WARN_AT

  // Consume the query flag during render; an effect would flash the list first.
  const [handledNew, setHandledNew] = useState(false)
  if (wantsNew && !handledNew) {
    setHandledNew(true)
    if (activeCount >= FREE_TASK_LIMIT) setUpsellOpen(true)
    else setFormOpen(true)
  }

  const openCreate = () => {
    // The wall, not a nag: the add button itself becomes the upsell.
    if (atLimit) {
      setUpsellOpen(true)
      return
    }
    setFormOpen(true)
  }

  const handleComplete = async (task: Task) => {
    if (task.status === 'completed') {
      await reopenTask(task.id)
      toast('Task reopened')
      return
    }
    await completeTask(task.id)
    toast(`${task.title} completed`, {
      action: { label: 'Undo', onPress: () => void reopenTask(task.id) },
      durationMs: 6000,
    })
  }

  const confirmDelete = async () => {
    const task = pendingDelete
    if (!task) return
    await deleteTask(task.id)
    toast('Task deleted', {
      action: { label: 'Undo', onPress: () => void restoreTask(task.id) },
      durationMs: 6000,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tasks"
        actions={
          <>
            <IconButton label="Sort tasks" onClick={() => setSortOpen((v) => !v)}>
              <ArrowDownUp size={20} strokeWidth={1.75} />
            </IconButton>
            <IconButton label="Add task" variant="primary" size={40} onClick={openCreate}>
              <Plus size={20} strokeWidth={2} />
            </IconButton>
            <Link
              href="/settings"
              aria-label="Settings"
              className="inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:text-ink"
            >
              <Settings size={20} strokeWidth={1.75} />
            </Link>
          </>
        }
      />

      <SegmentedControl<TaskStatus>
        aria-label="Task filter"
        segments={[
          { value: 'active', label: 'Active', count: activeCount },
          { value: 'completed', label: 'Completed', count: completedCount },
        ]}
        value={status}
        onChange={setStatus}
      />

      {sortOpen && (
        <div className="flex flex-wrap gap-2">
          {SORTS.map((option) => (
            <ChipButton
              key={option.key}
              selected={sort === option.key}
              onClick={() => {
                setSort(option.key)
                setSortOpen(false)
              }}
            >
              {option.label}
            </ChipButton>
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {tags.map((tag) => (
            <ChipButton
              key={tag.id}
              selected={tagIds.includes(tag.id)}
              onClick={() =>
                setTagIds((current) =>
                  current.includes(tag.id)
                    ? current.filter((id) => id !== tag.id)
                    : [...current, tag.id],
                )
              }
            >
              {tag.name}
            </ChipButton>
          ))}
        </div>
      )}

      {showMeter && <FreeTierMeter count={activeCount} onOpen={() => setUpsellOpen(true)} />}

      <TaskListBody
        tasks={tasks}
        status={status}
        filtered={tagIds.length > 0}
        onCreate={openCreate}
        onComplete={handleComplete}
        onDelete={setPendingDelete}
      />

      <TaskFormSheet open={formOpen} onClose={() => setFormOpen(false)} />
      <UpsellSheet open={upsellOpen} onClose={() => setUpsellOpen(false)} />

      <ConfirmSheet
        open={pendingDelete !== null}
        title="Delete this task?"
        body={
          pendingDelete
            ? `"${pendingDelete.title}" and its subtasks will be removed. You can undo this straight after.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- the list */

function TaskListBody({
  tasks,
  status,
  filtered,
  onCreate,
  onComplete,
  onDelete,
}: {
  tasks: Task[] | undefined
  status: TaskStatus
  filtered: boolean
  onCreate: () => void
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  if (!tasks) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="h-[76px] animate-pulse" />
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-4">
        <p className="text-body text-ink-2">
          {filtered
            ? 'No tasks match those tags.'
            : status === 'active'
              ? 'No open tasks. Add one, or check what you finished.'
              : 'Nothing completed yet.'}
        </p>
        {status === 'active' && !filtered && (
          <Button variant="primary" onClick={onCreate}>
            <Plus size={18} strokeWidth={1.75} />
            Add a task
          </Button>
        )}
      </Card>
    )
  }

  if (tasks.length > VIRTUALIZE_ABOVE) {
    return <VirtualTaskList tasks={tasks} onComplete={onComplete} onDelete={onDelete} />
  }

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskCard task={task} onComplete={onComplete} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  )
}

function VirtualTaskList({
  tasks,
  onComplete,
  onDelete,
}: {
  tasks: Task[]
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  return (
    <div ref={scrollRef} className="max-h-[70dvh] overflow-y-auto">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const task = tasks[item.index]
          return (
            <div
              key={task.id}
              className="absolute inset-x-0 pb-2"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <TaskCard task={task} onComplete={onComplete} onDelete={onDelete} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- free tier */

function FreeTierMeter({ count, onOpen }: { count: number; onOpen: () => void }) {
  const remaining = Math.max(0, FREE_TASK_LIMIT - count)
  const ratio = Math.min(1, count / FREE_TASK_LIMIT)

  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <Card padding="compact" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-body-sm tabular-nums text-ink-2">
            {count} of {FREE_TASK_LIMIT} tasks
          </span>
          <Pill tone="accent">
            <Sparkles size={13} strokeWidth={1.75} aria-hidden />
            Pro
          </Pill>
        </div>

        <span className="block h-1.5 overflow-hidden rounded-full bg-hairline">
          <span
            className="block h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${ratio * 100}%` }}
          />
        </span>

        <span className="text-body-sm text-ink-3">
          {remaining === 0 ? 'Free limit reached' : `${remaining} left on the free tier`}
        </span>
      </Card>
    </button>
  )
}
