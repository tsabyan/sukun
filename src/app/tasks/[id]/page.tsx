'use client'

import { use, useCallback, useState } from 'react'
import { useDevOpen } from '@/lib/dev/state'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronLeft,
  Flag,
  Pencil,
  Play,
  StickyNote,
  Timer,
  Trash2,
} from 'lucide-react'
import { Card, CardHead } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { HeroCard } from '@/components/ui/HeroCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pill } from '@/components/ui/Pill'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { toast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shell/PageHeader'
import { TaskIconTile } from '@/components/tasks/TaskIconTile'
import { TaskFormSheet } from '@/components/tasks/TaskFormSheet'
import { SubtaskList } from '@/components/tasks/SubtaskList'
import {
  deleteTask,
  listSessionsForTask,
  listTags,
  listTaskTagIds,
  live,
  restoreTask,
} from '@/lib/db/repo'
import { useStartSession } from '@/lib/timer/use-start-session'
import { SwitchTaskSheet } from '@/components/timer/SwitchTaskSheet'
import { formatDuration } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'
import type { Session } from '@/lib/db/types'

const HISTORY_PREVIEW = 10

/** S6 — one task, its steps, and what it has actually cost so far. */
export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const task = useLiveQuery(() => live.task(id), [id])
  const sessions = useLiveQuery(() => listSessionsForTask(id), [id], [])
  const tagNames = useLiveQuery(async () => {
    const [ids, all] = await Promise.all([listTaskTagIds(id), listTags()])
    return all.filter((tag) => ids.includes(tag.id))
  }, [id])

  const session = useStartSession()

  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)

  useDevOpen('task-edit', () => setEditOpen(true))
  useDevOpen('task-delete', () => setConfirmDelete(true))

  const startSession = useCallback(() => {
    if (!task) return
    session.request(task.id, task.title)
  }, [task, session])

  if (task === undefined) return <div className="h-40 animate-pulse rounded-lg bg-hairline" />

  if (!task || task.deletedAt !== null) {
    return (
      <div className="flex flex-col items-start gap-4 pt-16">
        <p className="text-body text-ink-2">That task is no longer here.</p>
        <Link href="/tasks" className="text-label text-accent">
          Back to tasks
        </Link>
      </div>
    )
  }

  const remove = async () => {
    await deleteTask(task.id)
    router.push('/tasks')
    toast('Task deleted', {
      action: { label: 'Undo', onPress: () => void restoreTask(task.id) },
      durationMs: 6000,
    })
  }

  const visible = showAllHistory ? sessions : sessions.slice(0, HISTORY_PREVIEW)
  const focusedSeconds = sessions
    .filter((s) => s.mode === 'focus')
    .reduce((sum, s) => sum + s.actualDurationSec, 0)

  const estimateLeft = Math.max(0, task.estimatedPomodoros - task.completedPomodoros)
  const doneRatio =
    task.estimatedPomodoros > 0
      ? Math.min(1, task.completedPomodoros / task.estimatedPomodoros)
      : 0

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Task"
        leading={
          <Link
            href="/tasks"
            aria-label="Back to tasks"
            className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </Link>
        }
        actions={
          <IconButton label="Edit task" onClick={() => setEditOpen(true)}>
            <Pencil size={18} strokeWidth={1.75} />
          </IconButton>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <TaskIconTile icon={task.icon} color={task.color} size={52} />
          <h1 className="min-w-0 flex-1 text-title-l text-ink">{task.title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={task.priority}>
            <Flag size={12} strokeWidth={2} aria-hidden />
            {task.priority} priority
          </Pill>
          {task.status === 'completed' && <Pill tone="accent">Completed</Pill>}
          {task.plannedDate ? <Pill>Planned</Pill> : <Pill>Not planned</Pill>}
          {tagNames?.map((tag) => (
            <Pill key={tag.id} tone="dark">
              {tag.name}
            </Pill>
          ))}
        </div>
      </div>

      <HeroCard
        title="Progress"
        chip={
          <Pill tone="dark">
            {task.completedPomodoros} of {task.estimatedPomodoros} sessions
          </Pill>
        }
        value={focusedSeconds > 0 ? formatDuration(focusedSeconds) : '0m'}
        sub={
          estimateLeft > 0
            ? `focused · about ${formatDuration(estimateLeft * 25 * 60)} left`
            : 'focused · estimate met'
        }
      >
        <div className="flex flex-col gap-2.5">
          <div className="on-hero h-3 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500"
              style={{ width: `${Math.round(doneRatio * 100)}%` }}
            />
          </div>
          <div className="flex gap-3.5 text-body-sm">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <span aria-hidden className="size-2 rounded-full bg-ink" />
              {task.completedPomodoros} done
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <span aria-hidden className="on-hero-strong size-2 rounded-full" />
              {estimateLeft} left
            </span>
          </div>
        </div>
      </HeroCard>

      {task.status === 'active' && (
        <Button variant="accent" size="lg" fullWidth onClick={startSession}>
          <Play size={18} strokeWidth={2} fill="currentColor" aria-hidden />
          Start a session
        </Button>
      )}

      <SubtaskList taskId={task.id} />

      {task.description ? (
        <Card className="flex flex-col gap-2.5">
          <CardHead title="Notes" />
          <p className="whitespace-pre-line text-body text-ink-2">{task.description}</p>
        </Card>
      ) : (
        <Card padding="none" className="py-2">
          <EmptyState
            icon={StickyNote}
            title="No notes"
            body="Add context, links, or a definition of done."
            action={
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                Add notes
              </Button>
            }
          />
        </Card>
      )}

      <Card className="flex flex-col gap-2.5" padding="default">
        <CardHead title="Recent sessions">
          {sessions.length > HISTORY_PREVIEW && !showAllHistory && (
            <button
              type="button"
              onClick={() => setShowAllHistory(true)}
              className="text-body-sm font-medium text-green-deep"
            >
              See all {sessions.length}
            </button>
          )}
        </CardHead>

        {sessions.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="No sessions yet"
            body="The first one lands here with its time and length."
          />
        ) : (
          <ul>
            {visible.map((session, i) => (
              <SessionRow
                key={session.id}
                session={session}
                last={i === visible.length - 1}
              />
            ))}
          </ul>
        )}
      </Card>

      {task.status === 'active' && (
        <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} strokeWidth={1.75} aria-hidden className="text-ember" />
          <span className="text-ember">Delete task</span>
        </Button>
      )}

      <TaskFormSheet open={editOpen} onClose={() => setEditOpen(false)} task={task} />

      <SwitchTaskSheet
        open={session.pending !== null}
        runningTitle={session.runningTitle}
        nextTitle={session.pending?.title ?? null}
        onConfirm={session.confirm}
        onClose={session.cancel}
      />

      <ConfirmSheet
        open={confirmDelete}
        title="Delete this task?"
        body={`"${task.title}" and its subtasks will be removed. You can undo this straight after.`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function SessionRow({ session, last }: { session: Session; last?: boolean }) {
  const started = new Date(session.startedAt)

  return (
    <li
      className={cn(
        'flex items-center gap-3 py-2.5',
        !last && 'border-b border-hairline',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          session.completed ? 'bg-green' : 'bg-ember',
        )}
      />
      <span className="min-w-0 flex-1 text-body-sm text-ink">
        {started.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        <span className="text-ink-3">
          {' · '}
          {started.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </span>
      </span>
      <span className="text-body-sm tabular-nums text-ink-2">
        {formatDuration(session.actualDurationSec)}
      </span>
      <span className="text-body-sm text-ink-3">
        {session.completed ? 'completed' : 'interrupted'}
      </span>
    </li>
  )
}
