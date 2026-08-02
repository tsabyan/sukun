'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Flag, Pencil, Play, Share, Timer, Trash2 } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Pill, PriorityDot } from '@/components/ui/Pill'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { toast } from '@/components/ui/Toast'
import { TaskIconTile } from '@/components/tasks/TaskIconTile'
import { TaskFormSheet } from '@/components/tasks/TaskFormSheet'
import { SubtaskList } from '@/components/tasks/SubtaskList'
import {
  deleteTask,
  exportAll,
  listSessionsForTask,
  listTags,
  listTaskTagIds,
  live,
  restoreTask,
} from '@/lib/db/repo'
import { useTimerStore } from '@/lib/timer/store'
import { formatDuration } from '@/lib/utils/dates'
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

  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)

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

  const startSession = () => {
    useTimerStore.getState().attachTask(task.id, task.title)
    useTimerStore.getState().start()
    router.push('/')
  }

  const copyAsJson = async () => {
    const bundle = await exportAll()
    const payload = {
      task,
      subtasks: bundle.subtasks.filter((s) => s.taskId === task.id),
      sessions: bundle.sessions.filter((s) => s.taskId === task.id),
    }
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    toast('Task copied as JSON')
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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link
          href="/tasks"
          aria-label="Back to tasks"
          className="inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:text-ink"
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </Link>

        <div className="flex items-center gap-1">
          <IconButton label="Copy as JSON" onClick={() => void copyAsJson()}>
            <Share size={18} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Edit task" onClick={() => setEditOpen(true)}>
            <Pencil size={18} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label="Delete task"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={18} strokeWidth={1.75} />
          </IconButton>
        </div>
      </header>

      <Card className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <TaskIconTile icon={task.icon} color={task.color} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="text-title-l font-display text-ink">{task.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone={task.priority}>
                <Flag size={12} strokeWidth={2} aria-hidden />
                {task.priority} priority
              </Pill>
              {task.status === 'completed' && <Pill>Completed</Pill>}
              {tagNames?.map((tag) => <Pill key={tag.id}>{tag.name}</Pill>)}
            </div>
          </div>
        </div>

        {task.description && <p className="text-body text-ink-2">{task.description}</p>}

        <div className="flex items-center gap-4 text-body-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Timer size={14} strokeWidth={1.75} aria-hidden />
            {task.completedPomodoros} of {task.estimatedPomodoros} pomodoros
          </span>
          {focusedSeconds > 0 && <span>{formatDuration(focusedSeconds)} focused</span>}
        </div>

        {task.status === 'active' && (
          <Button variant="primary" fullWidth onClick={startSession}>
            <Play size={18} strokeWidth={1.75} fill="currentColor" />
            Start focus session
          </Button>
        )}
      </Card>

      <SubtaskList taskId={task.id} />

      <section className="flex flex-col gap-3">
        <SectionLabel className="mb-0">Sessions on this task</SectionLabel>

        {sessions.length === 0 ? (
          <Card padding="compact">
            <p className="text-body-sm text-ink-2">
              No sessions yet. Start one and it will show up here.
            </p>
          </Card>
        ) : (
          <>
            <Card padding="none" className="overflow-hidden">
              <ul className="inset-divider">
                {visible.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </ul>
            </Card>
            {sessions.length > HISTORY_PREVIEW && !showAllHistory && (
              <button
                type="button"
                onClick={() => setShowAllHistory(true)}
                className="self-start text-label text-accent"
              >
                Show all {sessions.length}
              </button>
            )}
          </>
        )}
      </section>

      <TaskFormSheet open={editOpen} onClose={() => setEditOpen(false)} task={task} />

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

function SessionRow({ session }: { session: Session }) {
  const started = new Date(session.startedAt)

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <PriorityDot priority={session.completed ? 'low' : 'medium'} />
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
