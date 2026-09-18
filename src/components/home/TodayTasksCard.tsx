'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { CalendarDays, Check, ListTodo, Pause, Play, Plus } from 'lucide-react'
import { Card, CardHead } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconTile } from '@/components/ui/IconTile'
import { Pill, ChipButton } from '@/components/ui/Pill'
import type { IconTileTone } from '@/components/ui/IconTile'
import { reopenTask } from '@/lib/db/repo'
import { taskIcon } from '@/lib/tasks/icons'
import { useTimerStore } from '@/lib/timer/store'
import { spring } from '@/lib/motion/tokens'
import { formatCountdown, today } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/db/types'

/** Home shows the shape of the day, not the whole backlog. */
export const HOME_TASK_ROWS = 4

const PRIORITY_WORD = { high: 'High', medium: 'Medium', low: 'Low' } as const

/**
 * B1 — "Today's tasks".
 *
 * Every row can start a session on the spot: the play button attaches the task
 * and opens the focus screen, which is the shortest path there is from "what
 * should I do" to working. The row itself opens the task.
 */
export function TodayTasksCard({
  tasks,
  done,
  total,
  onAdd,
}: {
  /** the rows to draw, already trimmed */
  tasks: Task[]
  done: number
  total: number
  onAdd: () => void
}) {
  return (
    <Card className="flex flex-col gap-3">
      <CardHead title="Today's tasks">
        {total > 0 && <Pill>{`${done} of ${total} done`}</Pill>}
        {/* The planner, one tap from the card it shapes — B8. */}
        <Link
          href="/plan"
          aria-label="Plan today"
          className="inline-flex size-8 items-center justify-center rounded-full bg-ink text-green"
        >
          <CalendarDays size={16} strokeWidth={1.75} />
        </Link>
      </CardHead>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nothing planned yet"
          body="Add one or two tasks you want to finish today. You can start a focus session from any task."
          action={
            <ChipButton selected onClick={onAdd}>
              <Plus size={14} strokeWidth={2} aria-hidden />
              Add a task
            </ChipButton>
          }
        />
      ) : (
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function TaskRow({ task }: { task: Task }) {
  const router = useRouter()
  const attachedId = useTimerStore((s) => s.runtime.taskId)
  const status = useTimerStore((s) => s.runtime.status)
  const phase = useTimerStore((s) => s.runtime.phase)
  const seconds = useTimerStore((s) => Math.ceil(s.remainingMs / 1000))

  const complete = task.status === 'completed'
  const focusing = !complete && attachedId === task.id && status !== 'idle' && phase === 'focus'

  const tone: IconTileTone = complete ? 'green' : 'field'

  const start = () => {
    const timer = useTimerStore.getState()
    if (focusing) {
      timer.toggle()
      return
    }
    timer.attachTask(task.id, task.title)
    if (timer.runtime.status !== 'running') timer.start()
    router.push('/focus')
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={`/tasks/${task.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <IconTile icon={taskIcon(task.icon)} tone={tone} size={40} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-body font-medium',
              complete ? 'text-ink-2' : 'text-ink',
            )}
          >
            {task.title}
          </span>
          <span
            className={cn(
              'block truncate text-body-sm',
              focusing ? 'text-green-deep' : 'text-ink-2',
            )}
          >
            {complete ? doneLabel(task) : focusing ? runningLabel(seconds) : metaLabel(task)}
          </span>
        </span>
      </Link>

      {complete ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          transition={spring.snappy}
          aria-label={`Reopen ${task.title}`}
          onClick={() => void reopenTask(task.id)}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-green-soft text-green-deep"
        >
          <Check size={16} strokeWidth={2.5} aria-hidden />
        </motion.button>
      ) : (
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          transition={spring.snappy}
          aria-label={focusing ? `Pause ${task.title}` : `Start a session on ${task.title}`}
          onClick={start}
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-full',
            focusing ? 'bg-ink text-green' : 'bg-green text-on-accent',
          )}
        >
          {focusing ? (
            <Pause size={16} strokeWidth={2} fill="currentColor" aria-hidden />
          ) : (
            <Play size={16} strokeWidth={2} fill="currentColor" aria-hidden />
          )}
        </motion.button>
      )}
    </li>
  )
}

function runningLabel(seconds: number) {
  return `Focusing · ${formatCountdown(seconds * 1000)} left`
}

function doneLabel(task: Task) {
  if (!task.completedAt) return 'Done'
  const at = new Date(task.completedAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `Done · ${at}`
}

/** Priority, then the most useful second fact the task has. */
function metaLabel(task: Task) {
  const priority = PRIORITY_WORD[task.priority]
  if (task.dueDate === today()) return `${priority} · due today`
  if (task.completedPomodoros > 0) {
    // An estimate that has already been passed is not a denominator worth
    // printing — "8 of 1 sessions" reads as a bug.
    const of = Math.max(task.completedPomodoros, task.estimatedPomodoros)
    return `${priority} · ${task.completedPomodoros} of ${of} sessions`
  }
  return `${priority} · not started`
}
