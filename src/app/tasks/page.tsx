'use client'

import { Suspense, useRef, useState } from 'react'
import { useDevOpen } from '@/lib/dev/state'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ListPlus, Lock, Plus, Settings } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ChipButton, Pill } from '@/components/ui/Pill'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { HeroCard, HeroStats } from '@/components/ui/HeroCard'
import { toast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shell/PageHeader'
import { useAddIntent } from '@/lib/ui/fab'
import { TaskRow } from '@/components/tasks/TaskRow'
import { TaskFormSheet } from '@/components/tasks/TaskFormSheet'
import { UpsellSheet } from '@/components/tasks/UpsellSheet'
import {
  FREE_TASK_LIMIT,
  FREE_TASK_WARN_AT,
  completeTask,
  isPro,
  deleteTask,
  getDayStats,
  listTasks,
  live,
  recordEvent,
  reopenTask,
  restoreTask,
} from '@/lib/db/repo'
import { formatDuration, today } from '@/lib/utils/dates'
import type { Task, TaskStatus } from '@/lib/db/types'

/*
 * No sort control. The four orders (recent / priority / due / A–Z) shipped as
 * chips behind a header button and never did what the labels promised, so the
 * button was a lie you had to tap twice to discover. The list is newest-first,
 * which is what the header button's default was anyway — issue #6.
 */

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

  const [status, setStatus] = useState<TaskStatus | 'all'>('active')
  const [tagIds, setTagIds] = useState<string[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [upsellOpen, setUpsellOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)

  const tags = useLiveQuery(() => live.tags(), [], [])
  const activeCount = useLiveQuery(() => live.activeTaskCount(), [], 0)
  // Mirrored from the account's profile by the sync cycle; false until one
  // lands, which is the right answer for a device that has never signed in.
  const pro = useLiveQuery(() => isPro(), [], false)
  const completedCount = useLiveQuery(() => live.completedTaskCount(), [], 0)

  const tasks = useLiveQuery(
    () =>
      listTasks({
        status: status === 'all' ? undefined : status,
        tagIds: tagIds.length ? tagIds : undefined,
      }),
    [status, tagIds.join(',')],
    undefined,
  )

  /** The hero's three numbers: what today holds, and what the month produced. */
  const summary = useLiveQuery(async () => {
    const [planned, day, completed] = await Promise.all([
      live.planned(today()),
      getDayStats(),
      live.tasks('completed'),
    ])
    const estimateLeft = (await live.tasks('active')).reduce(
      (total, task) => total + Math.max(0, task.estimatedPomodoros - task.completedPomodoros),
      0,
    )
    return {
      plannedToday: planned.filter((task) => task.status === 'active').length,
      focusedToday: day.focusSeconds,
      completed: completed.length,
      estimateLeft,
    }
  }, [])

  useDevOpen('task-new', () => setFormOpen(true))
  useDevOpen('upsell', () => setUpsellOpen(true))
  useDevOpen('upsell-error', () => setUpsellOpen(true))
  useDevOpen('upsell-sent', () => setUpsellOpen(true))
  useDevOpen('task-discard', () => setFormOpen(true))
  useDevOpen(
    'task-delete',
    () => {
      if (!tasks?.length) return false
      setPendingDelete(tasks[0])
    },
    [tasks],
  )

  // Pro lifts the wall entirely — the meter and the upsell both vanish rather
  // than sitting there greyed out.
  const atLimit = !pro && activeCount >= FREE_TASK_LIMIT
  const showMeter = !pro && activeCount >= FREE_TASK_WARN_AT

  /**
   * Every path that hits the wall goes through here, so the event counts the
   * gate being *reached* rather than the sheet being rendered — the dev hooks
   * above open the same sheet and must not land in the funnel.
   */
  const hitProGate = () => {
    void recordEvent('pro_gate_hit')
    setUpsellOpen(true)
  }

  useAddIntent('task', () => (atLimit ? hitProGate() : setFormOpen(true)))

  // Consume the query flag during render; an effect would flash the list first.
  const [handledNew, setHandledNew] = useState(false)
  if (wantsNew && !handledNew) {
    setHandledNew(true)
    if (atLimit) hitProGate()
    else setFormOpen(true)
  }

  const openCreate = () => {
    // The wall, not a nag: the add button itself becomes the upsell.
    if (atLimit) {
      hitProGate()
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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Tasks"
        actions={
          <>
            <Link
              href="/settings"
              aria-label="Settings"
              className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
            >
              <Settings size={20} strokeWidth={1.75} />
            </Link>
          </>
        }
      />

      <HeroCard
        title={status === 'completed' ? 'Completed' : 'Open tasks'}
        chip={
          <Pill tone="dark">
            {status === 'active' ? 'Active' : status === 'completed' ? 'This month' : 'All'}
          </Pill>
        }
        value={status === 'completed' ? completedCount : activeCount}
        sub={
          atLimit
            ? `${activeCount} of ${FREE_TASK_LIMIT} on the free plan`
            : summary && summary.plannedToday > 0
              ? `${summary.plannedToday} planned for today`
              : 'nothing planned for today yet'
        }
      >
        <HeroStats
          items={[
            { value: String(summary?.plannedToday ?? 0), label: 'planned' },
            { value: String(summary?.completed ?? 0), label: 'completed' },
            {
              value: summary ? formatDuration(summary.focusedToday) : '0m',
              label: 'today',
            },
          ]}
        />
      </HeroCard>

      <SegmentedControl<TaskStatus | 'all'>
        aria-label="Task filter"
        segments={[
          { value: 'active', label: 'Active', count: activeCount },
          { value: 'completed', label: 'Completed', count: completedCount },
          { value: 'all', label: 'All' },
        ]}
        value={status}
        onChange={setStatus}
      />

      {tags.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
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

      {showMeter && <FreeTierMeter count={activeCount} onOpen={hitProGate} />}

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
  status: TaskStatus | 'all'
  filtered: boolean
  onCreate: () => void
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  if (!tasks) return <Card className="h-64 animate-pulse" padding="none" />

  if (tasks.length === 0) {
    return (
      <Card padding="none" className="py-2">
        <EmptyState
          icon={ListPlus}
          title={
            filtered
              ? 'Nothing under those tags'
              : status === 'completed'
                ? 'Nothing completed yet'
                : 'No tasks yet'
          }
          body={
            filtered
              ? 'Clear a tag to see the rest of the list.'
              : status === 'completed'
                ? 'Finish one and it lands here with the sessions it took.'
                : 'Add one to give your next session a purpose. Templates make it a two-tap job.'
          }
          action={
            status !== 'completed' && !filtered ? (
              <Button variant="primary" onClick={onCreate}>
                <Plus size={16} strokeWidth={2} aria-hidden />
                New task
              </Button>
            ) : null
          }
        />
      </Card>
    )
  }

  if (tasks.length > VIRTUALIZE_ABOVE) {
    return <VirtualTaskList tasks={tasks} onComplete={onComplete} onDelete={onDelete} />
  }

  return (
    <Card padding="list">
      <ul>
        {tasks.map((task, i) => (
          <li key={task.id}>
            <TaskRow
              task={task}
              onComplete={onComplete}
              onDelete={onDelete}
              last={i === tasks.length - 1}
            />
          </li>
        ))}
      </ul>
    </Card>
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
    <Card padding="list">
      <div ref={scrollRef} className="max-h-[70dvh] overflow-y-auto">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const task = tasks[item.index]
            return (
              <div
                key={task.id}
                className="absolute inset-x-0"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <TaskRow task={task} onComplete={onComplete} onDelete={onDelete} />
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------- free tier */

function FreeTierMeter({ count, onOpen }: { count: number; onOpen: () => void }) {
  const remaining = Math.max(0, FREE_TASK_LIMIT - count)
  const ratio = Math.min(1, count / FREE_TASK_LIMIT)

  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <Card padding="compact" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-sm tabular-nums text-ink-2">
            {count} of {FREE_TASK_LIMIT} active tasks
          </span>
          <Pill tone="accent">
            <Lock size={12} strokeWidth={1.75} aria-hidden />
            Plus
          </Pill>
        </div>

        <span className="block h-1.5 overflow-hidden rounded-full bg-track">
          <span
            className="block h-full rounded-full bg-ink transition-[width] duration-300"
            style={{ width: `${ratio * 100}%` }}
          />
        </span>

        <span className="text-body-sm text-ink-3">
          {remaining === 0 ? 'Free limit reached' : `${remaining} left on the free plan`}
        </span>
      </Card>
    </button>
  )
}
