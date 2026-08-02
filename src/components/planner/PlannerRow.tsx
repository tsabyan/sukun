'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical } from 'lucide-react'
import { PriorityDot } from '@/components/ui/Pill'
import { haptic } from '@/lib/utils/haptics'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/db/types'

interface PlannerRowProps {
  task: Task
  onToggle: (task: Task) => void
  /** rendered inside the drag overlay, where sortable context is absent */
  overlay?: boolean
}

export function PlannerRow({ task, onToggle, overlay }: PlannerRowProps) {
  const sortable = useSortable({ id: task.id, disabled: overlay })
  const done = task.status === 'completed'

  const style = overlay
    ? undefined
    : {
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.4 : 1,
      }

  return (
    <li
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 bg-surface px-4 py-3',
        overlay && 'rounded-lg border border-hairline shadow-lg',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={() => onToggle(task)}
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-[8px] border transition-colors',
          done
            ? 'border-accent bg-accent text-on-accent'
            : 'border-hairline-strong text-transparent hover:border-accent',
        )}
      >
        <Check size={14} strokeWidth={2.5} />
      </button>

      <PriorityDot priority={task.priority} />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-body',
            done ? 'text-ink-3 line-through' : 'text-ink',
          )}
        >
          {task.title}
        </span>
        {task.description && (
          <span className="block truncate text-body-sm text-ink-3">{task.description}</span>
        )}
      </span>

      <span className="text-body-sm tabular-nums text-ink-3">
        {task.completedPomodoros}/{task.estimatedPomodoros}
      </span>

      <span
        {...(overlay ? {} : sortable.attributes)}
        {...(overlay ? {} : sortable.listeners)}
        onPointerDown={(event) => {
          if (overlay) return
          haptic('dragEngaged')
          sortable.listeners?.onPointerDown?.(event)
        }}
        aria-label={`Reorder ${task.title}`}
        className="cursor-grab touch-none px-1 text-ink-3 active:cursor-grabbing"
      >
        <GripVertical size={16} strokeWidth={1.75} />
      </span>
    </li>
  )
}
