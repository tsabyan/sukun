'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Timer } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PriorityDot } from '@/components/ui/Pill'
import { live } from '@/lib/db/repo'
import { today } from '@/lib/utils/dates'
import { useTimerStore } from '@/lib/timer/store'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/db/types'

const MAX_ROWS = 3

/**
 * Three tasks, tap to attach. Planned-for-today first; if the day hasn't been
 * planned, the newest open tasks stand in — an empty box on the home screen
 * teaches people the section is useless, and they stop looking at it.
 */
export function TodayTasks() {
  const data = useLiveQuery(async () => {
    const planned = await live.planned(today())
    const open = planned.filter((task) => task.status === 'active')
    if (open.length > 0) return { rows: open.slice(0, MAX_ROWS), planned: true }

    const active = await live.tasks('active')
    return { rows: active.slice(0, MAX_ROWS), planned: false }
  }, [])

  const attachedId = useTimerStore((s) => s.runtime.taskId)

  if (!data) return <Card className="h-[120px] animate-pulse" />

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between px-1">
        <h2 className="text-title-m text-ink">
          {data.planned ? "Today's tasks" : 'Open tasks'}
        </h2>
        <Link href="/plan" className="text-label text-accent">
          Plan
        </Link>
      </header>

      {data.rows.length === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <p className="text-body text-ink-2">
            No tasks yet. Add one to give this session a purpose.
          </p>
          <Link
            href="/tasks"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-label font-medium text-canvas"
          >
            <Plus size={18} strokeWidth={1.75} />
            Add a task
          </Link>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="inset-divider">
            {data.rows.map((task) => (
              <TaskRow key={task.id} task={task} attached={task.id === attachedId} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}

function TaskRow({ task, attached }: { task: Task; attached: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => useTimerStore.getState().attachTask(task.id, task.title)}
        className={cn(
          'flex min-h-[60px] w-full items-center gap-3 px-4 text-left',
          'transition-colors duration-150 hover:bg-surface-raised',
        )}
      >
        <PriorityDot priority={task.priority} />
        <span className="min-w-0 flex-1 truncate text-body text-ink">{task.title}</span>
        <span
          className={cn(
            'flex items-center gap-1 text-body-sm tabular-nums',
            attached ? 'text-accent' : 'text-ink-3',
          )}
        >
          <Timer size={14} strokeWidth={1.75} aria-hidden />
          {task.completedPomodoros}/{task.estimatedPomodoros}
        </span>
      </button>
    </li>
  )
}
