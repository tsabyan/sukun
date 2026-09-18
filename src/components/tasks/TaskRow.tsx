'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUpRight, Check, Repeat, RotateCcw, Trash2 } from 'lucide-react'
import { PriorityDot } from '@/components/ui/Pill'
import { HoverActions, SwipeRow, type SwipeAction } from '@/components/ui/SwipeRow'
import { IconTile } from '@/components/ui/IconTile'
import { live } from '@/lib/db/repo'
import { taskIcon } from '@/lib/tasks/icons'
import { haptic } from '@/lib/utils/haptics'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/db/types'

const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const

interface TaskRowProps {
  task: Task
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
  /** last row in the card — no divider */
  last?: boolean
}

/**
 * One task, as a row inside the list card — docs/05-screens.md C1.
 *
 * Swipe left for done/delete on touch, the same two actions on hover for a
 * pointer. The icon tile carries the task's colour, which is what makes a long
 * list scannable; priority travels as a dot *and* a screen-reader label,
 * because colour alone is never the signal.
 */
export function TaskRow({ task, onComplete, onDelete, last }: TaskRowProps) {
  const progress = useLiveQuery(() => live.subtaskProgress(task.id), [task.id])
  const done = task.status === 'completed'
  const Icon = taskIcon(task.icon)

  const actions: SwipeAction[] = [
    {
      label: done ? 'Reopen' : 'Done',
      icon: done ? (
        <RotateCcw size={18} strokeWidth={1.75} />
      ) : (
        <Check size={18} strokeWidth={1.75} />
      ),
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

  const ratio = progress && progress.total > 0 ? progress.done / progress.total : null
  const sessionRatio =
    task.estimatedPomodoros > 0
      ? Math.min(1, task.completedPomodoros / task.estimatedPomodoros)
      : 0

  return (
    <div className={cn(!last && 'border-b border-hairline')}>
      <SwipeRow actions={actions}>
        <div className="group relative bg-surface">
          <Link
            href={`/tasks/${task.id}`}
            className="flex min-h-[72px] items-center gap-3 py-3 pr-1 sm:pr-24"
          >
            <IconTile
              icon={Icon}
              tone={done ? 'green' : 'field'}
              className={done ? undefined : 'text-ink'}
            />

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <PriorityDot priority={task.priority} />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-body font-medium text-ink',
                    done && 'text-ink-3 line-through',
                  )}
                >
                  {task.title}
                </span>
              </span>

              <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-ink-2">
                <span className="sr-only">{PRIORITY_LABEL[task.priority]} priority</span>

                <span className="tabular-nums">
                  {done
                    ? `Done · ${task.completedPomodoros} sessions`
                    : `${task.completedPomodoros} of ${Math.max(
                        task.completedPomodoros,
                        task.estimatedPomodoros,
                      )} sessions`}
                </span>

                {!done && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="block h-1 w-12 overflow-hidden rounded-full bg-track">
                      <span
                        className={cn(
                          'block h-full rounded-full transition-[width] duration-300',
                          (ratio ?? sessionRatio) >= 1 ? 'bg-green' : 'bg-ink',
                        )}
                        style={{ width: `${(ratio ?? sessionRatio) * 100}%` }}
                      />
                    </span>
                    {progress && progress.total > 0 && (
                      <span className="tabular-nums">
                        {progress.done}/{progress.total}
                      </span>
                    )}
                  </span>
                )}

                {task.recurrence && (
                  <span className="inline-flex items-center gap-1">
                    <Repeat size={12} strokeWidth={1.75} aria-hidden />
                    Repeats
                  </span>
                )}
              </span>
            </span>

            <ArrowUpRight
              size={16}
              strokeWidth={1.75}
              className="shrink-0 text-ink"
              aria-hidden
            />
          </Link>

          <HoverActions actions={actions} />
        </div>
      </SwipeRow>
    </div>
  )
}
