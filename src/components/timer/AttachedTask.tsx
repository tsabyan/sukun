'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Plus } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { PriorityDot } from '@/components/ui/Pill'
import { live } from '@/lib/db/repo'
import { useTimerStore } from '@/lib/timer/store'
import { cn } from '@/lib/utils/cn'

/**
 * The line under the countdown. A session with a task attached is the whole
 * point of the product — without one the timer is a stopwatch — so the empty
 * state is an invitation rather than a blank.
 */
export function AttachedTask() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const taskId = useTimerStore((s) => s.runtime.taskId)
  const title = useTimerStore((s) => s.attachedTaskTitle)

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={cn(
          'max-w-full truncate rounded-full px-3 py-1 text-body-sm transition-colors duration-150',
          taskId ? 'text-ink-2 hover:text-ink' : 'text-ink-3 hover:text-ink-2',
        )}
      >
        {taskId && title ? title : 'Attach a task'}
      </button>

      <TaskPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  )
}

function TaskPickerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tasks = useLiveQuery(() => live.tasks('active'), [], [])
  const currentId = useTimerStore((s) => s.runtime.taskId)

  const attach = (id: string | null, title: string | null) => {
    useTimerStore.getState().attachTask(id, title)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="What are you working on?" snapPoints={[0.6, 0.95]}>
      {tasks.length === 0 ? (
        <div className="flex flex-col items-start gap-4 py-6">
          <p className="text-body text-ink-2">
            No open tasks yet. Add one to give this session a purpose.
          </p>
          <Button variant="primary" onClick={onClose}>
            <Plus size={18} strokeWidth={1.75} />
            Add a task
          </Button>
        </div>
      ) : (
        <ul className="inset-divider -mx-1">
          {currentId && (
            <li>
              <button
                type="button"
                onClick={() => attach(null, null)}
                className="flex min-h-[52px] w-full items-center px-1 text-left text-body text-ink-2 hover:text-ink"
              >
                Work without a task
              </button>
            </li>
          )}
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => attach(task.id, task.title)}
                className="flex min-h-[60px] w-full items-center gap-3 px-1 text-left"
              >
                <PriorityDot priority={task.priority} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{task.title}</span>
                  <span className="block text-body-sm text-ink-3">
                    {task.completedPomodoros} of {task.estimatedPomodoros} pomodoros
                  </span>
                </span>
                {task.id === currentId && (
                  <Check size={18} strokeWidth={2} className="text-accent" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
