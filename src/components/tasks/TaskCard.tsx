'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Repeat, RotateCcw, Timer, Trash2 } from 'lucide-react'
import { TaskIconTile } from './TaskIconTile'
import { PriorityDot } from '@/components/ui/Pill'
import { HoverActions, SwipeRow, type SwipeAction } from '@/components/ui/SwipeRow'
import { live } from '@/lib/db/repo'
import { TASK_COLOR_VAR } from '@/lib/tasks/icons'
import { haptic } from '@/lib/utils/haptics'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/db/types'

const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const

interface TaskCardProps {
  task: Task
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskCard({ task, onComplete, onDelete }: TaskCardProps) {
  const progress = useLiveQuery(() => live.subtaskProgress(task.id), [task.id])
  const done = task.status === 'completed'

  const actions: SwipeAction[] = [
    {
      label: done ? 'Reopen' : 'Done',
      icon: done ? <RotateCcw size={18} strokeWidth={1.75} /> : <Check size={18} strokeWidth={1.75} />,
      onPress: () => {
        haptic('taskComplete')
        onComplete(task)
      },
    },
    {
      label: 'Delete',
      icon: <Trash2 size={18} strokeWidth={1.75} />,
      tone: 'destructive',
      onPress: () => onDelete(task),
    },
  ]

  const subtaskRatio =
    progress && progress.total > 0 ? progress.done / progress.total : null

  return (
    <SwipeRow actions={actions} className="rounded-lg border border-hairline bg-surface shadow-sm">
      <div className="group relative">
        {/* the colour rail is the fastest way to find a task in a long list */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 rounded-l-lg"
          style={{ background: TASK_COLOR_VAR[task.color] }}
        />

        <Link
          href={`/tasks/${task.id}`}
          className="flex items-center gap-3 py-3 pl-5 pr-3 sm:pr-24"
        >
          <TaskIconTile icon={task.icon} color={task.color} />

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <PriorityDot priority={task.priority} />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-body text-ink',
                  done && 'text-ink-3 line-through',
                )}
              >
                {task.title}
              </span>
            </span>

            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-3">
              <span className="sr-only">{PRIORITY_LABEL[task.priority]} priority</span>

              <span className="inline-flex items-center gap-1 tabular-nums">
                <Timer size={13} strokeWidth={1.75} aria-hidden />
                {task.completedPomodoros}/{task.estimatedPomodoros}
              </span>

              {progress && progress.total > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="block h-1 w-10 overflow-hidden rounded-full bg-hairline">
                    <span
                      className="block h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${(subtaskRatio ?? 0) * 100}%` }}
                    />
                  </span>
                  <span className="tabular-nums">
                    {progress.done}/{progress.total}
                  </span>
                </span>
              )}

              {task.recurrence && (
                <span className="inline-flex items-center gap-1">
                  <Repeat size={13} strokeWidth={1.75} aria-hidden />
                  Weekly
                </span>
              )}
            </span>
          </span>
        </Link>

        <HoverActions actions={actions} />
      </div>
    </SwipeRow>
  )
}
