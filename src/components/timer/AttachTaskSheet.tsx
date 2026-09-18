'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { CircleSlash, ListPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconTile } from '@/components/ui/IconTile'
import { live } from '@/lib/db/repo'
import { taskIcon } from '@/lib/tasks/icons'
import { useTimerStore } from '@/lib/timer/store'
import { cn } from '@/lib/utils/cn'

/**
 * Pick what the next block is for — docs/05-screens.md B7.
 *
 * A session with a task attached is the whole point of the product; without
 * one the timer is a stopwatch. So "focus without a task" stays available but
 * sits below the list rather than in it.
 */
export function AttachTaskSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const tasks = useLiveQuery(() => live.tasks('active'), [], [])
  const currentId = useTimerStore((s) => s.runtime.taskId)

  const attach = (id: string | null, title: string | null) => {
    useTimerStore.getState().attachTask(id, title)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Attach a task" snapPoints={[0.62, 0.95]}>
      {tasks.length === 0 ? (
        <div className="flex flex-col gap-3">
          <EmptyState
            icon={ListPlus}
            title="No tasks yet"
            body="A task gives the session a purpose and somewhere for the time to land in Insights. You can also focus without one."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  onClose()
                  router.push('/tasks?new=1')
                }}
              >
                Create a task
              </Button>
            }
          />
          <Button variant="secondary" fullWidth onClick={() => attach(null, null)}>
            Focus without a task
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="rounded-lg bg-field px-4">
            {tasks.map((task, i) => {
              const Icon = taskIcon(task.icon)
              const selected = task.id === currentId
              return (
                <li
                  key={task.id}
                  className={cn(i < tasks.length - 1 && 'border-b border-hairline')}
                >
                  <button
                    type="button"
                    onClick={() => attach(task.id, task.title)}
                    aria-pressed={selected}
                    className="flex min-h-[64px] w-full items-center gap-3 py-3 text-left"
                  >
                    <IconTile icon={Icon} tone={selected ? 'ink' : 'field'} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {task.title}
                      </span>
                      <span className="block text-body-sm text-ink-2">
                        {task.completedPomodoros} of {task.estimatedPomodoros} sessions
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'inline-flex size-6 shrink-0 items-center justify-center rounded-full',
                        selected ? 'bg-green' : 'border-[1.5px] border-track bg-surface',
                      )}
                    >
                      {selected && <span className="size-2 rounded-full bg-ink" />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={() => attach(null, null)}
            className="flex min-h-11 items-center justify-center gap-2 text-body text-ink-2 transition-colors hover:text-ink"
          >
            <CircleSlash size={18} strokeWidth={1.75} aria-hidden />
            Focus without a task
          </button>
        </div>
      )}
    </Sheet>
  )
}
